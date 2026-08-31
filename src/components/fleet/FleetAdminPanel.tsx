import React, { useState, useEffect, Suspense, useRef } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const db = supabaseClient as any;
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Route, Clock, Users, Eye, Fuel, Car, Plus, Pencil, ToggleLeft, ToggleRight, X, Save, RefreshCw, Star } from 'lucide-react';
import FleetMap from './FleetMap';
import FuelAdminPanel from './FuelAdminPanel';

interface Employee {
  id: string;
  name: string;
  role: string | null;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: string | null;
  year: number | null;
  active: boolean;
}

interface Trip {
  id: string;
  employee_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  description: string | null;
}

interface TripLocation {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
}

const VEHICLE_TYPES = ['Carro', 'Van', 'Caminhão', 'Moto', 'Utilitário', 'Outro'];

const emptyVehicle = { plate: '', model: '', type: 'Carro', year: new Date().getFullYear() };

export default function FleetAdminPanel() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripLocations, setTripLocations] = useState<TripLocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tab, setTab] = useState<'live' | 'history' | 'fuel' | 'vehicles'>('live');
  const [loading, setLoading] = useState(true);
  const [tripPointCounts, setTripPointCounts] = useState<Record<string, number>>({});

  // Refs to avoid stale closures inside realtime callbacks
  const activeTripsRef = useRef<Trip[]>([]);
  const completedTripsRef = useRef<Trip[]>([]);
  const selectedTripIdRef = useRef<string | null>(null);
  const tabRef = useRef<string>('live');
  const liveSyncInProgressRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { activeTripsRef.current = activeTrips; }, [activeTrips]);
  useEffect(() => { completedTripsRef.current = completedTrips; }, [completedTrips]);
  useEffect(() => { selectedTripIdRef.current = selectedTripId; }, [selectedTripId]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Vehicle form state
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const mergeLocations = (previous: TripLocation[], incoming: TripLocation[]) => {
    const uniqueById = new Map<string, TripLocation>();
    [...previous, ...incoming].forEach((loc) => uniqueById.set(loc.id, loc));
    return Array.from(uniqueById.values()).sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
  };

  const fetchData = async () => {
    setLoading(true);
    const [empRes, activeRes, completedRes, vehRes] = await Promise.all([
      db.from('employees').select('id, name, role').eq('active', true),
      db.from('trips').select('*').or('status.eq.active,ended_at.is.null').order('started_at', { ascending: false }),
      db.from('trips').select('*').or('status.eq.completed,ended_at.not.is.null').order('ended_at', { ascending: false }).limit(50),
      db.from('vehicles').select('id, plate, model, year, active').order('model'),
    ]);

    if (empRes.data) setEmployees(empRes.data);

    if (activeRes.data) {
      const nextActive = activeRes.data as Trip[];
      setActiveTrips(nextActive);
      activeTripsRef.current = nextActive;
      if (nextActive.length === 0 && tabRef.current === 'live') setTripLocations([]);
    }

    if (completedRes.data) {
      const nextCompleted = completedRes.data as Trip[];
      setCompletedTrips(nextCompleted);
      completedTripsRef.current = nextCompleted;
    }

    if (vehRes.data) setVehicles(vehRes.data);
    setLoading(false);
  };

  const fetchActiveTrips = async () => {
    const { data } = await db
      .from('trips')
      .select('*')
      .or('status.eq.active,ended_at.is.null')
      .order('started_at', { ascending: false });

    const nextActiveTrips = (data || []) as Trip[];
    setActiveTrips(nextActiveTrips);
    activeTripsRef.current = nextActiveTrips;

    if (nextActiveTrips.length === 0 && tabRef.current === 'live') {
      setTripLocations([]);
    }

    return nextActiveTrips;
  };

  const fetchCompletedTrips = async () => {
    const { data } = await db
      .from('trips')
      .select('*')
      .or('status.eq.completed,ended_at.not.is.null')
      .order('ended_at', { ascending: false })
      .limit(50);

    const nextCompletedTrips = (data || []) as Trip[];
    setCompletedTrips(nextCompletedTrips);
    completedTripsRef.current = nextCompletedTrips;
    return nextCompletedTrips;
  };

  const fetchTripLocationsByTripId = async (tripId: string) => {
    const { data } = await db
      .from('trip_locations')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true });

    if (data) {
      setTripLocations(data as TripLocation[]);
    }
  };

  const fetchActiveLocations = async (tripIdsParam?: string[]) => {
    const tripIds = tripIdsParam ?? (
      activeTripsRef.current.length > 0
        ? activeTripsRef.current.map((t) => t.id)
        : activeTrips.map((t) => t.id)
    );

    if (tripIds.length === 0) {
      setTripLocations([]);
      return;
    }

    const { data } = await db
      .from('trip_locations')
      .select('*')
      .in('trip_id', tripIds)
      .order('recorded_at', { ascending: true });

    if (data) {
      setTripLocations(data as TripLocation[]);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = db
      .channel('fleet-tracking')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_locations' }, (payload: any) => {
        const newLoc = payload.new as TripLocation;
        const curSelectedId = selectedTripIdRef.current;
        const curActiveTrips = activeTripsRef.current;
        const curTab = tabRef.current;
        const isRelevant =
          curSelectedId === newLoc.trip_id ||
          (curTab === 'live' && curActiveTrips.some((t) => t.id === newLoc.trip_id));

        if (isRelevant) {
          setTripLocations((prev) => mergeLocations(prev, [newLoc]));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, async () => {
        const [latestActive, latestCompleted] = await Promise.all([fetchActiveTrips(), fetchCompletedTrips()]);
        const currentTab = tabRef.current;
        const currentSelectedId = selectedTripIdRef.current;

        if (currentTab === 'live') {
          if (currentSelectedId) {
            await fetchTripLocationsByTripId(currentSelectedId);
          } else {
            await fetchActiveLocations(latestActive.map((trip) => trip.id));
          }
        }

        if (currentTab === 'history' && currentSelectedId && latestCompleted.some((trip) => trip.id === currentSelectedId)) {
          await fetchTripLocationsByTripId(currentSelectedId);
        }
      })
      .subscribe();

    // Polling fallback: keep live + history updated even when realtime drops on mobile
    const pollInterval = setInterval(async () => {
      if (liveSyncInProgressRef.current) return;

      liveSyncInProgressRef.current = true;
      try {
        const [latestActive, latestCompleted] = await Promise.all([fetchActiveTrips(), fetchCompletedTrips()]);
        const currentTab = tabRef.current;
        const currentSelectedId = selectedTripIdRef.current;

        if (currentTab === 'live') {
          if (currentSelectedId) {
            await fetchTripLocationsByTripId(currentSelectedId);
          } else {
            await fetchActiveLocations(latestActive.map((trip) => trip.id));
          }
        }

        if (currentTab === 'history' && currentSelectedId && latestCompleted.some((trip) => trip.id === currentSelectedId)) {
          await fetchTripLocationsByTripId(currentSelectedId);
        }
      } finally {
        liveSyncInProgressRef.current = false;
      }
    }, 10000);

    return () => {
      db.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  // Fetch GPS point counts for completed trips (for display in history list)
  const fetchTripPointCounts = async (tripIds: string[]) => {
    if (tripIds.length === 0) return;
    const counts: Record<string, number> = {};
    // Batch query: get counts for each trip
    for (const id of tripIds) {
      const { count } = await db
        .from('trip_locations')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', id);
      counts[id] = count || 0;
    }
    setTripPointCounts(prev => ({ ...prev, ...counts }));
  };

  useEffect(() => {
    if (tab === 'live') {
      if (selectedTripId) {
        fetchTripLocationsByTripId(selectedTripId);
      } else {
        fetchActiveLocations();
      }
      return;
    }

    // For history: only auto-select when no trip is selected yet
    if (tab === 'history' && !selectedTripId && completedTrips.length > 0) {
      const latestTrip = completedTrips[0];
      setSelectedTripId(latestTrip.id);
      fetchTripLocationsByTripId(latestTrip.id);
      fetchTripPointCounts(completedTrips.map(t => t.id));
    }
  }, [completedTrips, selectedTripId, tab]);

  const viewTripRoute = async (tripId: string) => {
    setSelectedTripId(tripId);
    await fetchTripLocationsByTripId(tripId);
  };

  const openNewVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm(emptyVehicle);
    setShowVehicleForm(true);
  };

  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setVehicleForm({ plate: v.plate, model: v.model, type: v.type || 'Carro', year: v.year || new Date().getFullYear() });
    setShowVehicleForm(true);
  };

  const saveVehicle = async () => {
    if (!vehicleForm.plate.trim() || !vehicleForm.model.trim()) {
      toast({ title: '⚠️ Preencha placa e modelo', variant: 'destructive' });
      return;
    }
    setSavingVehicle(true);

    const payload: any = {
      plate: vehicleForm.plate.trim().toUpperCase(),
      model: vehicleForm.model.trim(),
      year: vehicleForm.year ? Number(vehicleForm.year) : null,
    };

    if (editingVehicle) {
      const { error } = await db.from('vehicles').update(payload).eq('id', editingVehicle.id);
      if (error) {
        toast({ title: '❌ Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ Veículo atualizado!' });
        setShowVehicleForm(false);
        fetchData();
      }
    } else {
      const { error } = await db.from('vehicles').insert({ ...payload, active: true });
      if (error) {
        toast({ title: '❌ Erro ao cadastrar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ Veículo cadastrado!' });
        setShowVehicleForm(false);
        fetchData();
      }
    }
    setSavingVehicle(false);
  };

  const toggleVehicleActive = async (v: Vehicle) => {
    const { error } = await db.from('vehicles').update({ active: !v.active }).eq('id', v.id);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: v.active ? '🚫 Veículo desativado' : '✅ Veículo ativado' });
      fetchData();
    }
  };

  const getEmployeeName = (empId: string) =>
    employees.find(e => e.id === empId)?.name || 'Desconhecido';

  const getVehiclePlate = (vehId: string | null) => {
    if (!vehId) return null;
    const v = vehicles.find(v => v.id === vehId);
    return v ? `${v.plate} — ${v.model}` : null;
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const calcDuration = (start: string, end: string | null) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.round((e - s) / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const tabClass = (t: string) =>
    `px-5 py-3 rounded-xl font-bold text-sm transition-all ${tab === t ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-card text-muted-foreground hover:bg-muted'}`;

  const filteredVehicles = showInactive ? vehicles : vehicles.filter(v => v.active);

  const calculateTripScore = (tripId: string) => {
    const pts = tripPointCounts[tripId] || 0;
    if (pts === 0) return 0;
    
    // Base score 10
    let score = 10;
    
    // Check speed violations (> 80km/h)
    const tripLocs = tripLocations.filter(l => l.trip_id === tripId);
    const speedViolations = tripLocs.filter(l => l.speed && l.speed > 22.2).length;
    if (speedViolations > 0) score -= 1;
    
    // Penalize for low number of GPS points (implies tracker was off)
    if (pts < 20) score -= 2;
    
    return Math.max(0, score);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Navigation className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 overflow-auto h-full">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Navigation className="w-8 h-8 text-primary" />
            Frota - Rastreamento
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe seus motoristas em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2">
            <p className="text-xs text-primary font-bold">Viagens Ativas</p>
            <p className="text-xl font-black text-primary">{activeTrips.length}</p>
          </div>
        </div>
      </header>

      <div className="flex gap-3 flex-wrap">
        <button className={tabClass('live')} onClick={() => { setTab('live'); setSelectedTripId(null); fetchActiveLocations(); }}>
          <MapPin className="w-4 h-4 inline mr-2" />Tempo Real
        </button>
        <button
          className={tabClass('history')}
          onClick={async () => {
            setTab('history');
            setSelectedTripId(null);
            // Directly fetch completed trips and auto-load the first one's locations
            const trips = await fetchCompletedTrips();
            if (trips.length > 0) {
              setSelectedTripId(trips[0].id);
              await Promise.all([
                fetchTripLocationsByTripId(trips[0].id),
                fetchTripPointCounts(trips.map((t: Trip) => t.id)),
              ]);
            } else {
              setTripLocations([]);
            }
          }}
        >
          <Route className="w-4 h-4 inline mr-2" />Histórico
        </button>
        <button className={tabClass('fuel')} onClick={() => setTab('fuel')}>
          <Fuel className="w-4 h-4 inline mr-2" />Combustível
        </button>
        <button className={tabClass('vehicles')} onClick={() => setTab('vehicles')}>
          <Car className="w-4 h-4 inline mr-2" />Veículos
        </button>
        <button
          onClick={() => { fetchData(); if (tab === 'live') fetchActiveLocations(); }}
          className="ml-auto flex items-center gap-2 bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-3 rounded-xl font-bold text-sm transition-all"
          title="Atualizar dados agora"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {tab !== 'fuel' && tab !== 'vehicles' && (
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden" style={{ height: '450px' }}>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Navigation className="w-8 h-8 text-primary animate-spin" /></div>}>
            <FleetMap locations={tripLocations} />
          </Suspense>
        </div>
      )}

      {tab === 'live' && (
        <div className="bg-card rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Motoristas em Viagem
          </h3>
          <div className="space-y-3">
            {activeTrips.map(trip => {
              const lastLoc = tripLocations
                .filter(l => l.trip_id === trip.id)
                .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
              return (
                <div key={trip.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="font-bold text-foreground">{getEmployeeName(trip.employee_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getVehiclePlate(trip.vehicle_id) && <span className="text-primary font-bold mr-2">🚗 {getVehiclePlate(trip.vehicle_id)}</span>}
                        Início: {formatTime(trip.started_at)} • Duração: {calcDuration(trip.started_at, null)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {lastLoc && (
                      <span className="text-xs text-muted-foreground">
                        Último GPS: {formatTime(lastLoc.recorded_at)}
                      </span>
                    )}
                    <button
                      onClick={() => viewTripRoute(trip.id)}
                      className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" /> Ver Rota
                    </button>
                  </div>
                </div>
              );
            })}
            {activeTrips.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhum motorista em viagem no momento</p>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-card rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Histórico de Viagens
          </h3>
          <div className="space-y-2 max-h-80 overflow-auto">
            {completedTrips.map(trip => (
              <div key={trip.id} className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${selectedTripId === trip.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted hover:bg-muted/80'
                }`}
                onClick={() => viewTripRoute(trip.id)}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-bold text-foreground">{getEmployeeName(trip.employee_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getVehiclePlate(trip.vehicle_id) && <span className="text-primary font-bold mr-1">🚗 {getVehiclePlate(trip.vehicle_id)} • </span>}
                      {formatTime(trip.started_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {tripPointCounts[trip.id] ?? '…'} pts
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {calcDuration(trip.started_at, trip.ended_at)}
                  </span>
                  <div className="flex items-center gap-1 bg-background px-2 py-1 rounded-lg border border-primary/20">
                    <Star className={`w-3 h-3 ${calculateTripScore(trip.id) >= 7 ? 'text-amber-500 fill-amber-500' : 'text-red-500 fill-red-500'}`} />
                    <span className="text-xs font-black">{calculateTripScore(trip.id).toFixed(1)}</span>
                  </div>
                  <Eye className="w-4 h-4 text-primary" />
                </div>
              </div>
            ))}
            {completedTrips.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhuma viagem registrada</p>
            )}
          </div>
        </div>
      )}

      {tab === 'fuel' && (
        <Suspense fallback={<div className="flex items-center justify-center h-32"><Fuel className="w-6 h-6 text-orange-500 animate-spin" /></div>}>
          <FuelAdminPanel />
        </Suspense>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                Veículos da Frota
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({filteredVehicles.length} {showInactive ? 'total' : 'ativos'})
                </span>
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {showInactive ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                  Ver inativos
                </button>
                <button
                  onClick={openNewVehicle}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Novo Veículo
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredVehicles.map(v => (
                <div key={v.id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${v.active ? 'bg-muted border-transparent' : 'bg-muted/40 border-dashed border-gray-300 opacity-60'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${v.active ? 'bg-primary/10' : 'bg-gray-200'}`}>
                      <Car className={`w-5 h-5 ${v.active ? 'text-primary' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{v.model}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono bg-background px-1.5 py-0.5 rounded text-xs mr-2">{v.plate}</span>
                        {v.type && <span className="mr-2">{v.type}</span>}
                        {v.year && <span>{v.year}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!v.active && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Inativo</span>
                    )}
                    <button
                      onClick={() => openEditVehicle(v)}
                      className="p-2 hover:bg-background rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleVehicleActive(v)}
                      className={`p-2 rounded-lg transition-colors text-sm font-medium ${v.active ? 'hover:bg-red-50 text-red-500 hover:text-red-700' : 'hover:bg-green-50 text-green-600 hover:text-green-800'}`}
                      title={v.active ? 'Desativar' : 'Ativar'}
                    >
                      {v.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
              {filteredVehicles.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum veículo cadastrado</p>
                  <button onClick={openNewVehicle} className="mt-3 text-primary font-bold hover:underline text-sm">
                    Cadastrar primeiro veículo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h3>
              <button onClick={() => setShowVehicleForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Placa *</label>
                <input
                  type="text"
                  value={vehicleForm.plate}
                  onChange={e => setVehicleForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                  placeholder="ABC-1234"
                  maxLength={8}
                  className="w-full border border-input rounded-lg p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Modelo *</label>
                <input
                  type="text"
                  value={vehicleForm.model}
                  onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Ex: Fiat Fiorino, Mercedes Sprinter..."
                  className="w-full border border-input rounded-lg p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
                  <select
                    value={vehicleForm.type}
                    onChange={e => setVehicleForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-input rounded-lg p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Ano</label>
                  <input
                    type="number"
                    value={vehicleForm.year}
                    onChange={e => setVehicleForm(f => ({ ...f, year: Number(e.target.value) }))}
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    className="w-full border border-input rounded-lg p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowVehicleForm(false)}
                className="flex-1 border border-input rounded-xl py-2.5 font-medium text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveVehicle}
                disabled={savingVehicle}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {savingVehicle ? 'Salvando...' : editingVehicle ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
