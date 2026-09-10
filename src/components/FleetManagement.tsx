import React, { useState } from 'react';
import {
  Truck, MapPin, Fuel, Calendar, Clock, AlertTriangle,
  CheckCircle, Navigation, Plus, Eye, Wrench, Route,
  Car, Gauge,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: string;
  status: 'available' | 'in_use' | 'maintenance';
  km: number;
  fuel: number;
  driver: string;
  lastTrip: string;
}

interface Trip {
  id: string;
  vehicle: string;
  driver: string;
  origin: string;
  destination: string;
  date: string;
  kmStart: number;
  kmEnd: number;
  purpose: string;
  status: 'completed' | 'in_progress' | 'scheduled';
}

const VEHICLES: Vehicle[] = [
  { id: '1', plate: 'ABC-1234', model: 'Fiorino Furgão', type: '🚐', status: 'in_use', km: 45230, fuel: 65, driver: 'Carlos Mendes', lastTrip: '23/02/2026' },
  { id: '2', plate: 'DEF-5678', model: 'HR Baú', type: '🚛', status: 'available', km: 78450, fuel: 80, driver: '-', lastTrip: '22/02/2026' },
  { id: '3', plate: 'GHI-9012', model: 'Saveiro CE', type: '🛻', status: 'maintenance', km: 120300, fuel: 30, driver: '-', lastTrip: '20/02/2026' },
  { id: '4', plate: 'JKL-3456', model: 'Sprinter Baú', type: '🚐', status: 'available', km: 35600, fuel: 90, driver: '-', lastTrip: '21/02/2026' },
];

const TRIPS: Trip[] = [
  { id: '1', vehicle: 'ABC-1234', driver: 'Carlos Mendes', origin: 'Fábrica SD', destination: 'Cliente - Ricardo Almeida', date: '23/02/2026', kmStart: 45200, kmEnd: 45230, purpose: 'Instalação cozinha', status: 'in_progress' },
  { id: '2', vehicle: 'DEF-5678', driver: 'Pedro Santos', origin: 'Fábrica SD', destination: 'Fornecedor MDF Plus', date: '22/02/2026', kmStart: 78400, kmEnd: 78450, purpose: 'Buscar material', status: 'completed' },
  { id: '3', vehicle: 'ABC-1234', driver: 'Carlos Mendes', origin: 'Fábrica SD', destination: 'Cliente - Juliana Silva', date: '24/02/2026', kmStart: 0, kmEnd: 0, purpose: 'Entrega + instalação', status: 'scheduled' },
  { id: '4', vehicle: 'GHI-9012', driver: 'João Silva', origin: 'Fábrica SD', destination: 'Loja de Ferragens Central', date: '20/02/2026', kmStart: 120250, kmEnd: 120300, purpose: 'Compra de ferragens', status: 'completed' },
];

interface FleetManagementProps {
  isEmployee?: boolean;
}

const FleetManagement: React.FC<FleetManagementProps> = ({ isEmployee = false }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'trips'>('vehicles');

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    available: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Disponível' },
    in_use: { bg: 'bg-blue-100', text: 'text-blue-700', label: '🚗 Em Uso' },
    maintenance: { bg: 'bg-red-100', text: 'text-red-700', label: '🔧 Manutenção' },
  };

  const tripStatusColors: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Concluída' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: '🚗 Em Andamento' },
    scheduled: { bg: 'bg-amber-100', text: 'text-amber-700', label: '📅 Agendada' },
  };

  if (isEmployee) {
    const myTrips = TRIPS.filter(t => t.driver === 'Carlos Mendes' || t.driver === 'Pedro Santos');
    return (
      <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3"><Navigation className="w-8 h-8 text-amber-500" /> Minhas Viagens</h1>
          <p className="text-gray-500 mt-1">Registro de deslocamentos e entregas</p>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Viagens Este Mês</p><p className="text-2xl font-black text-gray-900 mt-1">12</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">KM Rodados</p><p className="text-2xl font-black text-blue-600 mt-1">580 km</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Próxima Viagem</p><p className="text-2xl font-black text-amber-600 mt-1">24/02</p></div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="font-black text-gray-900 flex items-center gap-2"><Route className="w-5 h-5 text-amber-500" /> Histórico de Viagens</h3>
          </div>
          <div className="p-6 space-y-4">
            {myTrips.map(trip => (
              <div key={trip.id} className="bg-gray-50 rounded-2xl p-5 border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{trip.purpose}</p>
                    <p className="text-sm text-gray-500">{trip.date} • {trip.vehicle}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${tripStatusColors[trip.status].bg} ${tripStatusColors[trip.status].text}`}>
                    {tripStatusColors[trip.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span>{trip.origin}</span>
                  <span className="text-gray-400">→</span>
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span>{trip.destination}</span>
                </div>
                {trip.kmEnd > 0 && (
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Gauge className="w-3 h-3" /> {trip.kmEnd - trip.kmStart} km percorridos</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3"><Truck className="w-8 h-8 text-amber-500" /> Gestão de Frota</h1>
          <p className="text-gray-500 mt-1">Controle de veículos e viagens</p>
        </div>
        <button className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-lg">
          <Plus className="w-5 h-5" /> Nova Viagem
        </button>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Total Veículos</p><p className="text-2xl font-black text-gray-900 mt-1">{VEHICLES.length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Disponíveis</p><p className="text-2xl font-black text-green-600 mt-1">{VEHICLES.filter(v => v.status === 'available').length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Em Uso</p><p className="text-2xl font-black text-blue-600 mt-1">{VEHICLES.filter(v => v.status === 'in_use').length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Manutenção</p><p className="text-2xl font-black text-red-600 mt-1">{VEHICLES.filter(v => v.status === 'maintenance').length}</p></div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={() => setActiveTab('vehicles')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'vehicles' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          <Car className="w-4 h-4 inline mr-2" /> Veículos
        </button>
        <button onClick={() => setActiveTab('trips')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${activeTab === 'trips' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          <Route className="w-4 h-4 inline mr-2" /> Viagens
        </button>
      </div>

      {activeTab === 'vehicles' ? (
        <div className="grid grid-cols-2 gap-6">
          {VEHICLES.map(vehicle => (
            <div key={vehicle.id} className="bg-white rounded-3xl p-6 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{vehicle.type}</span>
                  <div>
                    <p className="font-black text-gray-900">{vehicle.model}</p>
                    <p className="text-sm text-gray-500 font-mono">{vehicle.plate}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[vehicle.status].bg} ${statusColors[vehicle.status].text}`}>
                  {statusColors[vehicle.status].label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl text-center">
                  <Gauge className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">KM</p>
                  <p className="font-bold text-gray-900 text-sm">{vehicle.km.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl text-center">
                  <Fuel className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Combust.</p>
                  <p className={`font-bold text-sm ${vehicle.fuel > 50 ? 'text-green-600' : vehicle.fuel > 25 ? 'text-amber-600' : 'text-red-600'}`}>{vehicle.fuel}%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl text-center">
                  <Calendar className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Última</p>
                  <p className="font-bold text-gray-900 text-sm">{vehicle.lastTrip}</p>
                </div>
              </div>
              {vehicle.driver !== '-' && (
                <p className="mt-3 text-sm text-gray-500 flex items-center gap-1"><Car className="w-3 h-3" /> Motorista: <span className="font-bold text-gray-700">{vehicle.driver}</span></p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Viagem</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Veículo</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Motorista</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Rota</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">KM</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {TRIPS.map(trip => (
                <tr key={trip.id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{trip.purpose}</p>
                    <p className="text-xs text-gray-500">{trip.date}</p>
                  </td>
                  <td className="p-4 font-mono text-gray-600">{trip.vehicle}</td>
                  <td className="p-4 text-gray-600">{trip.driver}</td>
                  <td className="p-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" /> {trip.origin}</span>
                    <span className="flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-red-500" /> {trip.destination}</span>
                  </td>
                  <td className="p-4 font-bold text-gray-900">{trip.kmEnd > 0 ? `${trip.kmEnd - trip.kmStart} km` : '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${tripStatusColors[trip.status].bg} ${tripStatusColors[trip.status].text}`}>
                      {tripStatusColors[trip.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FleetManagement;
