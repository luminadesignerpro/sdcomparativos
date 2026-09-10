import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Play, Square, DollarSign, Calendar, User, Send, CheckCircle, XCircle, Loader2, Download, Fuel } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';

interface Employee {
  id: string;
  name: string;
  role: string | null;
  hourly_rate: number;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
}

interface Adjustment {
  id: string;
  employee_id: string;
  type: string;
  description: string | null;
  amount: number;
  hours: number;
  reference_date: string;
}

type Period = 'week' | 'biweekly' | 'month';

interface EmployeePortalProps {
  employeeName: string;
}

export default function EmployeePortal({ employeeName }: EmployeePortalProps) {
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);

  // Vale/Adiantamento
  const [showVale, setShowVale] = useState(false);
  const [valeAmount, setValeAmount] = useState('');
  const [valeReason, setValeReason] = useState('');
  const [valeSending, setValeSending] = useState(false);
  const [valeRequests, setValeRequests] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  useEffect(() => {
    fetchEmployee();
  }, [employeeName]);

  const fetchEmployee = async () => {
    setLoading(true);
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .eq('name', employeeName)
      .eq('active', true)
      .limit(1)
      .single();

    if (empData) {
      setEmployee(empData);
      const [entriesRes, valeRes, adjRes] = await Promise.all([
        supabase.from('time_entries').select('*').eq('employee_id', empData.id).order('clock_in', { ascending: false }).limit(200),
        supabase.from('advance_requests').select('*').eq('employee_id', empData.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('employee_adjustments').select('*').eq('employee_id', empData.id).order('created_at', { ascending: false }).limit(200),
      ]);
      if (entriesRes.data) setEntries(entriesRes.data);
      if (valeRes.data) setValeRequests(valeRes.data);
      if (adjRes.data) setAdjustments(adjRes.data as Adjustment[]);
    }
    setLoading(false);
  };

  const clockIn = async () => {
    if (!employee) return;
    const { error } = await supabase.from('time_entries').insert({ employee_id: employee.id });
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Entrada registrada!' });
      fetchEmployee();
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
      fetchEmployee();
    }
  };

  const submitVale = async () => {
    if (!employee || !valeAmount) return;
    setValeSending(true);
    const { error } = await supabase.from('advance_requests').insert({
      employee_id: employee.id,
      amount: parseFloat(valeAmount),
      reason: valeReason.trim() || null,
    });
    setValeSending(false);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Solicitação enviada!', description: 'Aguarde a aprovação do administrador.' });
      setValeAmount('');
      setValeReason('');
      setShowVale(false);
      fetchEmployee();
    }
  };

  const openEntry = entries.find(e => !e.clock_out);

  const getPeriodDates = (): { start: Date; end: Date } => {
    const now = new Date();
    const start = new Date(now);
    if (period === 'week') start.setDate(now.getDate() - 7);
    else if (period === 'biweekly') start.setDate(now.getDate() - 15);
    else start.setDate(now.getDate() - 30);
    return { start, end: now };
  };

  const calcHours = (): number => {
    const { start, end } = getPeriodDates();
    return entries
      .filter(e => e.clock_out && new Date(e.clock_in) >= start && new Date(e.clock_in) <= end)
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

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const getPeriodAdjustments = () => {
    if (!employee) return [];
    const { start, end } = getPeriodDates();
    return adjustments.filter(a =>
      a.employee_id === employee.id &&
      new Date(a.reference_date) >= start &&
      new Date(a.reference_date) <= end
    );
  };

  const calcOvertime = () => getPeriodAdjustments().filter(a => a.type === 'overtime').reduce((s, a) => s + Number(a.amount), 0);
  const calcFuelAllowance = () => getPeriodAdjustments().filter(a => a.type === 'fuel_allowance').reduce((s, a) => s + Number(a.amount), 0);
  const calcDeductions = () => getPeriodAdjustments().filter(a => a.type === 'advance').reduce((s, a) => s + Number(a.amount), 0);

  const downloadPayslip = async () => {
    if (!employee) return;
    const hours = calcHours();
    const base = hours * employee.hourly_rate;
    const overtime = calcOvertime();
    const fuelAllowance = calcFuelAllowance();
    const deductions = calcDeductions();
    const totalProventos = base + overtime + fuelAllowance;
    const total = totalProventos - deductions;
    const periodLabel = period === 'week' ? 'Semana' : period === 'biweekly' ? 'Quinzena' : 'Mês';
    const today = new Date().toLocaleDateString('pt-BR');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const margin = 15;
    const contentW = W - margin * 2;

    // Load logo
    let logoData: string | null = null;
    try {
      const resp = await fetch('/images/logo-sd-gold.png');
      const blob = await resp.blob();
      logoData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip logo */ }

    // ── HEADER ──
    const gold = [184, 151, 60] as const;
    const darkGray = [40, 40, 40] as const;

    // Gold top bar
    doc.setFillColor(...gold);
    doc.rect(0, 0, W, 4, 'F');

    // Logo
    if (logoData) {
      doc.addImage(logoData, 'PNG', margin, 10, 22, 22);
    }

    // Company info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...darkGray);
    doc.text('SD MÓVEIS PROJETADOS', logoData ? margin + 26 : margin, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('CNPJ: 27.693.081/0001-09', logoData ? margin + 26 : margin, 24);
    doc.text('Rua Jorge Figueredo, 740 • Itaitinga - CE • CEP 60874-765', logoData ? margin + 26 : margin, 28);

    // Title bar
    doc.setFillColor(...darkGray);
    doc.rect(margin, 38, contentW, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`CONTRACHEQUE — ${periodLabel.toUpperCase()}`, W / 2, 44.5, { align: 'center' });

    // ── EMPLOYEE INFO ──
    let y = 56;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, contentW, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Funcionário:', margin + 3, y + 1);
    doc.setFont('helvetica', 'normal');
    doc.text(employee.name.toUpperCase(), margin + 27, y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('Cargo:', margin + 3, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(employee.role || '-', margin + 27, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Período:', margin + contentW - 55, y + 1);
    doc.setFont('helvetica', 'normal');
    doc.text(periodLabel, margin + contentW - 35, y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('Data:', margin + contentW - 55, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(today, margin + contentW - 35, y + 7);

    // ── TABLE: PROVENTOS ──
    y = 80;
    doc.setFillColor(...gold);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('PROVENTOS', margin + 3, y + 5.5);
    doc.text('VALOR (R$)', margin + contentW - 3, y + 5.5, { align: 'right' });

    y += 8;
    const drawRow = (label: string, value: string, bg: boolean) => {
      if (bg) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentW, 7, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkGray);
      doc.text(label, margin + 3, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(value, margin + contentW - 3, y + 5, { align: 'right' });
      y += 7;
    };

    drawRow(`Salário Base (${hours.toFixed(1)}h × R$ ${employee.hourly_rate.toFixed(2)})`, base.toFixed(2), true);
    if (overtime > 0) drawRow('Horas Extra', `+ ${overtime.toFixed(2)}`, false);
    if (fuelAllowance > 0) drawRow('Vale Combustível', `+ ${fuelAllowance.toFixed(2)}`, overtime > 0 ? true : false);

    // Subtotal proventos
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Total Proventos', margin + 3, y + 5);
    doc.setTextColor(22, 163, 74);
    doc.text(totalProventos.toFixed(2), margin + contentW - 3, y + 5, { align: 'right' });
    y += 9;

    // ── TABLE: DESCONTOS ──
    doc.setFillColor(220, 38, 38);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('DESCONTOS', margin + 3, y + 5.5);
    doc.text('VALOR (R$)', margin + contentW - 3, y + 5.5, { align: 'right' });
    y += 8;

    if (deductions > 0) {
      drawRow('Adiantamentos / Vales', `- ${deductions.toFixed(2)}`, true);
    } else {
      drawRow('Nenhum desconto no período', '0.00', true);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Descontos', margin + 3, y + 5);
    doc.setTextColor(220, 38, 38);
    doc.text(deductions.toFixed(2), margin + contentW - 3, y + 5, { align: 'right' });
    y += 12;

    // ── TOTAL LÍQUIDO ──
    doc.setFillColor(...darkGray);
    doc.rect(margin, y, contentW, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL LÍQUIDO', margin + 5, y + 8);
    doc.setTextColor(...gold);
    doc.setFontSize(14);
    doc.text(`R$ ${total.toFixed(2)}`, margin + contentW - 5, y + 8.5, { align: 'right' });

    // ── FOOTER ──
    y += 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW / 2 - 10, y);
    doc.line(margin + contentW / 2 + 10, y, margin + contentW, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Assinatura do Empregador', margin + contentW / 4, y + 5, { align: 'center' });
    doc.text('Assinatura do Funcionário', margin + contentW * 3 / 4, y + 5, { align: 'center' });

    // Gold bottom bar
    doc.setFillColor(...gold);
    doc.rect(0, 293, W, 4, 'F');

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Documento gerado automaticamente pelo sistema SD Móveis Projetados', W / 2, 290, { align: 'center' });

    const fileName = `contracheque-${employee.name.toLowerCase().replace(/\s+/g, '-')}-${periodLabel.toLowerCase()}.pdf`;

    if (Capacitor.isNativePlatform()) {
      try {
        toast({ title: '⏳ Preparando Contracheque...' });
        const base64Data = doc.output('datauristring').split(',')[1];
        
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });
        
        await Share.share({
          title: 'Contracheque SD Móveis',
          text: 'Aqui está seu contracheque.',
          url: result.uri,
          dialogTitle: 'Salvar ou Compartilhar Contracheque',
        });
        
        toast({ title: '✅ Contracheque disponibilizado com sucesso!' });
      } catch (err: any) {
        console.error('File save error:', err);
        toast({ title: '❌ Erro ao salvar PDF', description: err.message, variant: 'destructive' });
      }
    } else {
      const pdfBlob = doc.output('blob'); const blobUrl = URL.createObjectURL(pdfBlob); const link = document.createElement('a'); link.href = blobUrl; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast({ title: '📄 Contracheque PDF baixado!' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Clock className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
        <User className="w-16 h-16 opacity-50" />
        <p className="text-lg font-bold">Funcionário "{employeeName}" não encontrado</p>
        <p className="text-sm">Verifique com o administrador se seu cadastro está ativo.</p>
      </div>
    );
  }

  const hours = calcHours();
  const overtime = calcOvertime();
  const fuelAllowance = calcFuelAllowance();
  const deductions = calcDeductions();
  const total = hours * employee.hourly_rate + overtime + fuelAllowance - deductions;

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full" style={{ background: '#0f0f0f' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-black flex items-center gap-3" style={{ color: '#D4AF37' }}>
          <Clock className="w-8 h-8" style={{ color: '#D4AF37' }} />
          Meu Ponto
        </h1>
        <p className="text-gray-400 mt-1">Olá, <span className="font-bold text-white">{employee.name}</span> • {employee.role || 'Funcionário'}</p>
      </header>

      {/* Clock In/Out Card */}
      <div className="rounded-2xl p-8 shadow-lg border max-w-lg" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.3)' }}>
        <div className="flex items-center gap-3 mb-6">
          <span className={`w-4 h-4 rounded-full ${openEntry ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="font-bold text-white text-lg">
            {openEntry ? 'Trabalhando agora' : 'Fora do expediente'}
          </span>
        </div>

        {openEntry ? (
          <div>
            <p className="text-sm text-green-400 mb-4">⏱️ Entrada: {formatTime(openEntry.clock_in)}</p>
            <button
              onClick={() => clockOut(openEntry.id)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg"
            >
              <Square className="w-5 h-5" /> Registrar Saída
            </button>
          </div>
        ) : (
          <button
            onClick={clockIn}
            className="w-full text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
          >
            <Play className="w-5 h-5" /> Registrar Entrada
          </button>
        )}
      </div>

      {/* Payment Summary */}
      <div className="rounded-2xl p-8 shadow-lg" style={{ background: '#1a1a1a' }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" style={{ color: '#D4AF37' }} /> Resumo de Pagamento
        </h3>

        <div className="flex gap-3 mb-6">
          {(['week', 'biweekly', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                period === p ? 'text-black' : 'text-gray-400 hover:text-white'
              }`}
              style={period === p ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : { background: '#2a2a2a' }}
            >
              {p === 'week' ? 'Semana' : p === 'biweekly' ? 'Quinzena' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-xl p-5 text-center" style={{ background: '#111', border: '1px solid rgba(212,175,55,0.3)' }}>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: '#D4AF37' }}>Horas</p>
            <p className="text-2xl font-black text-white">{hours.toFixed(1)}h</p>
          </div>
          <div className="rounded-xl p-5 text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-gray-500 font-bold uppercase mb-1">Valor/h</p>
            <p className="text-2xl font-black text-white">R$ {employee.hourly_rate.toFixed(2)}</p>
          </div>
          {overtime > 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: '#0a1a0a', border: '1px solid rgba(74,222,128,0.3)' }}>
              <p className="text-xs text-green-400 font-bold uppercase mb-1">H. Extra</p>
              <p className="text-2xl font-black text-green-400">+R$ {overtime.toFixed(2)}</p>
            </div>
          )}
          {fuelAllowance > 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: '#1a1000', border: '1px solid rgba(251,191,36,0.3)' }}>
              <p className="text-xs text-amber-400 font-bold uppercase mb-1">⛽ V. Combust.</p>
              <p className="text-2xl font-black text-amber-400">+R$ {fuelAllowance.toFixed(2)}</p>
            </div>
          )}
          {deductions > 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p className="text-xs text-red-400 font-bold uppercase mb-1">Adiantamentos</p>
              <p className="text-2xl font-black text-red-400">-R$ {deductions.toFixed(2)}</p>
            </div>
          )}
          <div className="rounded-xl p-5 text-center col-span-full md:col-span-1" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.4)' }}>
            <p className="text-xs font-bold uppercase mb-1" style={{ color: '#D4AF37' }}>Total Líquido</p>
            <p className="text-2xl font-black" style={{ color: '#D4AF37' }}>R$ {total.toFixed(2)}</p>
          </div>
        </div>

        <button
          onClick={downloadPayslip}
          className="mt-4 w-full text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
        >
          <Download className="w-5 h-5" /> Baixar Contracheque
        </button>
      </div>

      {/* Recent Entries */}
      <div className="rounded-2xl p-6 shadow-lg" style={{ background: '#1a1a1a' }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" style={{ color: '#D4AF37' }} /> Meus Registros Recentes
        </h3>
        <div className="space-y-2 max-h-64 overflow-auto">
          {entries.slice(0, 15).map(entry => (
            <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ background: '#111' }}>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${entry.clock_out ? 'bg-gray-600' : 'bg-green-400 animate-pulse'}`} />
                <span className="text-gray-300">🟢 {formatTime(entry.clock_in)}</span>
              </div>
              <div className="text-gray-500">
                {entry.clock_out ? (
                  <span>🔴 {formatTime(entry.clock_out)} — <span className="font-bold text-white">
                    {((new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000).toFixed(1)}h
                  </span></span>
                ) : (
                  <span className="text-green-400 font-bold">Em andamento...</span>
                )}
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-center text-gray-600 py-6">Nenhum registro ainda</p>
          )}
        </div>
      </div>

      {/* Vale/Adiantamento */}
      <div className="rounded-2xl p-6 shadow-lg" style={{ background: '#1a1a1a' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" style={{ color: '#D4AF37' }} /> Solicitar Vale/Adiantamento
          </h3>
          <button
            onClick={() => setShowVale(!showVale)}
            className="px-4 py-2 text-black rounded-xl font-bold text-sm transition-colors"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
          >
            {showVale ? 'Cancelar' : 'Nova Solicitação'}
          </button>
        </div>

        {showVale && (
          <div className="rounded-xl p-4 space-y-3 border mb-4" style={{ background: '#111', borderColor: 'rgba(212,175,55,0.3)' }}>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
              <input
                type="number"
                value={valeAmount}
                onChange={e => setValeAmount(e.target.value)}
                placeholder="Ex: 200"
                className="w-full p-3 rounded-lg text-sm mt-1 text-white"
                style={{ background: '#2a2a2a', border: '1px solid rgba(212,175,55,0.2)' }}
                min="1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Motivo (opcional)</label>
              <input
                type="text"
                value={valeReason}
                onChange={e => setValeReason(e.target.value)}
                placeholder="Ex: Combustível para entrega"
                className="w-full p-3 rounded-lg text-sm mt-1 text-white"
                style={{ background: '#2a2a2a', border: '1px solid rgba(212,175,55,0.2)' }}
              />
            </div>
            <button
              onClick={submitVale}
              disabled={valeSending || !valeAmount}
              className="w-full text-black py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
            >
              {valeSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Solicitação
            </button>
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-auto">
          {valeRequests.map(req => (
            <div key={req.id} className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ background: '#111' }}>
              <div>
                <span className="font-bold text-white">R$ {Number(req.amount).toFixed(2)}</span>
                {req.reason && <span className="text-gray-500 ml-2">— {req.reason}</span>}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                req.status === 'Aprovado' ? 'bg-green-900 text-green-300' :
                req.status === 'Recusado' ? 'bg-red-900 text-red-300' :
                'text-yellow-300'
              }`}
              style={req.status !== 'Aprovado' && req.status !== 'Recusado' ? { background: 'rgba(212,175,55,0.2)', color: '#D4AF37' } : {}}>
                {req.status === 'Aprovado' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {req.status === 'Recusado' && <XCircle className="w-3 h-3 inline mr-1" />}
                {req.status}
              </span>
            </div>
          ))}
          {valeRequests.length === 0 && (
            <p className="text-center text-gray-600 py-4 text-sm">Nenhuma solicitação ainda</p>
          )}
        </div>
      </div>
    </div>
  );
}

