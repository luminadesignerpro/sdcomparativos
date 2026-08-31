import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, UserPlus, Play, Square, Calendar, DollarSign, Users, Trash2, Edit2, Save, X, Plus, Minus, MessageCircle, Mail, Key, Eye, EyeOff, UserX
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  hourly_rate: number;
  active: boolean;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
}

interface Adjustment {
  id: string;
  employee_id: string;
  type: 'overtime' | 'advance' | 'fuel_allowance' | 'meal_allowance' | 'absence';
  description: string | null;
  amount: number;
  hours: number;
  reference_date: string;
  created_at: string;
}

type Period = 'week' | 'biweekly' | 'month';

export default function TimeTrackingPanel() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [tab, setTab] = useState<'ponto' | 'funcionarios' | 'relatorio'>('ponto');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [hourlyRate, setHourlyRate] = useState('15.00');
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);

  // Change password modal
  const [passwordEmp, setPasswordEmp] = useState<Employee | null>(null);
  const [changePassword, setChangePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Adjustment form
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjEmployeeId, setAdjEmployeeId] = useState('');
  const [adjType, setAdjType] = useState<'overtime' | 'advance' | 'fuel_allowance' | 'meal_allowance' | 'absence'>('overtime');
  const [adjDescription, setAdjDescription] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjHours, setAdjHours] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [empRes, teRes, adjRes] = await Promise.all([
      supabase.from('employees').select('*').eq('active', true).order('name'),
      supabase.from('time_entries').select('*').order('clock_in', { ascending: false }).limit(500),
      supabase.from('employee_adjustments').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (teRes.data) setTimeEntries(teRes.data);
    if (adjRes.data) setAdjustments(adjRes.data as Adjustment[]);
    setLoading(false);
  };

  const addEmployee = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('employees').insert({
      name: newName.trim(),
      role: newRole.trim() || null,
      phone: newPhone.trim() || null,
      hourly_rate: parseFloat(hourlyRate) || 15,
      email: newEmail.trim() || null,
      password: newPassword.trim() || null,
    });
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Funcionário adicionado' });
      setNewName(''); setNewRole(''); setNewPhone(''); setNewEmail(''); setNewPassword('');
      fetchData();
    }
  };

  const removeEmployee = async (id: string) => {
    await supabase.from('employees').update({ active: false }).eq('id', id);
    toast({ title: '🗑️ Funcionário desativado' });
    fetchData();
  };

  const handleChangePassword = async () => {
    if (!passwordEmp || changePassword.length < 4) {
      toast({ title: '⚠️ Senha deve ter pelo menos 4 caracteres', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.from('employees').update({ password: changePassword }).eq('id', passwordEmp.id);
    setSavingPassword(false);
    if (error) {
      toast({ title: '❌ Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Senha alterada!', description: `Senha de ${passwordEmp.name} atualizada.` });
      setPasswordEmp(null);
      setChangePassword('');
    }
  };

  const clockIn = async (employeeId: string) => {
    const { error } = await supabase.from('time_entries').insert({
      employee_id: employeeId,
    });
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Entrada registrada!' });
      fetchData();
    }
  };

  const clockOut = async (entryId: string) => {
    const { error } = await supabase.from('time_entries').update({
      clock_out: new Date().toISOString(),
    }).eq('id', entryId);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Saída registrada!' });
      fetchData();
    }
  };

  const registerAbsence = async (emp: Employee) => {
    const today = new Date().toISOString().split('T')[0];
    if (!confirm(`Registrar falta de ${emp.name} para hoje (${new Date().toLocaleDateString('pt-BR')})?`)) return;
    const { error } = await supabase.from('employee_adjustments').insert({
      employee_id: emp.id,
      type: 'absence',
      description: `Falta registrada em ${new Date().toLocaleDateString('pt-BR')}`,
      amount: 0,
      hours: 0,
      reference_date: today,
    });
    if (error) {
      toast({ title: '❌ Erro ao registrar falta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '📋 Falta registrada!', description: `Falta de ${emp.name} anotada para hoje.` });
      fetchData();
    }
  };

  const getOpenEntry = (employeeId: string) =>
    timeEntries.find(e => e.employee_id === employeeId && !e.clock_out);

  const getPeriodDates = (): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    if (period === 'week') start.setDate(now.getDate() - 7);
    else if (period === 'biweekly') start.setDate(now.getDate() - 15);
    else start.setDate(now.getDate() - 30);
    return { start, end };
  };

  const calcHours = (employeeId: string): number => {
    const { start, end } = getPeriodDates();
    return timeEntries
      .filter(e => e.employee_id === employeeId && e.clock_out)
      .filter(e => new Date(e.clock_in) >= start && new Date(e.clock_in) <= end)
      .reduce((sum, e) => {
        const clockInTime = new Date(e.clock_in).getTime();
        const clockOutTime = new Date(e.clock_out!).getTime();
        let diff = (clockOutTime - clockInTime) / 3600000;

        const lunchStart = new Date(e.clock_in);
        lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(e.clock_in);
        lunchEnd.setHours(13, 30, 0, 0);

        const overlapStart = Math.max(clockInTime, lunchStart.getTime());
        const overlapEnd = Math.min(clockOutTime, lunchEnd.getTime());

        if (overlapEnd > overlapStart) {
          diff -= (overlapEnd - overlapStart) / 3600000;
        }

        return sum + diff;
      }, 0);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const toHHMM = (decimalHours: number) => {
    const h = Math.floor(Math.abs(decimalHours));
    const m = Math.round((Math.abs(decimalHours) - h) * 60);
    return `${decimalHours < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const tabClass = (t: string) =>
    `px-6 py-3 rounded-xl font-bold text-sm transition-all ${tab === t ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`;

  const getEmployeeAdjustments = (employeeId: string) => {
    const { start, end } = getPeriodDates();
    return adjustments.filter(a =>
      a.employee_id === employeeId &&
      new Date(a.reference_date) >= start &&
      new Date(a.reference_date) <= end
    );
  };

  const calcOvertime = (employeeId: string) => {
    return getEmployeeAdjustments(employeeId).filter(a => a.type === 'overtime').reduce((sum, a) => sum + Number(a.amount), 0);
  };

  const calcDeductions = (employeeId: string) => {
    return getEmployeeAdjustments(employeeId).filter(a => a.type === 'advance').reduce((sum, a) => sum + Number(a.amount), 0);
  };

  const calcFuelAllowance = (employeeId: string) => {
    return getEmployeeAdjustments(employeeId).filter(a => a.type === 'fuel_allowance').reduce((sum, a) => sum + Number(a.amount), 0);
  };

  const calcMealAllowance = (employeeId: string) => {
    return getEmployeeAdjustments(employeeId).filter(a => a.type === 'meal_allowance').reduce((sum, a) => sum + Number(a.amount), 0);
  };

  const addAdjustment = async () => {
    if (!adjEmployeeId || !adjAmount) {
      toast({ title: '⚠️ Preencha os campos', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('employee_adjustments').insert({
      employee_id: adjEmployeeId,
      type: adjType,
      description: adjDescription.trim() || null,
      amount: parseFloat(adjAmount) || 0,
      hours: parseFloat(adjHours) || 0,
      reference_date: new Date().toISOString().split('T')[0],
    });
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Lançamento adicionado!' });
      setShowAdjForm(false);
      setAdjDescription('');
      setAdjAmount('');
      setAdjHours('');
      fetchData();
    }
  };

  const deleteAdjustment = async (id: string) => {
    await supabase.from('employee_adjustments').delete().eq('id', id);
    toast({ title: '🗑️ Lançamento removido' });
    fetchData();
  };

  const buildPayslipText = (emp: Employee) => {
    const rawHours = calcHours(emp.id);
    const hours = Math.round(rawHours * 100) / 100;
    const base = hours * emp.hourly_rate;
    const overtime = calcOvertime(emp.id);
    const fuelAllowance = calcFuelAllowance(emp.id);
    const deductions = calcDeductions(emp.id);
    const total = base + overtime + fuelAllowance - deductions;
    const periodLabel = period === 'week' ? 'Semana' : period === 'biweekly' ? 'Quinzena' : 'Mês';
    return `*SD Móveis Projetados - Contracheque*\n\n` +
      `👤 *${emp.name}*\n` +
      `📋 Cargo: ${emp.role || '-'}\n` +
      `📅 Período: ${periodLabel}\n\n` +
      `⏱ Horas trabalhadas: ${hours.toFixed(2)}h (${toHHMM(hours)})\n` +
      `💰 Valor/hora: R$ ${emp.hourly_rate.toFixed(2)}\n` +
      `💵 Base: R$ ${base.toFixed(2)}\n` +
      (overtime > 0 ? `✅ Horas Extra: +R$ ${overtime.toFixed(2)}\n` : '') +
      (fuelAllowance > 0 ? `⛽ Vale Combustível: +R$ ${fuelAllowance.toFixed(2)}\n` : '') +
      (deductions > 0 ? `❌ Adiantamentos: -R$ ${deductions.toFixed(2)}\n` : '') +
      `\n*💰 Total Líquido: R$ ${total.toFixed(2)}*`;
  };

  const sendViaWhatsApp = (emp: Employee) => {
    if (!emp.phone) {
      toast({ title: '⚠️ Sem telefone', description: `${emp.name} não tem telefone cadastrado.`, variant: 'destructive' });
      return;
    }
    const phone = emp.phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const text = encodeURIComponent(buildPayslipText(emp));
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  const sendViaEmail = (emp: Employee) => {
    const periodLabel = period === 'week' ? 'Semana' : period === 'biweekly' ? 'Quinzena' : 'Mês';
    const subject = encodeURIComponent(`Contracheque - ${periodLabel} - SD Móveis Projetados`);
    const body = encodeURIComponent(buildPayslipText(emp).replace(/\*/g, ''));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast({ title: '📧 Email', description: 'Cliente de e-mail aberto. Adicione o destinatário.' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Clock className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-y-auto overflow-x-hidden h-full bg-gradient-to-br from-gray-50 to-gray-100 w-full">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            Ponto Eletrônico
          </h1>
          <p className="text-gray-500 mt-1">Controle de jornada dos funcionários</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-3 pb-2 w-full">
        <button className={`shrink-0 ${tabClass('ponto')}`} onClick={() => setTab('ponto')}>
          <Play className="w-4 h-4 inline mr-2" />Registrar Ponto
        </button>
        <button className={`shrink-0 ${tabClass('funcionarios')}`} onClick={() => setTab('funcionarios')}>
          <Users className="w-4 h-4 inline mr-2" />Funcionários
        </button>
        <button className={`shrink-0 ${tabClass('relatorio')}`} onClick={() => setTab('relatorio')}>
          <DollarSign className="w-4 h-4 inline mr-2" />Relatório / Pagamento
        </button>
      </div>

      {/* ===== PONTO ===== */}
      {tab === 'ponto' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const openEntry = getOpenEntry(emp.id);
            return (
              <div key={emp.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{emp.name}</h3>
                    {emp.role && <p className="text-sm text-gray-500">{emp.role}</p>}
                  </div>
                  <span className={`w-3 h-3 rounded-full ${openEntry ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                </div>
                {openEntry ? (
                  <div>
                    <p className="text-xs text-green-600 mb-3">⏱️ Entrada: {formatTime(openEntry.clock_in)}</p>
                    <button onClick={() => clockOut(openEntry.id)} className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                      <Square className="w-4 h-4" /> Registrar Saída
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => clockIn(emp.id)} className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                      <Play className="w-4 h-4" /> Registrar Entrada
                    </button>
                    <button onClick={() => registerAbsence(emp)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm">
                      <UserX className="w-4 h-4" /> Registrar Falta
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum funcionário cadastrado. Vá na aba "Funcionários" para adicionar.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== FUNCIONÁRIOS ===== */}
      {tab === 'funcionarios' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" /> Adicionar Funcionário
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                placeholder="Nome *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <input
                placeholder="Cargo"
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <input
                placeholder="Telefone"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <input
                placeholder="E-mail (login)"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <input
                placeholder="Senha de acesso *"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                onClick={addEmployee}
                disabled={!newName.trim()}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 py-3"
              >
                <UserPlus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>

          {/* Valor/hora global */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" /> Valor da Hora (todos)
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">R$</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="border rounded-xl px-4 py-3 text-sm w-32 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                step="0.50"
              />
              <button
                onClick={async () => {
                  const rate = parseFloat(hourlyRate) || 15;
                  await supabase.from('employees').update({ hourly_rate: rate }).eq('active', true);
                  toast({ title: '✅ Valor/hora atualizado para todos' });
                  fetchData();
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Aplicar a Todos
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 mb-4">Funcionários Ativos</h3>
            <div className="space-y-3">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-bold text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.role || 'Sem cargo'} • {emp.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-green-600">R$ {emp.hourly_rate}/h</span>
                    <button
                      onClick={() => { setPasswordEmp(emp); setChangePassword(''); setShowPassword(false); }}
                      className="text-blue-400 hover:text-blue-600 transition-colors"
                      title="Trocar senha"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeEmployee(emp.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <p className="text-center text-gray-400 py-6">Nenhum funcionário cadastrado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== RELATÓRIO ===== */}
      {tab === 'relatorio' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {(['week', 'biweekly', 'month'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${period === p ? 'bg-amber-500 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >
                  {p === 'week' ? 'Semana' : p === 'biweekly' ? 'Quinzena' : 'Mês'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowAdjForm(!showAdjForm); if (!adjEmployeeId && employees.length) setAdjEmployeeId(employees[0].id); }}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Lançar Extra / Desconto
            </button>
          </div>

          {/* Adjustment Form */}
          {showAdjForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Novo Lançamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Funcionário</label>
                  <select value={adjEmployeeId} onChange={e => setAdjEmployeeId(e.target.value)} className="border rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Tipo</label>
                  <select value={adjType} onChange={e => setAdjType(e.target.value as any)} className="border rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    <option value="overtime">⏰ Hora Extra</option>
                    <option value="fuel_allowance">⛽ Vale Combustível</option>
                    <option value="meal_allowance">🍽️ Vale Refeição</option>
                    <option value="advance">💵 Adiantamento / Desconto</option>
                    <option value="absence">🚫 Falta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    {adjType === 'overtime' ? 'Horas Extras' : 'Descrição'}
                  </label>
                  {adjType === 'overtime' ? (
                    <input type="number" placeholder="Qtd horas" value={adjHours} onChange={e => setAdjHours(e.target.value)} className="border rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none" step="0.5" />
                  ) : (
                    <input placeholder="Ex: Vale, Adiantamento..." value={adjDescription} onChange={e => setAdjDescription(e.target.value)} className="border rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Valor (R$)</label>
                  <input type="number" placeholder="0.00" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} className="border rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none" step="0.01" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addAdjustment} className="bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    <Save className="w-4 h-4" /> Salvar
                  </button>
                  <button onClick={() => setShowAdjForm(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-xl font-bold text-sm transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Table */}
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-[calc(100vw-2rem)] sm:max-w-full overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-600">Funcionário</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-600">Cargo</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-600">Horas</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-600">Valor/h</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-green-600">+ H.Extra</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-orange-600">⛽ V.Combustível</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-purple-600">🍽️ V.Refeição</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-red-600">- Adiantamentos</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-600">Total Líquido</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-gray-600">Enviar</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const rawHours = calcHours(emp.id);
                  const hours = Math.round(rawHours * 100) / 100;
                  const base = hours * emp.hourly_rate;
                  const overtime = calcOvertime(emp.id);
                  const fuelAllowance = calcFuelAllowance(emp.id);
                  const mealAllowance = calcMealAllowance(emp.id);
                  const deductions = calcDeductions(emp.id);
                  const total = base + overtime + fuelAllowance - deductions;
                  return (
                    <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{emp.role || '-'}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-700">{hours.toFixed(2)}h <span className="text-[10px] opacity-50 block">({toHHMM(hours)})</span></td>
                      <td className="px-6 py-4 text-right text-gray-500">R$ {emp.hourly_rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-600">{overtime > 0 ? `+R$ ${overtime.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-orange-600">{fuelAllowance > 0 ? `+R$ ${fuelAllowance.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-purple-600">{mealAllowance > 0 ? `+R$ ${mealAllowance.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">{deductions > 0 ? `-R$ ${deductions.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-black text-lg" style={{ color: total >= 0 ? '#16a34a' : '#dc2626' }}>R$ {total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => sendViaWhatsApp(emp)} className="p-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors" title="Enviar por WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => sendViaEmail(emp)} className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors" title="Enviar por Email">
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td colSpan={2} className="px-6 py-4 font-bold">TOTAL</td>
                  <td className="px-6 py-4 text-right font-mono">{employees.reduce((s, e) => s + (Math.round(calcHours(e.id) * 100) / 100), 0).toFixed(2)}h</td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right font-bold text-green-400">+R$ {employees.reduce((s, e) => s + calcOvertime(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-orange-400">+R$ {employees.reduce((s, e) => s + calcFuelAllowance(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-purple-400">+R$ {employees.reduce((s, e) => s + calcMealAllowance(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-400">-R$ {employees.reduce((s, e) => s + calcDeductions(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-black text-amber-400 text-xl">
                    R$ {employees.reduce((s, e) => {
                      const h = Math.round(calcHours(e.id) * 100) / 100;
                      return s + (h * e.hourly_rate) + calcOvertime(e.id) + calcFuelAllowance(e.id) - calcDeductions(e.id);
                    }, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Recent Adjustments */}
          {adjustments.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Lançamentos Recentes
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {adjustments.slice(0, 20).map(adj => {
                  const emp = employees.find(e => e.id === adj.employee_id);
                  const isPositive = adj.type === 'overtime' || adj.type === 'fuel_allowance' || adj.type === 'meal_allowance';
                  return (
                    <div key={adj.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-bold text-gray-900">{emp?.name || 'Desconhecido'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${adj.type === 'overtime' ? 'bg-green-100 text-green-700' : adj.type === 'fuel_allowance' ? 'bg-orange-100 text-orange-700' : adj.type === 'meal_allowance' ? 'bg-purple-100 text-purple-700' : adj.type === 'absence' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                          {adj.type === 'overtime' ? '⏰ Hora Extra' : adj.type === 'fuel_allowance' ? '⛽ Vale Combustível' : adj.type === 'meal_allowance' ? '🍽️ Vale Refeição' : adj.type === 'absence' ? '🚫 Falta' : '💵 Adiantamento'}
                        </span>
                        {adj.description && <span className="text-gray-400">{adj.description}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : '-'}R$ {Number(adj.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(adj.reference_date).toLocaleDateString('pt-BR')}</span>
                        <button onClick={() => deleteAdjustment(adj.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Histórico recente */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" /> Registros Recentes
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {timeEntries.slice(0, 20).map(entry => {
                const emp = employees.find(e => e.id === entry.employee_id);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${entry.clock_out ? 'bg-gray-300' : 'bg-green-500 animate-pulse'}`} />
                      <span className="font-bold text-gray-900">{emp?.name || 'Desconhecido'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                      <span>🟢 {formatTime(entry.clock_in)}</span>
                      {entry.clock_out ? <span>🔴 {formatTime(entry.clock_out)}</span> : <span className="text-green-600 font-bold">Em andamento...</span>}
                    </div>
                  </div>
                );
              })}
              {timeEntries.length === 0 && <p className="text-center text-gray-400 py-6">Nenhum registro ainda</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Trocar Senha */}
      {passwordEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-500" />
                Trocar Senha
              </h3>
              <button onClick={() => setPasswordEmp(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Nova senha para <span className="font-bold text-gray-800">{passwordEmp.name}</span>
            </p>
            <div className="relative">
              <input
                value={changePassword}
                onChange={e => setChangePassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite a nova senha..."
                className="w-full p-3 pr-12 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">Mínimo de 4 caracteres.</p>
            <div className="flex gap-3">
              <button onClick={() => setPasswordEmp(null)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300">
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || changePassword.length < 4}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                {savingPassword ? 'Salvando...' : 'Alterar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
