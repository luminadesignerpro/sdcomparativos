import React, { useState, useEffect, useRef } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const db = supabaseClient as any;
import L from 'leaflet';
import { Navigation, Clock, User, ShieldCheck, MapPin, AlertCircle, Loader2 } from 'lucide-react';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const vehicleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface CustomerTrackingPageProps {
  tripId: string;
}

export default function CustomerTrackingPage({ tripId }: CustomerTrackingPageProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    fetchInitialData();
    const subscription = subscribeToLocations();
    return () => {
      subscription.unsubscribe();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [tripId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: trip, error: tripErr } = await db
        .from('trips')
        .select('*, employees(name), vehicles(model, plate)')
        .eq('id', tripId)
        .single();

      if (tripErr || !trip) {
        setError('Viagem não encontrada ou já finalizada.');
        setLoading(false);
        return;
      }

      setTripInfo(trip);

      const { data: locs } = await db
        .from('trip_locations')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: true });

      if (locs) {
        setLocations(locs);
        initMap(locs);
      }
    } catch (err) {
      setError('Erro ao carregar rastreamento.');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToLocations = () => {
    return db
      .channel(`track-${tripId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'trip_locations', 
        filter: `trip_id=eq.${tripId}` 
      }, (payload: any) => {
        const newLoc = payload.new;
        setLocations(prev => [...prev, newLoc]);
        updateMap(newLoc);
      })
      .subscribe();
  };

  const initMap = (initialLocs: any[]) => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = initialLocs.length > 0 
      ? [initialLocs[initialLocs.length - 1].latitude, initialLocs[initialLocs.length - 1].longitude]
      : [-3.7172, -38.5433];

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    if (initialLocs.length > 0) {
      const latlngs = initialLocs.map(l => [l.latitude, l.longitude] as [number, number]);
      polylineRef.current = L.polyline(latlngs, { color: '#22c55e', weight: 4, opacity: 0.6 }).addTo(map);
      
      const last = initialLocs[initialLocs.length - 1];
      markerRef.current = L.marker([last.latitude, last.longitude], { icon: vehicleIcon }).addTo(map);
      map.panTo([last.latitude, last.longitude]);
    }

    mapRef.current = map;
  };

  const updateMap = (newLoc: any) => {
    if (!mapRef.current) return;
    const pos: [number, number] = [newLoc.latitude, newLoc.longitude];
    
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { icon: vehicleIcon }).addTo(mapRef.current);
    }

    if (polylineRef.current) {
      polylineRef.current.addLatLng(pos);
    }

    mapRef.current.panTo(pos);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="font-bold text-lg">Iniciando Rastreio Seguro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f0f0f] p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Ops!</h2>
        <p className="text-gray-400 max-w-sm mb-8">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-white/5 border border-white/10 text-white px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-all"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const lastLoc = locations[locations.length - 1];
  const speedKmh = lastLoc?.speed ? (lastLoc.speed * 3.6).toFixed(0) : '0';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f0f] overflow-hidden">
      {/* Header */}
      <header className="p-4 bg-black/80 backdrop-blur-xl border-b border-white/5 z-20">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Acompanhe sua Entrega</h1>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Ao Vivo agora
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-[10px] text-white font-bold uppercase">Rastreio Seguro</span>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        
        {/* Speed Badge Over Map */}
        <div className="absolute top-4 left-4 z-10">
           <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-2xl">
              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Velocidade</p>
              <p className="text-white font-black text-xl">{speedKmh} <span className="text-[10px] font-normal text-gray-400">km/h</span></p>
           </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-black/90 backdrop-blur-2xl border-t border-white/10 z-20 rounded-t-[32px] -mt-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-white relative">
                 <User className="w-7 h-7" />
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-black rounded-full flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                 </div>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Motorista Parceiro</p>
                <h3 className="text-white font-black text-lg">{tripInfo.employees?.name || 'Equipe SD'}</h3>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Veículo</p>
              <h3 className="text-white font-bold">{tripInfo.vehicles?.model}</h3>
              <p className="text-amber-500 text-xs font-mono">{tripInfo.vehicles?.plate}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Início</p>
                <p className="text-white text-sm font-bold">{new Date(tripInfo.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Pontos</p>
                <p className="text-white text-sm font-bold">{locations.length} capturados</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
             <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-center">
                <p className="text-amber-500 text-xs font-bold">Obrigado por escolher a SD Móveis Projetados! ❤️</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
