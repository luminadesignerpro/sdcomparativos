import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Play, Square, DollarSign, Calendar, User, Send, CheckCircle, XCircle, Loader2, Download, MapPin, Star } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
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

const HQ_LAT = -3.9084291;
const HQ_LON = -38.5189906;
const ALLOWED_DISTANCE_KM = 0.15; // 150m to account for GPS inaccuracy indoors

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  const [isNearHQ, setIsNearHQ] = useState<boolean | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [drivingScore, setDrivingScore] = useState<number | null>(null);

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
      
      // Fetch recent trip for score
      const { data: tripData } = await supabase.from('trips').select('id').eq('employee_id', empData.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(1).maybeSingle();
      if (tripData) {
        const { count: incidents } = await supabase.from('trip_incidents').select('*', { count: 'exact', head: true }).eq('trip_id', tripData.id);
        const { data: locs } = await supabase.from('trip_locations').select('speed').eq('trip_id', tripData.id).gt('speed', 22.2); // 22.2 m/s = 80km/h
        let score = 10;
        if (incidents) score -= (incidents * 2);
        if (locs && locs.length > 0) score -= 1;
        setDrivingScore(Math.max(0, score));
      }
    }
    setLoading(false);
    await checkLocationAndAutoClockIn(empData);
  };

  const checkLocationAndAutoClockIn = async (empData?: Employee) => {
    setCheckingLocation(true);
    try {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (e) {
        // Ignora no web/browser se a API de permissões não for suportada da mesma forma
      }

      let pos;
      try {
        pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      } catch (highAccErr) {
        console.warn('Alta precisão falhou, tentando baixa precisão...', highAccErr);
        pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 });
      }

      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, HQ_LAT, HQ_LON);
      setIsNearHQ(dist <= ALLOWED_DISTANCE_KM); // Always 150m for allowed check-in area
      
      const targetEmp = empData || employee;
      if (dist <= ALLOWED_DISTANCE_KM && targetEmp) {
        // Auto-clock in if no open entry
        const { data: openEntries } = await supabase.from('time_entries')
          .select('id')
          .eq('employee_id', targetEmp.id)
          .is('clock_out', null);

        if (!openEntries || openEntries.length === 0) {
          toast({ title: '📍 Na Sede!', description: 'Batendo ponto automaticamente...' });
          const { error } = await supabase.from('time_entries').insert({ employee_id: targetEmp.id });
          if (!error) {
            toast({ title: '✅ Ponto Registrado Automaticamente!' });
            // Atualiza os registros sem recarregar tudo
            const { data: newEntries } = await supabase.from('time_entries').select('*').eq('employee_id', targetEmp.id).order('clock_in', { ascending: false }).limit(200);
            if (newEntries) setEntries(newEntries);
          }
        }
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isAfter530PM = currentHour > 17 || (currentHour === 17 && currentMinute >= 30);

      // Warning when outside the normal 150m zone
      if (dist > ALLOWED_DISTANCE_KM) {
        toast({ 
          title: '📍 Fora da área', 
          description: `Sua distância da sede é de ${dist.toFixed(3)}km (${(dist * 1000).toFixed(0)}m).`, 
          variant: 'destructive' 
        });
      }

      // Auto-clock out if after 17:30 and more than 30 meters (0.03km) away
      if (isAfter530PM && dist > 0.03 && targetEmp) {
        const { data: openEntries } = await supabase.from('time_entries')
          .select('id')
          .eq('employee_id', targetEmp.id)
          .is('clock_out', null);

        if (openEntries && openEntries.length > 0) {
          toast({ title: '📍 Fora da Sede após 17:30', description: 'Fechando ponto automaticamente...' });
          const { error } = await supabase.from('time_entries')
            .update({ clock_out: now.toISOString() })
            .eq('id', openEntries[0].id);

          if (!error) {
            toast({ title: '✅ Ponto Fechado Automaticamente!' });
            const { data: newEntries } = await supabase.from('time_entries')
              .select('*')
              .eq('employee_id', targetEmp.id)
              .order('clock_in', { ascending: false })
              .limit(200);
            if (newEntries) setEntries(newEntries);
          }
        }
      }
    } catch (err: any) {
      console.error('Location check failed:', err);
      setIsNearHQ(false);
    } finally {
      setCheckingLocation(false);
    }
  };

  useEffect(() => {
    if (!employee) return;
    
    let watcherId: string | null = null;
    let isSubscribed = true;

    const setupBackgroundTracking = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Monitorando proximidade da Sede para bater ponto automático.",
            backgroundTitle: "SD Móveis - Ponto Automático",
            requestPermissions: true,
            stale: false,
            distanceFilter: 10 // Update every 10 meters for precision
          },
          async (location, error) => {
            if (error || !location || !isSubscribed) return;
            
            const dist = haversineDistance(location.latitude, location.longitude, HQ_LAT, HQ_LON);
            setIsNearHQ(dist <= ALLOWED_DISTANCE_KM); // Always 150m
            
            if (dist <= ALLOWED_DISTANCE_KM) {
              const { data: openEntries } = await supabase.from('time_entries')
                .select('id')
                .eq('employee_id', employee.id)
                .is('clock_out', null)
                .limit(1);
                
              if (!openEntries || openEntries.length === 0) {
                // Not clocked in yet
                await supabase.from('time_entries').insert({ employee_id: employee.id });
                // We could use local notifications here if we wanted to
                // Refresh list if app is in foreground
                const { data: newEntries } = await supabase.from('time_entries')
                  .select('*').eq('employee_id', employee.id)
                  .order('clock_in', { ascending: false }).limit(200);
                if (newEntries && isSubscribed) setEntries(newEntries);
              }
            }

            // Separately, check if after 17:30 and distance is greater than 30m (0.03km)
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const isAfter530PM = currentHour > 17 || (currentHour === 17 && currentMinute >= 30);
            if (isAfter530PM && dist > 0.03) {
              const { data: openEntries } = await supabase.from('time_entries')
                .select('id')
                .eq('employee_id', employee.id)
                .is('clock_out', null)
                .limit(1);

              if (openEntries && openEntries.length > 0) {
                await supabase.from('time_entries')
                  .update({ clock_out: now.toISOString() })
                  .eq('id', openEntries[0].id);

                const { data: newEntries } = await supabase.from('time_entries')
                  .select('*').eq('employee_id', employee.id)
                  .order('clock_in', { ascending: false }).limit(200);
                if (newEntries && isSubscribed) setEntries(newEntries);
              }
            }
          }
        );
        watcherId = id;
      } catch (err) {
        console.error("Erro no BackgroundGeolocation:", err);
      }
    };

    setupBackgroundTracking();

    return () => {
      isSubscribed = false;
      // We don't remove the watcher because we want it to keep running in background!
      // But we prevent state updates via isSubscribed
    };
  }, [employee]);

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

    const gold = [184, 151, 60] as const;
    const darkGray = [40, 40, 40] as const;

    doc.setFillColor(...gold);
    doc.rect(0, 0, W, 4, 'F');

    if (logoData) doc.addImage(logoData, 'PNG', margin, 10, 22, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...darkGray);
    doc.text('SD MÓVEIS PROJETADOS', logoData ? margin + 26 : margin, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('CNPJ: 27.693.081/0001-09', logoData ? margin + 26 : margin, 24);
    doc.text('Rua Jorge Figueredo, 740 • Itaitinga - CE • CEP 60874-765', logoData ? margin + 26 : margin, 28);

    doc.setFillColor(...darkGray);
    doc.rect(margin, 38, contentW, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`CONTRACHEQUE — ${periodLabel.toUpperCase()}`, W / 2, 44.5, { align: 'center' });

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

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text('Total Proventos', margin + 3, y + 5);
    doc.setTextColor(22, 163, 74);
    doc.text(totalProventos.toFixed(2), margin + contentW - 3, y + 5, { align: 'right' });
    y += 9;

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

    doc.setFillColor(...darkGray);
    doc.rect(margin, y, contentW, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL LÍQUIDO', margin + 5, y + 8);
    doc.setTextColor(...gold);
    doc.setFontSize(14);
    doc.text(`R$ ${total.toFixed(2)}`, margin + contentW - 5, y + 8.5, { align: 'right' });

    y += 25;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW / 2 - 10, y);
    doc.line(margin + contentW / 2 + 10, y, margin + contentW, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Assinatura do Empregador', margin + contentW / 4, y + 5, { align: 'center' });
    doc.text('Assinatura do Funcionário', margin + contentW * 3 / 4, y + 5, { align: 'center' });

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
      doc.save(fileName);
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

        {!openEntry && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-black/40 border border-white/5">
            {checkingLocation ? (
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            ) : isNearHQ ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <MapPin className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm text-gray-300">
              {checkingLocation ? 'Verificando localização...' : 
               isNearHQ ? 'Você está na Sede (Acesso Liberado)' : 
               'Fora da Sede (Acesso Bloqueado)'}
            </span>
            <button onClick={() => checkLocationAndAutoClockIn()} className="ml-auto text-xs text-amber-500 hover:underline">Recarregar</button>
          </div>
        )}

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
            disabled={!isNearHQ || checkingLocation}
            className="w-full text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg disabled:opacity-30 disabled:grayscale"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
          >
            {checkingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Registrar Entrada
          </button>
        )}
      </div>

      {/* Driving Score Section */}
      {drivingScore !== null && (
        <div className="rounded-2xl p-6 shadow-lg border max-w-lg" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Score de Direção (Última Viagem)
            </div>
            <div className="text-2xl font-black" style={{ color: drivingScore >= 9 ? '#22c55e' : drivingScore >= 7 ? '#f59e0b' : '#ef4444' }}>
              {drivingScore.toFixed(1)}/10
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Sua nota influencia bônus mensais e segurança.</p>
        </div>
      )}

      {/* Payment Summary */}
      <div className="rounded-2xl p-8 shadow-lg" style={{ background: '#1a1a1a' }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" style={{ color: '#D4AF37' }} /> Resumo de Pagamento
        </h3>

        <div className="flex gap-3 mb-6 flex-wrap">
          {(['week', 'biweekly', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={period === p
                ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)', color: '#000' }
                : { background: '#2a2a2a', color: '#aaa' }
              }
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
          <div className="rounded-xl p-5 text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">Valor/h</p>
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
              <p className="text-xs text-amber-400 font-bold uppercase mb-1">⛽ V.Combust.</p>
              <p className="text-2xl font-black text-amber-400">+R$ {fuelAllowance.toFixed(2)}</p>
            </div>
          )}
          {deductions > 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p className="text-xs text-red-400 font-bold uppercase mb-1">Descontos</p>
              <p className="text-2xl font-black text-red-400">-R$ {deductions.toFixed(2)}</p>
            </div>
          )}
          <div className="rounded-xl p-5 text-center col-span-full md:col-span-1" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.5)' }}>
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
          <div className="rounded-xl p-4 space-y-3 border mb-4" style={{ background: '#111', borderColor: 'rgba(212,175,55,0.25)' }}>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Valor (R$)</label>
              <input
                type="number"
                value={valeAmount}
                onChange={e => setValeAmount(e.target.value)}
                placeholder="Ex: 200"
                className="w-full p-3 rounded-xl text-sm mt-1 text-white"
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
                className="w-full p-3 rounded-xl text-sm mt-1 text-white"
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
                req.status === 'Recusado' ? 'bg-red-900 text-red-300' : ''
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
