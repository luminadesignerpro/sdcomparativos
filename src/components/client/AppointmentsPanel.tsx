import React, { useState, useEffect } from 'react';
import { Clock, Plus, CheckCircle, AlertCircle, Loader2, Wrench, Users, Shield, X, User, MapPin, Phone, CalendarClock, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";



interface Appointment {
    id: string;
    type: string;
    title: string;
    description: string | null;
    preferred_date: string;
    preferred_time: string;
    status: string;
    admin_notes: string | null;
    created_at: string;
    client_name: string | null;
    client_address: string | null;
    client_phone: string | null;
}

const APPOINTMENT_TYPES = [
    { value: 'visita_tecnica', label: 'Visita Técnica', icon: Wrench, desc: 'Medição, instalação ou manutenção' },
    { value: 'reuniao_projeto', label: 'Reunião de Projeto', icon: Users, desc: 'Discutir detalhes do projeto' },
    { value: 'assistencia', label: 'Assistência/Pós-venda', icon: Shield, desc: 'Garantia ou reparo' },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    pendente: { label: 'Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Clock },
    confirmado: { label: 'Confirmado', color: 'text-green-400 bg-green-500/10 border-green-500/30', icon: CheckCircle },
    cancelado: { label: 'Cancelado', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: AlertCircle },
    concluido: { label: 'Concluído', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: CheckCircle },
};

const TIME_SLOTS = [
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30',
    '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
];

interface AppointmentsPanelProps {
    clientId?: string;
    clientName?: string;
    projectId?: string;
}

const AppointmentsPanel: React.FC<AppointmentsPanelProps> = ({ clientId, clientName, projectId }) => {
    const { toast } = useToast();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingApt, setEditingApt] = useState<Appointment | null>(null);
    const [concludingId, setConcludingId] = useState<string | null>(null);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

    // Alarm state
    const [activeAlarm, setActiveAlarm] = useState<Appointment | null>(null);
    const [dismissedAlarms, setDismissedAlarms] = useState<Set<string>>(new Set());
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [alarmIntervalId, setAlarmIntervalId] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');

    // Form state
    const [type, setType] = useState('visita_tecnica');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [preferredDate, setPreferredDate] = useState<Date | undefined>(undefined);
    const [preferredTime, setPreferredTime] = useState('09:00');
    const [clientNameInput, setClientNameInput] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientPhone, setClientPhone] = useState('');

    // Fetch appointments
    useEffect(() => {
        fetchAppointments();

        const channel = supabase
            .channel('appointments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                fetchAppointments();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clientId]);

    const fetchAppointments = async () => {
        setLoading(true);
        let query = supabase.from('appointments').select('*').order('preferred_date', { ascending: true });
        if (clientId) query = query.eq('client_id', clientId);
        const { data, error } = await query;
        if (!error && data) {
            // Sort by:
            // 1. Active (pendente/confirmado) at the top, sorted by date ascending (closest first)
            // 2. Inactive (concluido/cancelado) at the bottom, sorted by date descending (most recent first)
            const sorted = [...data].sort((a, b) => {
                const isAActive = a.status === 'pendente' || a.status === 'confirmado';
                const isBActive = b.status === 'pendente' || b.status === 'confirmado';

                if (isAActive && !isBActive) return -1;
                if (!isAActive && isBActive) return 1;

                const timeA = new Date(`${a.preferred_date}T${a.preferred_time || '00:00'}:00`).getTime();
                const timeB = new Date(`${b.preferred_date}T${b.preferred_time || '00:00'}:00`).getTime();

                if (isAActive) {
                    return timeA - timeB;
                } else {
                    return timeB - timeA;
                }
            });
            setAppointments(sorted);
        }
        setLoading(false);
    };

    // Alarm sound player
    const triggerAlarm = (apt: Appointment) => {
        setActiveAlarm(apt);
        
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(ctx);
            
            const interval = setInterval(() => {
                const playBeep = (delay: number, duration: number, frequency: number) => {
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    
                    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
                    osc.type = 'sine';
                    
                    gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration - 0.05);
                    
                    osc.start(ctx.currentTime + delay);
                    osc.stop(ctx.currentTime + delay + duration);
                };
                
                // Double alarm tone (similar to clock)
                playBeep(0, 0.15, 880);
                playBeep(0.25, 0.15, 880);
            }, 1000);
            
            setAlarmIntervalId(interval);
        } catch (error) {
            console.error('Erro ao iniciar o alarme sonoro:', error);
        }
    };

    const handleDismissAlarm = () => {
        if (activeAlarm) {
            setDismissedAlarms(prev => {
                const next = new Set(prev);
                next.add(activeAlarm.id);
                return next;
            });
            setActiveAlarm(null);
        }
        
        if (alarmIntervalId) {
            clearInterval(alarmIntervalId);
            setAlarmIntervalId(null);
        }
        
        if (audioContext) {
            audioContext.close();
            setAudioContext(null);
        }
    };

    // Check for due appointments
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const todayStr = format(now, 'yyyy-MM-dd');
            
            const dueAppointment = appointments.find(apt => {
                if (apt.status !== 'pendente' && apt.status !== 'confirmado') return false;
                if (dismissedAlarms.has(apt.id)) return false;
                if (activeAlarm?.id === apt.id) return false;
                
                // Check if appointment is today
                if (apt.preferred_date !== todayStr) return false;
                
                try {
                    const [aptHour, aptMin] = apt.preferred_time.split(':').map(Number);
                    const aptDateTime = new Date();
                    aptDateTime.setHours(aptHour, aptMin, 0, 0);
                    
                    const diffMs = now.getTime() - aptDateTime.getTime();
                    const diffMins = diffMs / (1000 * 60);
                    
                    // Trigger if we are at or after the appointment (up to 30 mins)
                    return diffMins >= 0 && diffMins <= 30;
                } catch (e) {
                    return false;
                }
            });

            if (dueAppointment) {
                triggerAlarm(dueAppointment);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [appointments, dismissedAlarms, activeAlarm]);

    // Ensure audio cleanup on unmount
    useEffect(() => {
        return () => {
            if (alarmIntervalId) clearInterval(alarmIntervalId);
            if (audioContext) audioContext.close();
        };
    }, [alarmIntervalId, audioContext]);

    const handleSubmit = async () => {
        if (!preferredDate) {
            toast({ title: '⚠️ Selecione uma data', description: 'A data do agendamento é obrigatória', variant: 'destructive' });
            return;
        }

        setSubmitting(true);
        const dateStr = format(preferredDate, 'yyyy-MM-dd');

        // Auto-preenche o título se estiver vazio
        const typeLabel = APPOINTMENT_TYPES.find(t => t.value === type)?.label || type;
        const autoTitle = title.trim() || `${typeLabel}${clientNameInput.trim() ? ' - ' + clientNameInput.trim() : ''}`;

        const payload = {
            client_id: clientId || null,
            project_id: projectId || null,
            type,
            title: autoTitle,
            description: description.trim() || null,
            preferred_date: dateStr,
            preferred_time: preferredTime,
            status: editingApt ? editingApt.status : 'pendente',
            client_name: clientNameInput.trim() || clientName || null,
            client_address: clientAddress.trim() || null,
            client_phone: clientPhone.trim() || null,
        };

        const { error } = editingApt 
            ? await supabase.from('appointments').update(payload).eq('id', editingApt.id)
            : await supabase.from('appointments').insert(payload);

        if (error) {
            console.error('Erro ao salvar agendamento:', error);
            toast({ title: '❌ Erro ao salvar', description: error.message || 'Verifique os campos e tente novamente', variant: 'destructive' });
        } else {
            toast({ title: `✅ Agendamento ${editingApt ? 'atualizado' : 'solicitado'}!`, description: 'Você será notificado quando for confirmado.' });

            if (!editingApt) {
                // Send WhatsApp notification for new appointments
                try {
                    await supabase.functions.invoke('whatsapp-send', {
                        body: {
                            phone: '5500000000000', // Admin phone - placeholder
                            message: `📅 *Novo Agendamento*\n\n👤 Cliente: ${clientNameInput || clientName || 'N/A'}\n📋 Tipo: ${typeLabel}\n📝 ${autoTitle}\n📅 Data: ${format(preferredDate, "dd/MM/yyyy", { locale: ptBR })}\n⏰ Horário: ${preferredTime}${description ? `\n\n📄 Obs: ${description}` : ''}`,
                        },
                    });
                } catch (e) {}
            }

            resetForm();
        }
        setSubmitting(false);
    };

    const handleEdit = (apt: Appointment) => {
        setEditingApt(apt);
        setType(apt.type);
        setTitle(apt.title);
        setDescription(apt.description || '');
        setPreferredDate(new Date(apt.preferred_date + 'T12:00:00'));
        setPreferredTime(apt.preferred_time);
        setClientNameInput(apt.client_name || '');
        setClientAddress(apt.client_address || '');
        setClientPhone(apt.client_phone || '');
        setShowForm(true);
    };

    const handleConcludeApt = async (id: string) => {
        setConcludingId(id);
        const { error } = await supabase.from('appointments').update({ status: 'concluido' }).eq('id', id);
        if (error) {
            toast({ title: '❌ Erro ao concluir', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: '✅ Agendamento concluído!', description: 'Salvo no histórico com sucesso.' });
        }
        setConcludingId(null);
    };

    const handleCancelApt = async (id: string) => {
        const { error } = await supabase.from('appointments').update({ status: 'cancelado' }).eq('id', id);
        if (error) toast({ title: '❌ Erro ao cancelar', description: error.message, variant: 'destructive' });
        else toast({ title: '🚫 Agendamento cancelado' });
    };

    const handleDeleteApt = async (id: string) => {
        if (!confirm('⚠️ Deseja realmente excluir permanentemente este agendamento? Esta ação não pode ser desfeita.')) return;
        
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) {
            toast({ title: '❌ Erro ao remover', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: '🗑️ Agendamento excluído', description: 'O agendamento foi removido com sucesso.' });
            fetchAppointments();
        }
    };

    const handleRemarcar = (apt: Appointment) => {
        handleEdit(apt);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingApt(null);
        setTitle('');
        setDescription('');
        setPreferredDate(undefined);
        setPreferredTime('09:00');
        setType('visita_tecnica');
        setClientNameInput('');
        setClientAddress('');
        setClientPhone('');
    };

    const upcomingAppointments = appointments.filter(apt => apt.status === 'pendente' || apt.status === 'confirmado');
    const historyAppointments = appointments.filter(apt => apt.status === 'concluido' || apt.status === 'cancelado');
    const displayedAppointments = activeTab === 'upcoming' ? upcomingAppointments : historyAppointments;

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="p-4 md:p-8 pt-6 md:pt-10 space-y-6 overflow-auto h-full">
            {/* Header - Sticky with glass effect to prevent overlap issues */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-4 -mx-4 px-4 md:-mx-8 md:px-8 flex items-center justify-between border-b border-border/50 mb-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
                        <CalendarIcon className="w-7 h-7 text-primary" />
                        Agendamentos
                    </h2>
                    <p className="text-muted-foreground text-[10px] md:text-xs uppercase font-bold tracking-wider mt-1 opacity-70">Sincronização em tempo real</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-black text-xs md:text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 touch-manipulation"
                >
                    <Plus className="w-4 h-4" />
                    NOVO AGENDAMENTO
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-foreground">{editingApt ? 'Editar' : 'Novo'} Agendamento</h3>
                        <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1">
                            <X className="w-5 h-5" />
                        </button>
                        </div>

                        {/* Type Selection */}
                        <div className="space-y-3 mb-5">
                            <label className="text-sm font-semibold text-foreground">Tipo</label>
                            <div className="grid gap-2">
                                {APPOINTMENT_TYPES.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setType(t.value)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left touch-manipulation ${type === t.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                                            }`}
                                    >
                                        <t.icon className="w-5 h-5 shrink-0" />
                                        <div>
                                            <p className="font-semibold text-sm">{t.label}</p>
                                            <p className="text-xs opacity-70">{t.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Cliente Info */}
                        <div className="space-y-3 mb-4">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <User className="w-4 h-4 text-primary" /> Nome do Cliente *
                            </label>
                            <input
                                type="text"
                                value={clientNameInput}
                                onChange={(e) => setClientNameInput(e.target.value)}
                                placeholder="Nome completo do cliente"
                                className="w-full h-11 bg-background rounded-xl px-4 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                maxLength={100}
                            />
                        </div>

                        <div className="space-y-3 mb-4">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Phone className="w-4 h-4 text-primary" /> Celular
                            </label>
                            <input
                                type="tel"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full h-11 bg-background rounded-xl px-4 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                maxLength={20}
                            />
                        </div>

                        <div className="space-y-3 mb-4">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary" /> Endereço
                            </label>
                            <input
                                type="text"
                                value={clientAddress}
                                onChange={(e) => setClientAddress(e.target.value)}
                                placeholder="Rua, número, bairro, cidade"
                                className="w-full h-11 bg-background rounded-xl px-4 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                maxLength={200}
                            />
                        </div>

                        {/* Title */}
                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-semibold text-foreground">Título *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Medição da cozinha"
                                className="w-full h-11 bg-background rounded-xl px-4 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                maxLength={100}
                            />
                        </div>

                        {/* Date & Time */}
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Data *</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full h-11 justify-start text-left font-normal rounded-xl border-border px-4",
                                                !preferredDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {preferredDate ? format(preferredDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={preferredDate}
                                            onSelect={setPreferredDate}
                                            initialFocus
                                            locale={ptBR}
                                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Horário</label>
                                <select
                                    value={preferredTime}
                                    onChange={(e) => setPreferredTime(e.target.value)}
                                    className="w-full h-11 bg-background rounded-xl px-3 border border-border text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                                >
                                    {TIME_SLOTS.map((slot) => (
                                        <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2 mb-6">
                            <label className="text-sm font-semibold text-foreground">Observações</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes adicionais..."
                                rows={3}
                                className="w-full bg-background rounded-xl px-4 py-3 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all resize-none"
                                maxLength={500}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 touch-manipulation"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingApt ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {submitting ? 'Salvando...' : editingApt ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs Selector */}
            <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/40 max-w-xs mb-2">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={cn(
                        "flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200",
                        activeTab === 'upcoming' 
                            ? "bg-card text-foreground shadow-sm border border-border/10" 
                            : "text-muted-foreground/75 hover:text-foreground hover:bg-white/5"
                    )}
                >
                    📅 Próximos ({upcomingAppointments.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200",
                        activeTab === 'history' 
                            ? "bg-card text-foreground shadow-sm border border-border/10" 
                            : "text-muted-foreground/75 hover:text-foreground hover:bg-white/5"
                    )}
                >
                    ✅ Histórico ({historyAppointments.length})
                </button>
            </div>

            {/* Appointments List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : displayedAppointments.length === 0 ? (
                <div className="text-center py-16 bg-card/30 border border-border/50 rounded-2xl">
                    <CalendarIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">
                        {activeTab === 'upcoming' ? 'Nenhum agendamento pendente' : 'Histórico vazio'}
                    </p>
                    <p className="text-muted-foreground/60 text-sm mt-1">
                        {activeTab === 'upcoming' 
                            ? 'Clique em "Novo Agendamento" para começar' 
                            : 'Agendamentos concluídos ou cancelados aparecerão aqui.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedAppointments.map((apt) => {
                        const statusInfo = STATUS_MAP[apt.status] || STATUS_MAP.pendente;
                        const typeInfo = APPOINTMENT_TYPES.find((t) => t.value === apt.type);
                        const StatusIcon = statusInfo.icon;
                        const isConcluding = concludingId === apt.id;
                        const isActive = apt.status !== 'concluido' && apt.status !== 'cancelado';

                        return (
                            <div
                                key={apt.id}
                                style={{
                                    transition: 'opacity 0.4s ease, transform 0.4s ease, max-height 0.4s ease',
                                }}
                                className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:border-primary/30 transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            {typeInfo ? <typeInfo.icon className="w-5 h-5 text-primary" /> : <CalendarIcon className="w-5 h-5 text-primary" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-foreground text-sm truncate">{apt.title}</h4>
                                            <p className="text-muted-foreground text-xs mt-0.5">{typeInfo?.label || apt.type}</p>
                                            {(apt.client_name || clientName) && (
                                                <p className="text-xs text-foreground/80 mt-1 flex items-center gap-1">
                                                    <User className="w-3 h-3 text-primary shrink-0" />
                                                    {apt.client_name || clientName}
                                                </p>
                                            )}
                                            {apt.client_phone && (
                                                <p className="text-xs text-foreground/80 mt-0.5 flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-primary shrink-0" />
                                                    {apt.client_phone}
                                                </p>
                                            )}
                                            {apt.client_address && (
                                                <p className="text-xs text-foreground/80 mt-0.5 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                                                    {apt.client_address}
                                                </p>
                                            )}
                                            {apt.description && (
                                                <p className="text-muted-foreground/70 text-xs mt-1 line-clamp-2">{apt.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.color}`}>
                                            <StatusIcon className="w-3.5 h-3.5" />
                                            {statusInfo.label}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteApt(apt.id)}
                                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all mt-1 active:scale-90"
                                            title="Excluir agendamento"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        {format(new Date(apt.preferred_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {apt.preferred_time}
                                    </span>
                                </div>

                                {apt.admin_notes && (
                                    <div className="mt-3 bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                                        <p className="text-xs text-primary font-medium">📝 Resposta da equipe:</p>
                                        <p className="text-xs text-foreground/80 mt-1">{apt.admin_notes}</p>
                                    </div>
                                )}


                                {/* Action Buttons - always visible */}
                                <div className="flex gap-2 mt-4 pt-3 border-t border-border/40">
                                    {/* Concluído */}
                                    <button
                                        onClick={() => handleConcludeApt(apt.id)}
                                        disabled={isConcluding}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-green-500/15 text-green-400 border border-green-500/30 text-xs font-bold hover:bg-green-500/25 active:scale-95 transition-all touch-manipulation disabled:opacity-50"
                                    >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Concluído
                                    </button>
                                    {/* Remarcar */}
                                    <button
                                        onClick={() => handleRemarcar(apt)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary/10 text-primary border border-primary/30 text-xs font-bold hover:bg-primary/20 active:scale-95 transition-all touch-manipulation"
                                    >
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        Remarcar
                                    </button>
                                    {/* Cancelar */}
                                    <button
                                        onClick={() => handleCancelApt(apt.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500/20 active:scale-95 transition-all touch-manipulation"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Cancelar
                                    </button>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            {/* Alarm Overlay Modal */}
            {activeAlarm && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-card border-2 border-red-500/40 rounded-3xl p-8 w-full max-w-md shadow-2xl text-center border-t-red-500/60 animate-in zoom-in-95 duration-200">
                        <div className="relative w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30 animate-bounce">
                            <Clock className="w-10 h-10 text-red-500 animate-pulse" />
                            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75"></div>
                        </div>
                        
                        <h3 className="text-2xl font-black text-foreground mb-2 uppercase tracking-wide">
                            ⏰ Hora do Atendimento!
                        </h3>
                        <p className="text-muted-foreground text-sm mb-6">
                            O despertador foi acionado para o seguinte compromisso:
                        </p>

                        <div className="bg-muted/50 rounded-2xl p-5 mb-6 text-left border border-border">
                            <p className="font-bold text-foreground text-base mb-1">{activeAlarm.title}</p>
                            <p className="text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                                {APPOINTMENT_TYPES.find(t => t.value === activeAlarm.type)?.label || activeAlarm.type}
                            </p>
                            
                            {activeAlarm.client_name && (
                                <p className="text-xs text-foreground/80 flex items-center gap-1.5 mb-1">
                                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="font-semibold">Cliente:</span> {activeAlarm.client_name}
                                </p>
                            )}
                            
                            <p className="text-xs text-foreground/80 flex items-center gap-1.5 mb-1">
                                <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-semibold">Data:</span> {format(new Date(activeAlarm.preferred_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            
                            <p className="text-xs text-foreground/80 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-semibold">Horário:</span> {activeAlarm.preferred_time}
                            </p>
                        </div>

                        <button
                            onClick={handleDismissAlarm}
                            className="w-full h-14 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2 text-center"
                        >
                            🔕 DESLIGAR DESPERTADOR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentsPanel;
