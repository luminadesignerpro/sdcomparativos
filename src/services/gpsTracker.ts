/**
 * gpsTracker.ts — Singleton GPS tracker (runs outside React lifecycle)
 *
 * Uses Geolocation.watchPosition instead of setInterval + getCurrentPosition
 * so that Android Capacitor keeps delivering locations even when the
 * WebView is in background or the screen is off.
 */

import { Geolocation } from '@capacitor/geolocation';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

const db = supabaseClient as any;

const SESSION_KEY = 'gps_active_trip_id';
const PENDING_QUEUE_KEY = 'gps_pending_locations_v2';
const MIN_INTERVAL_MS = 15_000; // min 15s between DB writes
const MAX_QUEUE_SIZE = 300;

let currentTripId: string | null = null;
let watchId: string | null = null;
let lastSaveTime = 0;
let onLocationSaved: (() => void) | null = null;

// Fallback interval in case watchPosition doesn't fire frequently enough
let fallbackIntervalId: any = null;
const FALLBACK_INTERVAL_MS = 30_000;

export interface GpsLogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'error' | 'success';
}

interface LocationPayload {
    trip_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    recorded_at: string;
}

let gpsDebugLog: GpsLogEntry[] = [];
let pendingQueue: LocationPayload[] = [];
const MAX_LOG_SIZE = 80;
// Headquarters coordinates (set these to actual location)
const HEADQUARTERS_LAT = 0; // TODO: replace with real latitude
const HEADQUARTERS_LNG = 0; // TODO: replace with real longitude

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // metres
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function addLog(message: string, type: GpsLogEntry['type'] = 'info') {
    const entry = { timestamp: new Date().toLocaleTimeString(), message, type };
    gpsDebugLog.unshift(entry);
    if (gpsDebugLog.length > MAX_LOG_SIZE) gpsDebugLog.pop();
    console.log(`[GPSTracker] ${message}`);
}

// ─── Pending queue (offline resilience) ───────────────────────────────

function loadPendingQueue() {
    try {
        const raw = localStorage.getItem(PENDING_QUEUE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            pendingQueue = parsed
                .filter((item: any) => item?.trip_id && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
                .slice(-MAX_QUEUE_SIZE);
            if (pendingQueue.length > 0) {
                addLog(`📦 ${pendingQueue.length} ponto(s) pendente(s) recuperado(s)`, 'info');
            }
        }
    } catch {
        pendingQueue = [];
    }
}

function persistPendingQueue() {
    try {
        if (pendingQueue.length === 0) {
            localStorage.removeItem(PENDING_QUEUE_KEY);
            return;
        }
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(pendingQueue.slice(-MAX_QUEUE_SIZE)));
    } catch { /* ignore */ }
}

function enqueueLocation(payload: LocationPayload) {
    pendingQueue.push(payload);
    if (pendingQueue.length > MAX_QUEUE_SIZE) pendingQueue = pendingQueue.slice(-MAX_QUEUE_SIZE);
    persistPendingQueue();
    addLog(`📥 Ponto enfileirado (fila: ${pendingQueue.length})`, 'info');
}

async function flushPendingQueue() {
    if (pendingQueue.length === 0) return;
    const batch = [...pendingQueue];
    const { error } = await db.from('trip_locations').insert(batch);
    if (error) {
        addLog(`Falha no reenvio: ${error.message || JSON.stringify(error)}`, 'error');
        return;
    }
    pendingQueue = [];
    persistPendingQueue();
    addLog(`✅ ${batch.length} ponto(s) pendente(s) reenviado(s)`, 'success');
}

// ─── Core: save a position to DB ─────────────────────────────────────

async function savePosition(tripId: string, coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null }) {
    const now = Date.now();

    // Throttle: skip if last save was < MIN_INTERVAL_MS ago
    if (now - lastSaveTime < MIN_INTERVAL_MS) return;
    lastSaveTime = now;

    // Flush any pending items first
    await flushPendingQueue();

    const payload: LocationPayload = {
        trip_id: tripId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        speed: coords.speed,
        recorded_at: new Date().toISOString(),
    };

    const accLabel = payload.accuracy !== null ? `${payload.accuracy.toFixed(0)}m` : 'n/d';
    addLog(`📍 Salvando (acc: ${accLabel}, lat: ${coords.latitude.toFixed(5)})`);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueLocation(payload);
        addLog('Sem internet — guardado para reenvio', 'error');
        return;
    }

    const { error } = await db.from('trip_locations').insert(payload);
    if (error) {
        enqueueLocation(payload);
        addLog(`Erro DB: ${error.message}`, 'error');
        return;
    }

    addLog('✅ Posição salva!', 'success');
    onLocationSaved?.();
    // Auto‑close after 17:30 when the employee is more than 30 m from the headquarters
    const nowObj = new Date();
    if (nowObj.getHours() > 17 || (nowObj.getHours() === 17 && nowObj.getMinutes() >= 30)) {
        const distance = getDistanceMeters(payload.latitude, payload.longitude, HEADQUARTERS_LAT, HEADQUARTERS_LNG);
        if (distance > 30) {
            addLog(`🚦 Ponto fechado automaticamente (${distance.toFixed(1)}m da sede)`, 'info');
            gpsTracker.stop();
        }
    }
}

// ─── Fallback: getCurrentPosition polling ─────────────────────────────

async function fallbackCapture(tripId: string) {
    try {
        let pos: any;
        try {
            pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        } catch {
            pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
        }
        await savePosition(tripId, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
            speed: typeof pos.coords.speed === 'number' ? pos.coords.speed : null,
        });
    } catch (err: any) {
        addLog(`Fallback GPS falhou: ${err?.message || 'desconhecido'}`, 'error');
    }
}

// ─── Load pending queue on import ─────────────────────────────────────
loadPendingQueue();

// ─── Restore active trip from sessionStorage on app restart ───────────
try {
    const savedTripId = localStorage.getItem(SESSION_KEY);
    if (savedTripId) {
        addLog(`🔄 Restaurando rastreamento da viagem ${savedTripId.slice(0, 8)}`);
        // Will be started properly when DriverTripPanel mounts
    }
} catch { /* ignore */ }

// ─── Public API ───────────────────────────────────────────────────────

export const gpsTracker = {
    /** Start tracking for a trip. Uses watchPosition for background survival. */
    async start(tripId: string, callback?: () => void) {
        if (currentTripId === tripId && watchId !== null) {
            onLocationSaved = callback || null;
            void flushPendingQueue();
            return;
        }

        this.stop();
        currentTripId = tripId;
        onLocationSaved = callback || null;
        lastSaveTime = 0; // Force immediate first save

        try { localStorage.setItem(SESSION_KEY, tripId); } catch { /* ignore */ }

        addLog(`🚀 Iniciando rastreamento para viagem ${tripId.slice(0, 8)}`);

        // Primary: watchPosition — fires even in background on Android/Capacitor
        try {
            watchId = await Geolocation.watchPosition(
                { enableHighAccuracy: true },
                (position, err) => {
                    if (err || !position) {
                        addLog(`watchPosition erro: ${err?.message || 'posição nula'}`, 'error');
                        return;
                    }
                    void savePosition(tripId, {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
                        speed: typeof position.coords.speed === 'number' ? position.coords.speed : null,
                    });
                }
            );
            addLog('👁️ watchPosition ativo', 'success');
        } catch (err: any) {
            addLog(`watchPosition indisponível: ${err?.message}. Usando fallback.`, 'error');
        }

        // Also do an immediate capture
        void fallbackCapture(tripId);

        // Secondary: polling fallback (in case watchPosition doesn't fire often enough)
        fallbackIntervalId = setInterval(() => {
            if (currentTripId) void fallbackCapture(currentTripId);
        }, FALLBACK_INTERVAL_MS);
    },

    /** Stop tracking entirely. */
    stop() {
        if (watchId !== null) {
            Geolocation.clearWatch({ id: watchId }).catch(() => { });
            watchId = null;
        }

        if (fallbackIntervalId !== null) {
            clearInterval(fallbackIntervalId);
            fallbackIntervalId = null;
        }

        if (currentTripId) {
            addLog(`🛑 Parando rastreamento para viagem ${currentTripId.slice(0, 8)}`);
        }

        currentTripId = null;
        onLocationSaved = null;

        try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    },

    setCallback(callback: () => void) {
        onLocationSaved = callback;
    },

    forceSyncPending() {
        void flushPendingQueue();
    },

    getActiveTripId(): string | null {
        return currentTripId;
    },

    isTracking(): boolean {
        return watchId !== null || fallbackIntervalId !== null;
    },

    getLogs(): GpsLogEntry[] {
        return gpsDebugLog;
    },

    clearLogs() {
        gpsDebugLog = [];
    },
};
