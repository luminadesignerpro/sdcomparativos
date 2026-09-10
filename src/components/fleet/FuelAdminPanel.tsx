import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Fuel, TrendingUp, Droplets, AlertTriangle, CheckCircle } from 'lucide-react';

const db = supabase as any;

interface FuelLog {
  id: string;
  employee_id: string;
  vehicle_id: string;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  odometer: number | null;
  notes: string | null;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
}

interface TripWithLocations {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  gpsKm: number;
  odometer: number | null;
  estimatedKm: number;
  desvio: number;
}

const SEDE_LAT = -3.7389;
const SEDE_LON = -38.5897;
const ESTIMATED_ROUTE_KM = 62.8;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function FuelAdminPanel() {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trips, setTrips] = useState<TripWithLocations[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [logsRes, empRes, tripsRes] = await Promise.all([
      db.from('fuel_logs').select('*').order('created_at', { ascending: false }),
      db.from('employees').select('id, name').eq('active', true),
      db.from('trips').select('*').eq('status', 'completed').order('ended_at', { ascending: false }).limit(50),
    ]);

    if (empRes.data) setEmployees(empRes.data);
    if (logsRes.data) setLogs(logsRes.data);

    // Calculate GPS distances for trips
    if (tripsRes.data) {
      const tripIds = tripsRes.data.map((t: any) => t.id);
      const { data: allLocs } = await db
        .from('trip_locations')
        .select('*')
        .in('trip_id', tripIds)
        .order('recorded_at', { ascending: true });

      const locsByTrip = (allLocs || []).reduce((acc: any, loc: any) => {
        if (!acc[loc.trip_id]) acc[loc.trip_id] = [];
        acc[loc.trip_id].push(loc);
        return acc;
      }, {});

      const enriched = tripsRes.data.map((trip: any) => {
        const locs = locsByTrip[trip.id] || [];
        let gpsKm = 0;
        for (let i = 1; i < locs.length; i++) {
          gpsKm += haversineDistance(locs[i - 1].latitude, locs[i - 1].longitude, locs[i].latitude, locs[i].longitude);
        }
        const desvio = ESTIMATED_ROUTE_KM > 0 ? ((gpsKm - ESTIMATED_ROUTE_KM) / ESTIMATED_ROUTE_KM) * 100 : 0;
        return { ...trip, gpsKm, estimatedKm: ESTIMATED_ROUTE_KM, desvio, odometer: null };
      });
      setTrips(enriched);
    }
    setLoading(false);
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || '—';

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.employee_id === filter);

  const totalGasto = filteredLogs.reduce((s, l) => s + Number(l.total_cost), 0);
  const totalLitros = filteredLogs.reduce((s, l) => s + Number(l.liters), 0);

  // Calculate avg KM/L from odometer readings
  const sortedLogs = [...filteredLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  let avgKmL = 0;
  if (sortedLogs.length >= 2) {
    const first = sortedLogs[0];
    const last = sortedLogs[sortedLogs.length - 1];
    if (first.odometer && last.odometer) {
      const kmDriven = Number(last.odometer) - Number(first.odometer);
      const litersUsed = sortedLogs.slice(1).reduce((s, l) => s + Number(l.liters), 0);
      if (litersUsed > 0) avgKmL = kmDriven / litersUsed;
    }
  }

  const alerts = trips.filter(t => t.desvio > 15).length;

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Fuel className="w-6 h-6 text-orange-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Fuel className="w-6 h-6 text-orange-500" /> Gestão de Abastecimento
          </h2>
          <p className="text-muted-foreground text-sm">Controle de combustível e eficiência</p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-bold"
        >
          <option value="all">Todos Motoristas</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-600 uppercase">Total Gasto</p>
          <p className="text-xl font-black text-red-700">R$ {totalGasto.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-600 uppercase">Total Litros</p>
          <p className="text-xl font-black text-blue-700">{totalLitros.toFixed(1)} L</p>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-600 uppercase">Média KM/L</p>
          <p className="text-xl font-black text-green-700">{avgKmL > 0 ? avgKmL.toFixed(1) : '—'}</p>
        </div>
        <div className="bg-card border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-600 uppercase">Alertas</p>
          <p className="text-xl font-black text-amber-700 flex items-center gap-1">
            <CheckCircle className="w-5 h-5 text-green-500" /> {alerts}
          </p>
        </div>
      </div>

      {/* Fuel History Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Histórico de Abastecimentos ({filteredLogs.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-bold text-muted-foreground">Motorista</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">KM</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">Litros</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">R$</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">KM/L</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">{new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                  <td className="px-4 py-3 font-bold">{getEmployeeName(log.employee_id)}</td>
                  <td className="px-4 py-3 text-right">{log.odometer ? Number(log.odometer).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(log.liters).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-bold">R$ {Number(log.total_cost).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right">—</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum abastecimento registrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Route Comparison */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" /> Comparativo: Rota Real vs Estimada (Sede ↔ Destino)
          </h3>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${alerts === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {alerts === 0 ? '✅ Sem desvios' : `⚠️ ${alerts} desvio(s)`}
          </span>
        </div>
        <p className="px-4 pt-2 text-xs text-muted-foreground">
          Sede: Rua Jorge Figueiredo 740, Itaitinga-CE · Alerta se rota real {'>'} 15% da estimada
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-bold text-muted-foreground">Motorista</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">GPS (km)</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">Odômetro</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">Estimada</th>
                <th className="px-4 py-3 text-right font-bold text-muted-foreground">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(trip => (
                <tr key={trip.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">{new Date(trip.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                  <td className="px-4 py-3 font-bold">{getEmployeeName(trip.employee_id)}</td>
                  <td className="px-4 py-3 text-right">{trip.gpsKm.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">{trip.odometer ? Number(trip.odometer).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{trip.estimatedKm.toFixed(1)} km</td>
                  <td className={`px-4 py-3 text-right font-bold ${trip.desvio > 15 ? 'text-red-600' : trip.desvio < -50 ? 'text-red-500' : 'text-green-600'}`}>
                    {trip.desvio > 0 ? '+' : ''}{trip.desvio.toFixed(0)}%
                  </td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma viagem completada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
