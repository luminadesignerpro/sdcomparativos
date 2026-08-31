import React, { useState, useEffect } from 'react';
import {
  Clock, Play, Square, Coffee, MapPin, Calendar, ChevronRight,
  User, CheckCircle, AlertCircle, TrendingUp, Timer, Sun, Moon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PunchRecord {
  id: string;
  date: string;
  entrada: string;
  almoco_saida: string;
  almoco_retorno: string;
  saida: string;
  total: string;
  status: 'completo' | 'incompleto' | 'falta';
}

interface Employee {
  id: string;
  name: string;
  role: string;
  avatar: string;
  todayStatus: 'working' | 'break' | 'off' | 'absent';
  entryTime: string;
  totalHours: string;
}

const PUNCH_HISTORY: PunchRecord[] = [
  { id: '1', date: '23/02/2026', entrada: '07:30', almoco_saida: '12:00', almoco_retorno: '13:00', saida: '17:30', total: '09:00', status: 'completo' },
  { id: '2', date: '22/02/2026', entrada: '07:45', almoco_saida: '12:00', almoco_retorno: '13:15', saida: '17:45', total: '08:45', status: 'completo' },
  { id: '3', date: '21/02/2026', entrada: '08:00', almoco_saida: '12:00', almoco_retorno: '13:00', saida: '17:00', total: '08:00', status: 'completo' },
  { id: '4', date: '20/02/2026', entrada: '07:30', almoco_saida: '12:00', almoco_retorno: '13:00', saida: '', total: '', status: 'incompleto' },
  { id: '5', date: '19/02/2026', entrada: '', almoco_saida: '', almoco_retorno: '', saida: '', total: '', status: 'falta' },
];

const EMPLOYEES: Employee[] = [
  { id: '1', name: 'João Silva', role: 'Marceneiro', avatar: '👷', todayStatus: 'working', entryTime: '07:30', totalHours: '06:45' },
  { id: '2', name: 'Pedro Santos', role: 'Instalador', avatar: '🔧', todayStatus: 'break', entryTime: '07:45', totalHours: '04:15' },
  { id: '3', name: 'Maria Oliveira', role: 'Projetista', avatar: '👩‍💻', todayStatus: 'working', entryTime: '08:00', totalHours: '06:00' },
  { id: '4', name: 'Lucas Costa', role: 'Auxiliar', avatar: '👨‍🔧', todayStatus: 'off', entryTime: '-', totalHours: '00:00' },
  { id: '5', name: 'Ana Ferreira', role: 'Administrativa', avatar: '👩‍💼', todayStatus: 'working', entryTime: '08:15', totalHours: '05:45' },
  { id: '6', name: 'Carlos Mendes', role: 'Motorista', avatar: '🚛', todayStatus: 'absent', entryTime: '-', totalHours: '00:00' },
];

interface TimeTrackingProps {
  isEmployee?: boolean;
  employeeName?: string;
}

const TimeTracking: React.FC<TimeTrackingProps> = ({ isEmployee = false, employeeName = '' }) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [punchState, setPunchState] = useState<'idle' | 'working' | 'break' | 'done'>('idle');
  const [punchTimes, setPunchTimes] = useState<{ entrada?: string; almoco_saida?: string; almoco_retorno?: string; saida?: string }>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const handlePunch = () => {
    const time = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (punchState === 'idle') {
      setPunchTimes({ entrada: time });
      setPunchState('working');
      toast({ title: '✅ Entrada registrada', description: `Entrada às ${time}` });
    } else if (punchState === 'working' && !punchTimes.almoco_saida) {
      setPunchTimes(prev => ({ ...prev, almoco_saida: time }));
      setPunchState('break');
      toast({ title: '🍽️ Saída para almoço', description: `Saída almoço às ${time}` });
    } else if (punchState === 'break') {
      setPunchTimes(prev => ({ ...prev, almoco_retorno: time }));
      setPunchState('working');
      toast({ title: '✅ Retorno do almoço', description: `Retorno às ${time}` });
    } else if (punchState === 'working' && punchTimes.almoco_retorno) {
      setPunchTimes(prev => ({ ...prev, saida: time }));
      setPunchState('done');
      toast({ title: '🏠 Saída registrada', description: `Saída às ${time}. Bom descanso!` });
    }
  };

  const getPunchLabel = () => {
    if (punchState === 'idle') return 'Registrar Entrada';
    if (punchState === 'working' && !punchTimes.almoco_saida) return 'Saída Almoço';
    if (punchState === 'break') return 'Retorno Almoço';
    if (punchState === 'working') return 'Registrar Saída';
    return 'Ponto Concluído ✓';
  };

  const getPunchIcon = () => {
    if (punchState === 'idle') return <Play className="w-8 h-8" />;
    if (punchState === 'break') return <Coffee className="w-8 h-8" />;
    if (punchState === 'done') return <CheckCircle className="w-8 h-8" />;
    return <Square className="w-8 h-8" />;
  };

  const statusInfo: Record<string, { color: string; label: string }> = {
    working: { color: 'text-green-600', label: '🟢 Trabalhando' },
    break: { color: 'text-amber-600', label: '🍽️ Almoço' },
    off: { color: 'text-gray-400', label: '⬜ Folga' },
    absent: { color: 'text-red-600', label: '🔴 Ausente' },
  };

  // Employee view
  if (isEmployee) {
    return (
      <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" /> Meu Ponto
          </h1>
          <p className="text-gray-500 mt-1">Olá, {employeeName || 'Funcionário'}! • {formatDate(currentTime)}</p>
        </header>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Clock Card */}
          <div className="col-span-1 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white text-center shadow-xl">
            <p className="text-5xl font-black tracking-wider font-mono">{formatTime(currentTime)}</p>
            <p className="text-gray-400 mt-2 text-sm capitalize">{formatDate(currentTime)}</p>
            <button
              onClick={handlePunch}
              disabled={punchState === 'done'}
              className={`mt-8 w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                punchState === 'done' ? 'bg-green-600 cursor-default' :
                punchState === 'break' ? 'bg-amber-500 hover:bg-amber-400 text-black' :
                'bg-amber-600 hover:bg-amber-500 text-white hover:scale-105'
              }`}
            >
              {getPunchIcon()} {getPunchLabel()}
            </button>
          </div>

          {/* Today's Punches */}
          <div className="col-span-2 bg-white rounded-3xl p-8 shadow-xl">
            <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2"><Timer className="w-5 h-5 text-amber-500" /> Registros de Hoje</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Entrada', icon: <Sun className="w-5 h-5 text-amber-500" />, time: punchTimes.entrada },
                { label: 'Saída Almoço', icon: <Coffee className="w-5 h-5 text-amber-600" />, time: punchTimes.almoco_saida },
                { label: 'Retorno', icon: <Coffee className="w-5 h-5 text-green-500" />, time: punchTimes.almoco_retorno },
                { label: 'Saída', icon: <Moon className="w-5 h-5 text-blue-500" />, time: punchTimes.saida },
              ].map((p, i) => (
                <div key={i} className={`p-4 rounded-2xl text-center ${p.time ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex justify-center mb-2">{p.icon}</div>
                  <p className="text-xs text-gray-500 font-bold uppercase">{p.label}</p>
                  <p className={`text-2xl font-black mt-1 ${p.time ? 'text-green-600' : 'text-gray-300'}`}>{p.time || '--:--'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="font-black text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-amber-500" /> Histórico de Ponto</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Data</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Entrada</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Saída Almoço</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Retorno</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Saída</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Total</th>
                <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {PUNCH_HISTORY.map(record => (
                <tr key={record.id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900">{record.date}</td>
                  <td className="p-4 text-gray-600">{record.entrada || '-'}</td>
                  <td className="p-4 text-gray-600">{record.almoco_saida || '-'}</td>
                  <td className="p-4 text-gray-600">{record.almoco_retorno || '-'}</td>
                  <td className="p-4 text-gray-600">{record.saida || '-'}</td>
                  <td className="p-4 font-bold text-gray-900">{record.total || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      record.status === 'completo' ? 'bg-green-100 text-green-700' :
                      record.status === 'incompleto' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {record.status === 'completo' ? '✅ Completo' : record.status === 'incompleto' ? '⚠️ Incompleto' : '❌ Falta'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Admin view
  return (
    <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3"><Clock className="w-8 h-8 text-amber-500" /> Controle de Ponto</h1>
          <p className="text-gray-500 mt-1">{formatDate(currentTime)}</p>
        </div>
        <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-mono text-2xl font-black">
          {formatTime(currentTime)}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Presentes</p><p className="text-2xl font-black text-green-600 mt-1">{EMPLOYEES.filter(e => e.todayStatus === 'working').length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">No Almoço</p><p className="text-2xl font-black text-amber-600 mt-1">{EMPLOYEES.filter(e => e.todayStatus === 'break').length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Folga</p><p className="text-2xl font-black text-gray-400 mt-1">{EMPLOYEES.filter(e => e.todayStatus === 'off').length}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-lg"><p className="text-xs text-gray-500 uppercase font-bold">Ausentes</p><p className="text-2xl font-black text-red-600 mt-1">{EMPLOYEES.filter(e => e.todayStatus === 'absent').length}</p></div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="font-black text-gray-900 flex items-center gap-2"><User className="w-5 h-5 text-amber-500" /> Funcionários Hoje</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Funcionário</th>
              <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Cargo</th>
              <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Entrada</th>
              <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Horas Hoje</th>
              <th className="text-left p-4 text-xs font-black text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {EMPLOYEES.map(emp => (
              <tr key={emp.id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{emp.avatar}</span>
                  <span className="font-bold text-gray-900">{emp.name}</span>
                </td>
                <td className="p-4 text-gray-600">{emp.role}</td>
                <td className="p-4 font-mono font-bold text-gray-900">{emp.entryTime}</td>
                <td className="p-4 font-mono font-bold text-gray-900">{emp.totalHours}</td>
                <td className="p-4">
                  <span className={`font-bold text-sm ${statusInfo[emp.todayStatus].color}`}>
                    {statusInfo[emp.todayStatus].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimeTracking;
