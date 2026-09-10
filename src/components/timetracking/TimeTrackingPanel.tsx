import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, UserPlus, Play, Square, Calendar, DollarSign, Users, Trash2, Edit2, Save, X, Plus, Minus, MessageCircle, Mail, Key, Eye, EyeOff, CheckCircle
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

interface AdvanceRequest {
  id: string;
  employee_id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'Aprovado' | 'Recusado';
  created_at: string;
}

type Period = 'week' | 'biweekly' | 'month';
type TabType = 'ponto' | 'funcionarios' | 'relatorio' | 'vales';

export default function TimeTrackingPanel() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [advanceRequests, setAdvanceRequests] = useState<AdvanceRequest[]>([]);
  const [tab, setTab] = useState<TabType>('ponto');
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

  // Edit Time Entry
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');

  // Manual Time Entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualEntryType, setManualEntryType] = useState<'ponto'|'falta'>('ponto');
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsIso = twoMonthsAgo.toISOString();

    const [empRes, teRes, adjRes, advRes] = await Promise.all([
      supabase.from('employees').select('*').eq('active', true).order('name'),
      supabase.from('time_entries')
        .select('*')
        .gte('clock_in', twoMonthsIso)
        .order('clock_in', { ascending: false })
        .limit(2000),
      supabase.from('employee_adjustments')
        .select('*')
        .gte('reference_date', twoMonthsIso)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('advance_requests')
        .select('*')
        .gte('created_at', twoMonthsIso)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    
    if (empRes.error) console.error("Error fetching employees:", empRes.error);
    
    if (empRes.data) {
      setEmployees(empRes.data);
    }
    if (teRes.data) setTimeEntries(teRes.data);
    if (adjRes.data) setAdjustments(adjRes.data as Adjustment[]);
    if (advRes.data) setAdvanceRequests(advRes.data as AdvanceRequest[]);
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

  const deleteTimeEntry = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🗑️ Registro removido' });
      fetchData();
    }
  };

  const saveTimeEntryEdit = async () => {
    if (!editingEntry) return;
    const { error } = await supabase.from('time_entries').update({
      clock_in: new Date(editClockIn).toISOString(),
      clock_out: editClockOut ? new Date(editClockOut).toISOString() : null,
    }).eq('id', editingEntry.id);
    
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Registro atualizado' });
      setEditingEntry(null);
      fetchData();
    }
  };

  const addManualTimeEntry = async () => {
    if (!manualEmpId || !manualClockIn) {
      toast({ title: '⚠️ Preencha o funcionário e a data/hora', variant: 'destructive' });
      return;
    }
    
    if (manualEntryType === 'falta') {
      const { error } = await supabase.from('employee_adjustments').insert({
        employee_id: manualEmpId,
        type: 'absence',
        description: 'Falta lançada manualmente',
        amount: 0,
        hours: 0,
        reference_date: manualClockIn.split('T')[0] || manualClockIn,
      });
      if (error) {
        toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ Falta registrada' });
        setShowManualEntry(false);
        setManualClockIn('');
        setManualClockOut('');
        fetchData();
      }
      return;
    }

    const { error } = await supabase.from('time_entries').insert({
      employee_id: manualEmpId,
      clock_in: new Date(manualClockIn).toISOString(),
      clock_out: manualClockOut ? new Date(manualClockOut).toISOString() : null,
    });
    
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Registro inserido' });
      setShowManualEntry(false);
      setManualClockIn('');
      setManualClockOut('');
      fetchData();
    }
  };

  const toDatetimeLocal = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const getOpenEntry = (employeeId: string) =>
    timeEntries.find(e => e.employee_id === employeeId && !e.clock_out);

  const getPeriodDates = (): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    const start = new Date(now);
    if (period === 'week') {
      // Last 7 full days
      start.setDate(now.getDate() - 7);
    } else if (period === 'biweekly') {
      // Last 15 full days
      start.setDate(now.getDate() - 15);
    } else {
      // Current Month (from day 1)
      start.setDate(1);
    }
    
    start.setHours(0, 0, 0, 0);
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

  const tabClass = (t: TabType) =>
    `px-6 py-3 rounded-xl font-bold text-sm transition-all border ${tab === t ? 'border-amber-500/50 text-black shadow-lg shadow-amber-500/10' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`;

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

  const calcAbsences = (employeeId: string) => {
    return getEmployeeAdjustments(employeeId).filter(a => a.type === 'absence').reduce((sum, a) => sum + Number(a.amount), 0);
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

  const handleUpdateAdvanceStatus = async (request: AdvanceRequest, newStatus: 'Aprovado' | 'Recusado') => {
    // 1. Update the request status
    const { error: updateError } = await supabase
      .from('advance_requests')
      .update({ status: newStatus })
      .eq('id', request.id);

    if (updateError) {
      toast({ title: '❌ Erro ao atualizar status', description: updateError.message, variant: 'destructive' });
      return;
    }

    // 2. If approved, create an adjustment entry
    if (newStatus === 'Aprovado') {
      const { error: adjError } = await supabase.from('employee_adjustments').insert({
        employee_id: request.employee_id,
        type: 'advance',
        description: request.reason ? `Vale: ${request.reason}` : 'Vale solicitado pelo portal',
        amount: request.amount,
        reference_date: new Date().toISOString().split('T')[0],
      });

      if (adjError) {
        toast({ title: '⚠️ Pedido aprovado, mas erro ao criar desconto', description: adjError.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ Vale aprovado e desconto gerado!' });
      }
    } else {
      toast({ title: '❌ Vale recusado' });
    }

    fetchData();
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
    const mealAllowance = calcMealAllowance(emp.id);
    const deductions = calcDeductions(emp.id);
    const absences = calcAbsences(emp.id);
    const total = base + overtime + fuelAllowance + mealAllowance - deductions - absences;
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
      (mealAllowance > 0 ? `🍽️ Vale Refeição: +R$ ${mealAllowance.toFixed(2)}\n` : '') +
      (deductions > 0 ? `❌ Adiantamentos: -R$ ${deductions.toFixed(2)}\n` : '') +
      (absences > 0 ? `🚫 Faltas: -R$ ${absences.toFixed(2)}\n` : '') +
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
    <div className="p-4 sm:p-8 space-y-6 overflow-y-auto overflow-x-hidden h-full bg-[#0f0f0f] w-full relative pt-16 text-white">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            Ponto Eletrônico
          </h1>
          <p className="text-gray-400 mt-1">Controle de jornada dos funcionários</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-3 pb-2 w-full custom-scrollbar">
        <button className={`shrink-0 ${tabClass('ponto')}`} style={tab === 'ponto' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}} onClick={() => setTab('ponto')}>
          <Play className="w-4 h-4 inline mr-2" />Registrar Ponto
        </button>
        <button className={`shrink-0 ${tabClass('funcionarios')}`} style={tab === 'funcionarios' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}} onClick={() => setTab('funcionarios')}>
          <Users className="w-4 h-4 inline mr-2" />Funcionários
        </button>
        <button className={`shrink-0 ${tabClass('relatorio')}`} style={tab === 'relatorio' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}} onClick={() => setTab('relatorio')}>
          <DollarSign className="w-4 h-4 inline mr-2" />Relatório / Pagamento
        </button>
        <button className={`shrink-0 ${tabClass('vales')}`} style={tab === 'vales' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}} onClick={() => setTab('vales')}>
          <div className="relative inline-block mr-2">
            <DollarSign className="w-4 h-4" />
            {advanceRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          Solicitações de Vale
        </button>
      </div>

      {/* ===== PONTO ===== */}
      {tab === 'ponto' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const openEntry = getOpenEntry(emp.id);
            return (
              <div key={emp.id} className="bg-[#111111] rounded-2xl p-6 shadow-lg border border-white/5 hover:border-amber-500/20 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">{emp.name}</h3>
                    {emp.role && <p className="text-sm text-gray-400">{emp.role}</p>}
                  </div>
                  <span className={`w-3 h-3 rounded-full ${openEntry ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                </div>
                {openEntry ? (
                  <div>
                    <p className="text-xs text-green-400 mb-3">⏱️ Entrada: {formatTime(openEntry.clock_in)}</p>
                    <button onClick={() => clockOut(openEntry.id)} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                      <Square className="w-4 h-4" /> Registrar Saída
                    </button>
                  </div>
                ) : (
                  <button onClick={() => clockIn(emp.id)} className="w-full text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                    <Play className="w-4 h-4" /> Registrar Entrada
                  </button>
                )}
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum funcionário cadastrado. Vá na aba "Funcionários" para adicionar.</p>
            </div>
          )}
        </div>
      )}

      {/* ===== FUNCIONÁRIOS ===== */}
      {tab === 'funcionarios' && (
        <div className="space-y-6">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" /> Adicionar Funcionário
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                placeholder="Nome *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a] placeholder-gray-500"
              />
              <input
                placeholder="Cargo"
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a] placeholder-gray-500"
              />
              <input
                placeholder="Telefone"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a] placeholder-gray-500"
              />
              <input
                placeholder="E-mail (login)"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a] placeholder-gray-500"
              />
              <input
                placeholder="Senha de acesso *"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a] placeholder-gray-500"
              />
              <button
                onClick={addEmployee}
                disabled={!newName.trim()}
                className="disabled:opacity-50 text-black rounded-xl font-bold transition-all flex items-center justify-center gap-2 py-3"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
              >
                <UserPlus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>

          {/* Valor/hora global */}
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" /> Valor da Hora (todos)
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-gray-400">R$</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="border-white/10 rounded-xl px-4 py-3 text-sm w-32 focus:ring-2 focus:ring-amber-500 focus:outline-none text-white bg-[#1a1a1a]"
                step="0.50"
              />
              <button
                onClick={async () => {
                  const rate = parseFloat(hourlyRate) || 15;
                  await supabase.from('employees').update({ hourly_rate: rate }).eq('active', true);
                  toast({ title: '✅ Valor/hora atualizado para todos' });
                  fetchData();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Aplicar a Todos
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-white mb-4">Funcionários Ativos</h3>
            <div className="space-y-3">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                  <div>
                    <p className="font-bold text-white">{emp.name}</p>
                    <p className="text-xs text-gray-400">{emp.role || 'Sem cargo'} • {emp.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-green-400">R$ {emp.hourly_rate}/h</span>
                    <button
                      onClick={() => { setPasswordEmp(emp); setChangePassword(''); setShowPassword(false); }}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      title="Trocar senha"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeEmployee(emp.id)} className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <p className="text-center text-gray-500 py-6">Nenhum funcionário cadastrado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== VALES ===== */}
      {tab === 'vales' && (
        <div className="space-y-6">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" /> Pedidos de Vale Pendentes
            </h3>
            <div className="space-y-3">
              {advanceRequests.filter(r => r.status === 'pending').map(req => {
                const emp = employees.find(e => e.id === req.employee_id);
                return (
                  <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[#1a1a1a] border border-amber-500/20 rounded-2xl gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 font-bold border border-amber-500/30">
                        {emp?.name.substring(0, 2).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-white">{emp?.name || 'Funcionário Desconhecido'}</p>
                        <p className="text-sm text-amber-400 font-black">R$ {Number(req.amount).toFixed(2)}</p>
                        {req.reason && <p className="text-xs text-gray-400 italic mt-1">"{req.reason}"</p>}
                        <p className="text-[10px] text-gray-500 mt-1">{new Date(req.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleUpdateAdvanceStatus(req, 'Aprovado')}
                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Aprovar
                      </button>
                      <button
                        onClick={() => handleUpdateAdvanceStatus(req, 'Recusado')}
                        className="flex-1 sm:flex-none bg-red-950/50 border border-red-500/30 hover:bg-red-900/50 text-red-500 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" /> Recusar
                      </button>
                    </div>
                  </div>
                );
              })}
              {advanceRequests.filter(r => r.status === 'pending').length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma solicitação pendente.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" /> Histórico de Pedidos
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {advanceRequests.filter(r => r.status !== 'pending').slice(0, 50).map(req => {
                const emp = employees.find(e => e.id === req.employee_id);
                const isApproved = req.status === 'Aprovado';
                return (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl text-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isApproved ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-bold text-gray-300">{emp?.name || '...'}</span>
                      <span className="text-white font-bold">R$ {Number(req.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isApproved ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {req.status}
                      </span>
                      <span className="text-[10px] text-gray-500">{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                );
              })}
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
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${period === p ? 'border-amber-500/50 text-black shadow-lg shadow-amber-500/10 bg-gradient-to-br from-amber-500 to-amber-300' : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  {p === 'week' ? 'Semana' : p === 'biweekly' ? 'Quinzena' : 'Mês'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowAdjForm(!showAdjForm); if (!adjEmployeeId && employees.length) setAdjEmployeeId(employees[0].id); }}
              className="text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
            >
              <Plus className="w-4 h-4" /> Lançar Extra / Desconto
            </button>
          </div>

          {/* Adjustment Form */}
          {showAdjForm && (
            <div className="bg-[#1a1a1a] border border-amber-500/30 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Novo Lançamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Funcionário</label>
                  <select value={adjEmployeeId} onChange={e => setAdjEmployeeId(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Tipo</label>
                  <select value={adjType} onChange={e => setAdjType(e.target.value as any)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    <option value="overtime">⏰ Hora Extra</option>
                    <option value="fuel_allowance">⛽ Vale Combustível</option>
                    <option value="meal_allowance">🍽️ Vale Refeição</option>
                    <option value="advance">💵 Adiantamento / Desconto</option>
                    <option value="absence">🚫 Falta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">
                    {adjType === 'overtime' ? 'Horas Extras' : 'Descrição'}
                  </label>
                  {adjType === 'overtime' ? (
                    <input type="number" placeholder="Qtd horas" value={adjHours} onChange={e => setAdjHours(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600" step="0.5" />
                  ) : (
                    <input placeholder="Ex: Vale, Adiantamento..." value={adjDescription} onChange={e => setAdjDescription(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Valor (R$)</label>
                  <input type="number" placeholder="0.00" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-3 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600" step="0.01" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addAdjustment} className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-1">
                    <Save className="w-4 h-4" /> Salvar
                  </button>
                  <button onClick={() => setShowAdjForm(false)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Table */}
          <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-lg w-full max-w-[calc(100vw-2rem)] sm:max-w-full overflow-x-auto text-white">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#1a1a1a] border-b border-white/10">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-400">Funcionário</th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-400">Cargo</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-400">Horas</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-400">Valor/h</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-green-400">+ H.Extra</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-orange-400">⛽ V.Combustível</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-purple-400">🍽️ V.Refeição</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-red-500">- Adiantamentos</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-pink-500">🚫 Faltas</th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-gray-400">Total Líquido</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-gray-400">Enviar</th>
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
                  const absences = calcAbsences(emp.id);
                  const total = base + overtime + fuelAllowance + mealAllowance - deductions - absences;
                  return (
                    <tr key={emp.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{emp.name}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{emp.role || '-'}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">{hours.toFixed(2)}h <span className="text-[10px] opacity-50 block">({toHHMM(hours)})</span></td>
                      <td className="px-6 py-4 text-right text-gray-500">R$ {emp.hourly_rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-400">{overtime > 0 ? `+R$ ${overtime.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-orange-400">{fuelAllowance > 0 ? `+R$ ${fuelAllowance.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-purple-400">{mealAllowance > 0 ? `+R$ ${mealAllowance.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-500">{deductions > 0 ? `-R$ ${deductions.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-pink-500">{absences > 0 ? `-R$ ${absences.toFixed(2)}` : '-'}</td>
                      <td className="px-6 py-4 text-right font-black text-lg" style={{ color: total >= 0 ? '#4ade80' : '#ef4444' }}>R$ {total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => sendViaWhatsApp(emp)} className="p-2 rounded-lg bg-green-900/40 hover:bg-green-900/60 text-green-400 transition-colors" title="Enviar por WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => sendViaEmail(emp)} className="p-2 rounded-lg bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 transition-colors" title="Enviar por Email">
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#0a0a0a] border-t border-white/10 text-white">
                <tr>
                  <td colSpan={2} className="px-6 py-4 font-bold">TOTAL</td>
                  <td className="px-6 py-4 text-right font-mono">{employees.reduce((s, e) => s + (Math.round(calcHours(e.id) * 100) / 100), 0).toFixed(2)}h</td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right font-bold text-green-400">+R$ {employees.reduce((s, e) => s + calcOvertime(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-orange-400">+R$ {employees.reduce((s, e) => s + calcFuelAllowance(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-purple-400">+R$ {employees.reduce((s, e) => s + calcMealAllowance(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-500">-R$ {employees.reduce((s, e) => s + calcDeductions(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-pink-500">-R$ {employees.reduce((s, e) => s + calcAbsences(e.id), 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-black text-amber-500 text-xl">
                    R$ {employees.reduce((s, e) => {
                      const h = Math.round(calcHours(e.id) * 100) / 100;
                      return s + (h * e.hourly_rate) + calcOvertime(e.id) + calcFuelAllowance(e.id) + calcMealAllowance(e.id) - calcDeductions(e.id) - calcAbsences(e.id);
                    }, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Recent Adjustments */}
          {adjustments.length > 0 && (
            <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" /> Lançamentos Recentes
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {adjustments.slice(0, 20).map(adj => {
                  const emp = employees.find(e => e.id === adj.employee_id);
                  const isPositive = adj.type === 'overtime' || adj.type === 'fuel_allowance' || adj.type === 'meal_allowance';
                  const isAbsence = adj.type === 'absence';
                  return (
                    <div key={adj.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl text-sm hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-500' : isAbsence ? 'bg-pink-500' : 'bg-red-500'}`} />
                        <span className="font-bold text-white">{emp?.name || 'Desconhecido'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${adj.type === 'overtime' ? 'bg-green-900/50 text-green-400 border border-green-500/30' : adj.type === 'fuel_allowance' ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' : adj.type === 'meal_allowance' ? 'bg-purple-900/50 text-purple-400 border border-purple-500/30' : adj.type === 'absence' ? 'bg-pink-900/50 text-pink-400 border border-pink-500/30' : 'bg-red-900/50 text-red-400 border border-red-500/30'}`}>
                          {adj.type === 'overtime' ? '⏰ Hora Extra' : adj.type === 'fuel_allowance' ? '⛽ Vale Combustível' : adj.type === 'meal_allowance' ? '🍽️ Vale Refeição' : adj.type === 'absence' ? '🚫 Falta' : '💵 Adiantamento'}
                        </span>
                        {adj.description && <span className="text-gray-400">{adj.description}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${isPositive ? 'text-green-400' : isAbsence ? 'text-pink-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : '-'}R$ {Number(adj.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(adj.reference_date).toLocaleDateString('pt-BR')}</span>
                        <button onClick={() => deleteAdjustment(adj.id)} className="text-red-400 hover:text-red-300 transition-colors">
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
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" /> Registros Recentes (Ponto)
              </h3>
              <button
                onClick={() => { setShowManualEntry(!showManualEntry); if (!manualEmpId && employees.length) setManualEmpId(employees[0].id); }}
                className="text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar Manual
              </button>
            </div>

            {/* Manual Entry Form */}
            {showManualEntry && (
              <div className="mb-4 bg-[#1a1a1a] border border-amber-500/30 rounded-xl p-4 flex flex-col gap-4">
                {/* Mini Tabs for Type */}
                <div className="flex bg-[#111] rounded-xl p-1 w-fit border border-white/5">
                  <button
                    onClick={() => setManualEntryType('ponto')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${manualEntryType === 'ponto' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Registrar Ponto
                  </button>
                  <button
                    onClick={() => setManualEntryType('falta')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${manualEntryType === 'falta' ? 'bg-pink-500/20 text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Registrar Falta
                  </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-400 block mb-1">Funcionário</label>
                    <select value={manualEmpId} onChange={e => setManualEmpId(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none">
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  
                  {manualEntryType === 'falta' ? (
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-400 block mb-1">Data da Falta</label>
                      <input type="date" value={manualClockIn} onChange={e => setManualClockIn(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none [color-scheme:dark]" />
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-400 block mb-1">Entrada</label>
                        <input type="datetime-local" value={manualClockIn} onChange={e => setManualClockIn(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none [color-scheme:dark]" />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-400 block mb-1">Saída (Opcional)</label>
                        <input type="datetime-local" value={manualClockOut} onChange={e => setManualClockOut(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none [color-scheme:dark]" />
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={addManualTimeEntry} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1">
                      <Save className="w-4 h-4" /> Salvar
                    </button>
                    <button onClick={() => setShowManualEntry(false)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
              {timeEntries.map(entry => {
                const emp = employees.find(e => e.id === entry.employee_id);
                const isEditing = editingEntry?.id === entry.id;

                if (isEditing) {
                  return (
                    <div key={entry.id} className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                      <div className="font-bold text-white mb-2">{emp?.name || 'Desconhecido'} - Editando Registro</div>
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                          <label className="text-xs font-bold text-gray-400 block mb-1">Entrada</label>
                          <input type="datetime-local" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-3 py-2 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none [color-scheme:dark]" />
                        </div>
                        <div className="flex-1 w-full">
                          <label className="text-xs font-bold text-gray-400 block mb-1">Saída</label>
                          <input type="datetime-local" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="border border-white/10 bg-[#111] text-white rounded-xl px-3 py-2 text-sm w-full focus:ring-2 focus:ring-amber-500 focus:outline-none [color-scheme:dark]" />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={saveTimeEntryEdit} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingEntry(null)} className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl text-sm hover:bg-white/10 transition-colors gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${entry.clock_out ? 'bg-gray-600' : 'bg-green-500 animate-pulse'}`} />
                      <span className="font-bold text-white">{emp?.name || 'Desconhecido'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-400 flex-wrap">
                      <span>🟢 {formatTime(entry.clock_in)}</span>
                      {entry.clock_out ? <span>🔴 {formatTime(entry.clock_out)}</span> : <span className="text-green-400 font-bold">Em andamento...</span>}
                      <div className="flex gap-2 border-l border-white/10 pl-4 ml-2">
                        <button onClick={() => {
                          setEditingEntry(entry);
                          setEditClockIn(toDatetimeLocal(entry.clock_in));
                          setEditClockOut(toDatetimeLocal(entry.clock_out));
                        }} className="text-blue-400 hover:text-blue-300 transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteTimeEntry(entry.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {timeEntries.length === 0 && <p className="text-center text-gray-500 py-6">Nenhum registro ainda</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Trocar Senha */}
      {passwordEmp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Key className="w-5 h-5 text-amber-500" />
                Trocar Senha
              </h3>
              <button onClick={() => setPasswordEmp(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Nova senha para <span className="font-bold text-amber-500">{passwordEmp.name}</span>
            </p>
            <div className="relative">
              <input
                value={changePassword}
                onChange={e => setChangePassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite a nova senha..."
                className="w-full p-3 pr-12 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-500"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">Mínimo de 4 caracteres.</p>
            <div className="flex gap-3">
              <button onClick={() => setPasswordEmp(null)} className="flex-1 bg-white/10 border border-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20 transition-all">
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || changePassword.length < 4}
                className="flex-1 flex items-center justify-center gap-2 text-black py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
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
