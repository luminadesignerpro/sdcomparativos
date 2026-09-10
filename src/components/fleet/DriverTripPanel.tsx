import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const db = supabaseClient as any;
import { useToast } from '@/hooks/use-toast';
import { Navigation, Play, Square, MapPin, Clock, Route, AlertTriangle, Camera, CheckSquare, Send, X, Image, PackageCheck, Fuel, Terminal, ClipboardList, User, Star, Share2 } from 'lucide-react';
import SignaturePad from '@/components/employee/SignaturePad';
import ToolInventory from '@/components/employee/ToolInventory';
import FuelLogForm from '@/components/fleet/FuelLogForm';
import { Geolocation } from '@capacitor/geolocation';
import { gpsTracker, GpsLogEntry } from '@/services/gpsTracker';

interface Trip {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  description: string | null;
  montagem_status: string;
  created_at?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  sort_order: number;
  checklist_type: string;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface ServiceOrder {
  id: string;
  order_number: number;
  description: string | null;
  notes: string | null;
  priority: string;
  status: string;
  estimated_date: string | null;
  completed_at: string | null;
  created_at: string;
  total_value: number | null;
  clients: { name: string; address: string | null } | null;
}

interface DriverTripPanelProps {
  employeeId: string;
  employeeName: string;
}

const DAILY_CHECKLIST = [
  'Conferir ferramentas (nível, parafusadeira, martelo, serras)',
  'Verificar carga de baterias das máquinas',
  'Conferir ferragens e puxadores do dia',
  'Validar se o veículo está abastecido e pneus calibrados',
  'Conferir projeto técnico e especificações',
  'Área de trabalho organizada no início do dia',
  'Uso de EPIs (botinas, luvas, óculos se necessário)',
];

const DELIVERY_CHECKLIST = [
  'Móveis nivelados e frentes alinhadas',
  'Gavetas deslizando suavemente e portas reguladas',
  'Puxadores instalados, firmes e alinhados',
  'Furos de fixação com acabamento (tapa-furo)',
  'Limpeza completa dos móveis (cola, pó e marcas)',
  'Ambiente do cliente limpo e organizado',
  'Explicação de uso e garantia ao cliente',
  'Ferramentas e sobras de material recolhidas',
  'Assinatura Digital do Cliente',
];

export default function DriverTripPanel({ employeeId, employeeName }: DriverTripPanelProps) {
  const { toast } = useToast();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationCount, setLocationCount] = useState(0);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState(employeeId);

  // Service Orders
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [activeServiceOrder, setActiveServiceOrder] = useState<ServiceOrder | null>(null);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);

  const [dailyChecklist, setDailyChecklist] = useState<ChecklistItem[]>(
    DAILY_CHECKLIST.map((label, i) => ({
      id: `init-daily-${i}`,
      label,
      checked: false,
      sort_order: i,
      checklist_type: 'daily',
    })) as any
  );
  const [deliveryChecklist, setDeliveryChecklist] = useState<ChecklistItem[]>(
    DELIVERY_CHECKLIST.map((label, i) => ({
      id: `init-del-${i}`,
      label,
      checked: false,
      sort_order: i + 100,
      checklist_type: 'delivery',
    })) as any
  );
  const [showDailyChecklist, setShowDailyChecklist] = useState(true);
  const [showDeliveryChecklist, setShowDeliveryChecklist] = useState(true);

  const [showSOS, setShowSOS] = useState(false);
  const [sosType, setSosType] = useState('Peça danificada');
  const [sosDesc, setSosDesc] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const [tripPhotos, setTripPhotos] = useState<{ id: string; image_url: string; description: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showFuel, setShowFuel] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [gpsLogs, setGpsLogs] = useState<GpsLogEntry[]>([]);

  // Periodically refresh logs when debug is open
  useEffect(() => {
    if (!showDebug) return;
    const interval = setInterval(() => {
      setGpsLogs([...gpsTracker.getLogs()]);
    }, 2000);
    return () => clearInterval(interval);
  }, [showDebug]);

  const isDeliveryMode = activeTrip?.montagem_status === 'concluida';

  useEffect(() => {
    fetchEmployeeAndTrips();
    fetchVehicles();
    // When component remounts (user returns to tab), reconnect the GPS callback
    // so locationCount stays in sync — but DO NOT stop tracking on unmount!
    return () => {
      // Only detach callback, do NOT call gpsTracker.stop() here.
      // Tracking continues in background when user switches tabs.
      gpsTracker.setCallback(() => { });
    };
  }, [employeeId, employeeName]);

  // Fetch service orders whenever resolvedEmployeeId changes
  useEffect(() => {
    if (resolvedEmployeeId) {
      fetchServiceOrders(resolvedEmployeeId);
    }
  }, [resolvedEmployeeId]);

  useEffect(() => {
    if (!resolvedEmployeeId) return;

    const syncInterval = setInterval(() => {
      void fetchTrips(resolvedEmployeeId, false);
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [resolvedEmployeeId]);

  useEffect(() => {
    if (activeTrip && activeTrip.id) {
      Geolocation.requestPermissions()
        .catch(() => { })
        .finally(() => {
          // Start (or reconnect to) GPS tracking via the singleton
          void gpsTracker.start(activeTrip.id, () => setLocationCount(prev => prev + 1));
        });
      fetchChecklists(activeTrip.id);
      fetchPhotos(activeTrip.id);
    }
  }, [activeTrip?.id]);

  const fetchVehicles = async () => {
    const { data } = await db.from('vehicles').select('id, plate, model').eq('active', true);
    if (data) {
      const uniqueVehicles = data.reduce((acc: Vehicle[], current: Vehicle) => {
        const x = acc.find(item => item.plate === current.plate);
        if (!x) return acc.concat([current]);
        else return acc;
      }, []);
      setVehicles(uniqueVehicles);
    }
  };

  const fetchServiceOrders = async (empId: string) => {
    try {
      const { data } = await db
        .from('service_orders')
        .select('id, order_number, description, notes, priority, status, estimated_date, completed_at, created_at, total_value, clients(name, address)')
        .eq('assigned_to', empId)
        .in('status', ['aberta', 'em_andamento'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (data && data.length > 0) {
        setServiceOrders(data as ServiceOrder[]);
        // Set the most recent open OS as active
        const firstOpen = data.find((o: ServiceOrder) => o.status === 'aberta') || data[0];
        setActiveServiceOrder(firstOpen as ServiceOrder);
      } else {
        setServiceOrders([]);
        setActiveServiceOrder(null);
      }
    } catch (err) {
      console.error('[OS] Error fetching service orders:', err);
    }
  };

  const fetchEmployeeAndTrips = async (showLoader = true) => {
    if (showLoader) setLoading(true);

    let resolvedId = employeeId;
    if (!resolvedId) {
      const search = employeeName.trim().toLowerCase();
      if (!search) {
        if (showLoader) setLoading(false);
        return;
      }

      const { data: empData } = await db
        .from('employees')
        .select('id, name, email')
        .eq('active', true)
        .or(`name.ilike.${search},email.ilike.${search}`);

      const exactMatch = (empData || []).find(
        (employee: any) => employee?.name?.toLowerCase() === search || employee?.email?.toLowerCase() === search
      );

      if (exactMatch?.id) {
        resolvedId = exactMatch.id;
      } else if (empData?.[0]?.id) {
        resolvedId = empData[0].id;
      } else {
        if (showLoader) setLoading(false);
        return;
      }
    }

    await fetchTrips(resolvedId, showLoader);
  };

  const fetchTrips = async (empId: string, finishLoading = true) => {
    const { data: activeTripsData } = await db
      .from('trips')
      .select('*')
      .eq('employee_id', empId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(5);

    if ((activeTripsData?.length || 0) > 1) {
      console.warn('[TRIP] Mais de uma viagem ativa encontrada para o funcionário. Retomando a mais recente.');
    }

    const latestActive = (activeTripsData?.[0] as Trip | undefined) || null;

    if (latestActive) {
      setActiveTrip(latestActive);
      const { count } = await db
        .from('trip_locations')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', latestActive.id);
      setLocationCount(count || 0);
    } else {
      setActiveTrip(null);
      setLocationCount(0);
    }

    const { data: recent } = await db
      .from('trips')
      .select('*')
      .eq('employee_id', empId)
      .or('status.eq.completed,ended_at.not.is.null')
      .order('started_at', { ascending: false })
      .limit(10);

    if (recent) setRecentTrips(recent as Trip[]);
    setResolvedEmployeeId(empId);

    if (finishLoading) {
      setLoading(false);
    }
  };

  const fetchChecklists = async (tripId: string) => {
    try {
      const { data, error } = await db
        .from('trip_checklists')
        .select('*')
        .eq('trip_id', tripId)
        .order('sort_order');

      if (error) throw error;

      const daily = (data || []).filter((c: any) => c.checklist_type === 'daily');
      const delivery = (data || []).filter((c: any) => c.checklist_type === 'delivery');

      if (daily.length > 0) setDailyChecklist(daily);
      else setDailyChecklist(DAILY_CHECKLIST.map((label, i) => ({ id: `temp-daily-${i}`, label, checked: false, sort_order: i, checklist_type: 'daily' })) as any);

      if (delivery.length > 0) setDeliveryChecklist(delivery);
      else setDeliveryChecklist(DELIVERY_CHECKLIST.map((label, i) => ({ id: `temp-del-${i}`, label, checked: false, sort_order: i + 100, checklist_type: 'delivery' })) as any);

      if (!data || data.length === 0) {
        const dailyItems = DAILY_CHECKLIST.map((label, i) => ({
          trip_id: tripId, label, checked: false, sort_order: i, checklist_type: 'daily' as string,
        }));
        const deliveryItems = DELIVERY_CHECKLIST.map((label, i) => ({
          trip_id: tripId, label, checked: false, sort_order: i + 100, checklist_type: 'delivery' as string,
        }));
        await db.from('trip_checklists').insert([...dailyItems, ...deliveryItems]);
      }
    } catch (error: any) {
      console.error('CRITICAL Error fetching checklists:', error);
      setDailyChecklist(DAILY_CHECKLIST.map((label, i) => ({ id: `err-${i}`, label, checked: false, sort_order: i, checklist_type: 'daily' })) as any);
      setDeliveryChecklist(DELIVERY_CHECKLIST.map((label, i) => ({ id: `err-del-${i}`, label, checked: false, sort_order: i + 100, checklist_type: 'delivery' })) as any);
    }
  };

  const fetchPhotos = async (tripId: string) => {
    const { data } = await db
      .from('trip_photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at');
    if (data) {
      setTripPhotos(data);
      const signature = data.find((p: any) => p.description === 'Assinatura do Cliente');
      if (signature) setSignatureUrl(signature.image_url);
    }
  };

  const startTracking = useCallback((tripId: string) => {
    // Delegate to the singleton (no-op if already tracking this trip)
    void gpsTracker.start(tripId, () => setLocationCount(prev => prev + 1));
  }, []);

  const stopTracking = useCallback(() => {
    // Only used when a trip actually ends
    gpsTracker.stop();
  }, []);

  const startTrip = async (description?: string) => {
    // Request GPS permission but NEVER block trip creation
    let gpsAvailable = true;
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') {
        gpsAvailable = false;
        toast({
          title: '⚠️ GPS sem permissão',
          description: 'A viagem será criada, mas o rastreamento pode não funcionar. Habilite a localização nas configurações.',
        });
      }
    } catch (e) {
      gpsAvailable = false;
      console.log('GPS permission error (non-blocking):', e);
    }

    if (!selectedVehicleId) {
      toast({ title: '⚠️ Selecione um veículo', variant: 'destructive' });
      return;
    }

    // Check if daily checklist is complete
    const uncheckedDaily = dailyChecklist.filter(c => !c.checked);
    if (uncheckedDaily.length > 0) {
      setShowDailyChecklist(true);
      toast({ 
        title: '⚠️ Checklist Pendente', 
        description: `Complete os ${uncheckedDaily.length} itens do checklist diário antes de sair.`, 
        variant: 'destructive' 
      });
      return;
    }

    const finalEmployeeId = resolvedEmployeeId || employeeId;
    if (!finalEmployeeId) {
      toast({ title: '❌ Erro ao iniciar viagem', description: 'Funcionário não identificado. Faça login novamente.', variant: 'destructive' });
      return;
    }

    const { data: existingActiveTrip } = await db
      .from('trips')
      .select('*')
      .eq('employee_id', finalEmployeeId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingActiveTrip) {
      setActiveTrip(existingActiveTrip as Trip);
      const { count } = await db
        .from('trip_locations')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', existingActiveTrip.id);

      setLocationCount(count || 0);
      startTracking(existingActiveTrip.id);
      toast({
        title: '🔄 Viagem retomada',
        description: 'Já existe uma viagem ativa para você. Continuando rastreamento automaticamente.',
      });
      return;
    }

    // Build description from active service order if not explicitly provided
    const osDesc = activeServiceOrder
      ? `OS #${activeServiceOrder.order_number} — ${activeServiceOrder.clients?.name || 'Cliente'}: ${activeServiceOrder.description || activeServiceOrder.clients?.address || ''}`
      : description || null;

    console.log('[TRIP] Creating trip:', { finalEmployeeId, selectedVehicleId, gpsAvailable, osDesc });

    const { data, error } = await db
      .from('trips')
      .insert({
        employee_id: finalEmployeeId,
        description: osDesc,
        vehicle_id: selectedVehicleId,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('[TRIP] Insert error:', JSON.stringify(error));
      toast({ title: '❌ Erro ao iniciar viagem', description: `${error.message} (code: ${error.code})`, variant: 'destructive' });
      return;
    }

    // Mark linked OS as em_andamento
    if (activeServiceOrder) {
      await db
        .from('service_orders')
        .update({ status: 'em_andamento' })
        .eq('id', activeServiceOrder.id);
      setLinkedOrderId(activeServiceOrder.id);
    }

    console.log('[TRIP] Trip created successfully:', data.id);
    setActiveTrip(data as Trip);
    setLocationCount(0);
    startTracking(data.id);
    toast({ 
      title: '🚗 Viagem iniciada!', 
      description: gpsAvailable ? 'GPS rastreando a cada 30s' : 'Viagem salva! GPS pode estar limitado.' 
    });
  };

  const shareTrackingLink = () => {
    if (!activeTrip) return;
    const url = `${window.location.origin}${window.location.pathname}?tripId=${activeTrip.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "🔗 Link de Rastreio Copiado!",
      description: "Envie este link para o cliente acompanhar em tempo real.",
    });
  };

  const setMontagemConcluida = async () => {
    if (!activeTrip) return;

    const uncheckedDelivery = deliveryChecklist.filter(c => !c.checked);
    if (uncheckedDelivery.length > 0) {
      setShowDeliveryChecklist(true);
      toast({ title: '⚠️ Complete o checklist de entrega', description: `${uncheckedDelivery.length} item(ns) pendente(s)`, variant: 'destructive' });
      return;
    }

    const { error } = await db
      .from('trips')
      .update({ montagem_status: 'concluida' })
      .eq('id', activeTrip.id);

    if (!error) {
      setActiveTrip(prev => prev ? { ...prev, montagem_status: 'concluida' } : null);
      toast({ title: '✅ Montagem marcada como concluída!', description: 'Agora colete a assinatura do cliente.' });
    }
  };

  const endTrip = async () => {
    if (!activeTrip) return;

    // Stop GPS tracking (trip is done)
    gpsTracker.forceSyncPending();
    gpsTracker.stop();

    const { error: endError } = await db
      .from('trips')
      .update({ 
        status: 'completed', 
        ended_at: new Date().toISOString(),
        end_time: new Date().toISOString() // Ensure BOTH columns are updated for compatibility
      })
      .eq('id', activeTrip.id);

    if (endError) {
      toast({ title: "❌ Erro ao finalizar viagem", description: endError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (error) {
      toast({ title: '❌ Erro ao finalizar', description: error.message, variant: 'destructive' });
      return;
    }

    // Mark linked OS as concluida
    const osId = linkedOrderId || activeServiceOrder?.id;
    if (osId) {
      await db
        .from('service_orders')
        .update({ status: 'concluida', completed_at: new Date().toISOString() })
        .eq('id', osId);
      setLinkedOrderId(null);
      setActiveServiceOrder(null);
      setServiceOrders([]);
    }

    toast({ title: '✅ Viagem do dia finalizada!' });
    setActiveTrip(null);
    setLocationCount(0);
    setDailyChecklist([]);
    setDeliveryChecklist([]);
    setTripPhotos([]);
    fetchEmployeeAndTrips();
  };

  const sendSOS = async () => {
    if (!activeTrip || !sosDesc.trim()) return;
    setSosSending(true);
    const { error } = await (db.from('trip_incidents') as any).insert({
      trip_id: activeTrip.id,
      type: sosType,
      description: sosDesc.trim(),
    });
    setSosSending(false);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🆘 Imprevisto reportado!', description: 'O administrador será notificado.' });
      setSosDesc('');
      setShowSOS(false);
    }
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTrip || !e.target.files?.length) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `${activeTrip.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await db.storage.from('trip-photos').upload(path, file);
    if (uploadErr) {
      toast({ title: '❌ Erro no upload', description: uploadErr.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = db.storage.from('trip-photos').getPublicUrl(path);
    await db.from('trip_photos').insert({
      trip_id: activeTrip.id,
      image_url: urlData.publicUrl,
    });

    await fetchPhotos(activeTrip.id);
    setUploading(false);
    toast({ title: '📸 Foto salva!' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveSignature = async (dataUrl: string) => {
    if (!activeTrip) return;
    setSavingSignature(true);

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `${activeTrip.id}/signature_${Date.now()}.png`;

      const { error: uploadErr } = await db.storage.from('trip-photos').upload(path, blob);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = db.storage.from('trip-photos').getPublicUrl(path);

      const { error: dbErr } = await db.from('trip_photos').insert({
        trip_id: activeTrip.id,
        image_url: urlData.publicUrl,
        description: 'Assinatura do Cliente',
      });
      if (dbErr) throw dbErr;

      setSignatureUrl(urlData.publicUrl);
      setShowSignaturePad(false);
      toast({ title: '✅ Assinatura salva!', description: 'Entrega finalizada com sucesso.' });

      const sigItem = deliveryChecklist.find(c => c.label === 'Assinatura Digital do Cliente');
      if (sigItem && !sigItem.checked) {
        toggleCheckItem(sigItem);
      }
    } catch (err: any) {
      console.error('Error saving signature:', err);
      toast({ title: '❌ Erro ao salvar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSignature(false);
    }
  };

  const formatTime = (iso: string | null | undefined) => {
    const dateStr = iso || activeTrip?.created_at;
    if (!dateStr) return '---';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '---';
      return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '---';
    }
  };

  const calcDuration = (start: string | null | undefined, end: string | null | undefined) => {
    const dateStr = start || activeTrip?.created_at;
    if (!dateStr) return '--h --min';
    try {
      const startDate = new Date(dateStr);
      const endDate = end ? new Date(end) : new Date();
      if (isNaN(startDate.getTime())) return '--h --min';
      const diffMs = endDate.getTime() - startDate.getTime();
      if (diffMs < 0) return '--h --min';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${String(minutes).padStart(2, '0')}min`;
    } catch (e) {
      return '--h --min';
    }
  };

  const toggleCheckItem = async (item: ChecklistItem) => {
    const newChecked = !item.checked;
    const listSetter = item.checklist_type === 'daily' ? setDailyChecklist : setDeliveryChecklist;

    listSetter(prev =>
      prev.map(c => c.id === item.id ? { ...c, checked: newChecked } : c)
    );

    if (!item.id.startsWith('init-') && !item.id.startsWith('temp-') && !item.id.startsWith('err-')) {
      await db.from('trip_checklists').update({ checked: newChecked }).eq('id', item.id);
    } else if (activeTrip) {
      const { data: inserted } = await db.from('trip_checklists').insert({
        trip_id: activeTrip.id,
        label: item.label,
        checked: newChecked,
        sort_order: item.sort_order,
        checklist_type: item.checklist_type,
      }).select().single();

      if (inserted) {
        listSetter(prev =>
          prev.map(c => c.id === item.id ? { ...c, id: inserted.id, checked: newChecked } : c)
        );
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <div className="rounded-xl p-5 shadow-lg border" style={{ background: 'linear-gradient(135deg, #1a1a1a, #000)', borderColor: 'rgba(212,175,55,0.4)' }}>
        <div className="flex items-center gap-3">
          <Navigation className="w-6 h-6" style={{ color: '#D4AF37' }} />
          <div>
            <h2 className="font-bold text-lg text-white">Painel do Motorista</h2>
            <p className="text-sm" style={{ color: '#D4AF37' }}>{employeeName}</p>
          </div>
        </div>
      </div>

      {activeTrip ? (
        <div className="space-y-4">
          <div className="rounded-xl p-5 shadow-inner border" style={{ background: '#111', borderColor: 'green' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="font-bold text-green-400">Viagem em Andamento</span>
              </div>
              {isDeliveryMode && (
                <span className="bg-purple-900/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/30">
                  ✅ Montagem Concluída
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl p-3 border" style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.05)' }}>
                <Clock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-bold">Início</p>
                <p className="text-sm font-bold text-white">{formatTime(activeTrip.started_at)}</p>
              </div>
              <div className="rounded-xl p-3 border" style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.05)' }}>
                <Route className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-bold">Duração</p>
                <p className="text-sm font-bold text-white">{calcDuration(activeTrip.started_at, null)}</p>
              </div>
              <div className="rounded-xl p-3 border" style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.05)' }}>
                <MapPin className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 uppercase font-bold">GPS</p>
                <p className="text-sm font-bold text-white">{locationCount} pts</p>
              </div>
            </div>

            {activeTrip.description && (
              <p className="mt-3 text-sm text-gray-300 rounded-lg p-3 border border-dashed border-gray-800" style={{ background: '#0a0a0a' }}>
                📍 {activeTrip.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowFuel(true)}
              className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95"
              style={{ background: '#1a1a1a', borderColor: 'rgba(249,115,22,0.3)', color: '#fdba74' }}
            >
              <Fuel className="w-5 h-5" />
              Abastecimento
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#1a1a1a', borderColor: 'rgba(37,99,235,0.3)', color: '#93c5fd' }}
            >
              <Camera className="w-5 h-5" />
              {uploading ? 'Enviando...' : 'Foto'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />

            <button
              onClick={() => setShowSOS(true)}
              className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95"
              style={{ background: '#1a1a1a', borderColor: 'rgba(220,38,38,0.3)', color: '#fca5a5' }}
            >
              <AlertTriangle className="w-5 h-5" />
              Imprevisto
            </button>

            {!isDeliveryMode ? (
              <button
                onClick={setMontagemConcluida}
                className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95"
                style={{ background: '#1a1a1a', borderColor: 'rgba(147,51,234,0.3)', color: '#d8b4fe' }}
              >
                <PackageCheck className="w-5 h-5" />
                Montagem
              </button>
            ) : (
              <button
                onClick={() => setShowSignaturePad(true)}
                className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95"
                style={{ background: '#1a1a1a', borderColor: 'rgba(79,70,229,0.3)', color: '#a5b4fc' }}
              >
                <CheckSquare className="w-5 h-5" />
                {signatureUrl ? '✅ Assinatura' : 'Assinatura'}
              </button>
            )}

            <button
              onClick={shareTrackingLink}
              className="flex items-center justify-center gap-2 rounded-xl p-4 font-bold border transition-all active:scale-95"
              style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37' }}
            >
              <Share2 className="w-5 h-5" />
              Enviar Rastreio
            </button>
          </div>

          {/* Debug GPS Section */}
          <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-full flex items-center justify-between p-3 text-slate-400 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-mono">
                <Terminal className="w-4 h-4" />
                <span>DEBUG GPS: {gpsTracker.isTracking() ? 'ATIVO' : 'PARADO'}</span>
              </div>
              <span className="text-[10px]">{showDebug ? 'ESCONDER' : 'MOSTRAR LOGS'}</span>
            </button>
            {showDebug && (
              <div className="p-2 pt-0 max-h-48 overflow-y-auto font-mono text-[10px] space-y-1">
                {gpsLogs.length === 0 ? (
                  <p className="text-slate-600 italic p-2">Sem logs registrados ainda...</p>
                ) : (
                  gpsLogs.map((log, i) => (
                    <div key={i} className={`border-l-2 pl-2 py-0.5 ${log.type === 'error' ? 'border-red-500 text-red-400' :
                      log.type === 'success' ? 'border-green-500 text-green-400' :
                        'border-blue-500 text-blue-300'
                      }`}>
                      <span className="text-slate-500 mr-1">[{log.timestamp}]</span>
                      {log.message}
                    </div>
                  ))
                )}
                <button
                  onClick={() => { gpsTracker.clearLogs(); setGpsLogs([]); }}
                  className="w-full mt-2 text-slate-500 hover:text-slate-300 underline text-[9px]"
                >
                  Limpar Logs
                </button>
              </div>
            )}
          </div>

          <ToolInventory employeeId={employeeId} />

          <div className="rounded-xl overflow-hidden border shadow-sm" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.2)' }}>
            <button
              onClick={() => setShowDailyChecklist(!showDailyChecklist)}
              className="w-full flex items-center justify-between p-4 hover:bg-black/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" style={{ color: '#D4AF37' }} />
                <span className="font-bold text-white">Checklist Diário</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#D4AF37', color: '#000' }}>
                  {dailyChecklist.filter(c => c.checked).length}/{dailyChecklist.length}
                </span>
              </div>
              <span className="text-gray-500">{showDailyChecklist ? '▲' : '▼'}</span>
            </button>
            {showDailyChecklist && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {dailyChecklist.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleCheckItem(item)}
                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-black/40 transition-colors group"
                    style={{ background: item.checked ? 'rgba(34,197,94,0.05)' : 'transparent' }}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'bg-green-500 border-green-500 scale-110' : 'border-gray-700 group-hover:border-gray-500'}`}>
                      {item.checked && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className={`text-sm font-medium transition-all ${item.checked ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl overflow-hidden border shadow-sm" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.2)' }}>
            <button
              onClick={() => setShowDeliveryChecklist(!showDeliveryChecklist)}
              className="w-full flex items-center justify-between p-4 hover:bg-black/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5" style={{ color: '#D4AF37' }} />
                <span className="font-bold text-white">Checklist de Entrega</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#D4AF37', color: '#000' }}>
                  {deliveryChecklist.filter(c => c.checked).length}/{deliveryChecklist.length}
                </span>
              </div>
              <span className="text-gray-500">{showDeliveryChecklist ? '▲' : '▼'}</span>
            </button>
            {showDeliveryChecklist && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {deliveryChecklist.map(item => (
                  <button
                    key={item.id}
                    onClick={() => item.label === 'Assinatura Digital do Cliente' ? setShowSignaturePad(true) : toggleCheckItem(item)}
                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-black/40 transition-colors group"
                    style={{ background: item.checked ? 'rgba(34,197,94,0.05)' : 'transparent' }}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'bg-green-500 border-green-500 scale-110' : 'border-gray-700 group-hover:border-gray-500'}`}>
                      {item.checked && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className={`text-sm font-medium transition-all ${item.checked ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {tripPhotos.filter(p => p.description !== 'Assinatura do Cliente').length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Image className="w-5 h-5 text-blue-600" />
                Fotos da Viagem ({tripPhotos.filter(p => p.description !== 'Assinatura do Cliente').length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {tripPhotos
                  .filter(p => p.description !== 'Assinatura do Cliente')
                  .map(photo => (
                    <a key={photo.id} href={photo.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={photo.image_url} alt="Foto da viagem" className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                    </a>
                  ))}
              </div>
            </div>
          )}

          {signatureUrl && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-green-600" />
                Assinatura do Cliente
              </h3>
              <img src={signatureUrl} alt="Assinatura do cliente" className="max-h-24 border border-gray-200 rounded-lg bg-gray-50 p-2" />
            </div>
          )}

          <button
            onClick={() => { if (window.confirm('Finalizar a viagem do dia?')) endTrip(); }}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl p-4 font-bold text-lg transition-colors"
          >
            <Square className="w-6 h-6" />
            Finalizar Viagem
          </button>
        </div>
      ) : (
        <div className="space-y-4" key="new-trip-form">

          {/* Service Orders Card */}
          {serviceOrders.length > 0 && (
            <div className="rounded-xl p-5 shadow-lg border" style={{ background: '#111', borderColor: 'rgba(212,175,55,0.3)' }}>
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#D4AF37' }}>
                <ClipboardList className="w-5 h-5" />
                Suas Ordens de Serviço ({serviceOrders.length})
              </h3>
              <div className="space-y-4">
                {serviceOrders.map(os => {
                  const priorityStyle: Record<string, string> = {
                    baixa: 'bg-gray-800 text-gray-400 border-gray-700',
                    normal: 'bg-blue-900/30 text-blue-300 border-blue-500/30',
                    alta: 'bg-orange-900/30 text-orange-300 border-orange-500/30',
                    urgente: 'bg-red-900/30 text-red-300 border-red-500/30',
                  };
                  const isSelected = activeServiceOrder?.id === os.id;
                  return (
                    <button
                      key={os.id}
                      onClick={() => setActiveServiceOrder(isSelected ? null : os)}
                      className={`w-full text-left rounded-xl p-4 border transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'shadow-[0_0_15px_rgba(212,175,55,0.15)] bg-black border-[#D4AF37]'
                          : 'bg-[#1a1a1a] border-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-col">
                          <span className={`font-black text-xs uppercase tracking-wider ${isSelected ? 'text-[#D4AF37]' : 'text-gray-500'}`}>
                            OS #{os.order_number}
                          </span>
                          {isSelected && <span className="text-[#D4AF37] text-[10px] font-bold mt-0.5 animate-pulse">✓ ATIVA PARA VIAGEM</span>}
                        </div>
                        <div className="flex gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityStyle[os.priority] || 'bg-gray-800 text-gray-400'}`}>
                            {os.priority.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      {os.clients && (
                        <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
                          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                          </div>
                          {os.clients.name}
                        </div>
                      )}
                      
                      {os.clients?.address && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 pl-8">
                          <MapPin className="w-3 h-3" />
                          {os.clients.address}
                        </div>
                      )}

                      {os.description && (
                        <p className="text-xs text-gray-400 pl-8 mb-3 line-clamp-1 italic">"{os.description}"</p>
                      )}

                      <div className="flex items-center justify-between pl-8 mt-2 border-t border-gray-800 pt-2">
                        {os.estimated_date && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#D4AF37] font-bold">
                            <Clock className="w-3 h-3" />
                            {new Date(os.estimated_date).toLocaleDateString('pt-BR')} {new Date(os.estimated_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {os.total_value ? (
                          <div className="text-[10px] text-green-400 font-black">
                            R$ {os.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl p-6 border shadow-xl" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.4)' }}>
            <h3 className="font-bold mb-5 flex items-center gap-2 text-white">
              <Navigation className="w-6 h-6" style={{ color: '#D4AF37' }} />
              Iniciar Nova Viagem
            </h3>
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest pl-1">Veículo</label>
              <div className="relative">
                <select
                  key={`vehicle-select-${vehicles.length}`}
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-xl p-4 text-sm font-bold appearance-none transition-all focus:ring-2"
                  style={{ background: '#2a2a2a', border: '1px solid rgba(212,175,55,0.2)', color: '#fff', focusRingColor: '#D4AF37' }}
                >
                  <option value="" style={{ background: '#2a2a2a' }}>Selecione um veículo...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id} style={{ background: '#2a2a2a' }}>{v.model} — {v.plate}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
              </div>
            </div>
            <button
              onClick={() => startTrip()}
              disabled={!selectedVehicleId}
              className="w-full flex items-center justify-center gap-3 text-black rounded-xl p-4 font-black text-lg transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
            >
              <Play className="w-6 h-6 fill-black" />
              INICIAR VIAGEM
            </button>
          </div>

          {recentTrips.length > 0 && (
            <div className="rounded-xl p-5 border" style={{ background: '#111', borderColor: 'rgba(255,255,255,0.05)' }}>
              <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-400">
                <Clock className="w-5 h-5" />
                Viagens Recentes
              </h3>
              <div className="space-y-3">
                {recentTrips.map(trip => (
                  <div key={trip.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-900" style={{ background: '#1a1a1a' }}>
                    <div>
                      <p className="text-sm font-bold text-white">{formatTime(trip.started_at)}</p>
                      {trip.description && <p className="text-xs text-gray-500 mt-1">{trip.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-mono mb-1">{calcDuration(trip.started_at, trip.ended_at)}</p>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }}>Concluída</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSOS && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl" style={{ background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.3)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Reportar Imprevisto
              </h3>
              <button onClick={() => setShowSOS(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select
                value={sosType}
                onChange={e => setSosType(e.target.value)}
                className="w-full rounded-xl p-3 text-sm font-medium appearance-none"
                style={{ background: '#2a2a2a', border: '1px solid rgba(212,175,55,0.3)', color: '#fff' }}
              >
                <option value="Peça danificada" style={{ background: '#2a2a2a' }}>Peça danificada</option>
                <option value="Acidente" style={{ background: '#2a2a2a' }}>Acidente</option>
                <option value="Problema com veículo" style={{ background: '#2a2a2a' }}>Problema com veículo</option>
                <option value="Problema com cliente" style={{ background: '#2a2a2a' }}>Problema com cliente</option>
                <option value="Atraso" style={{ background: '#2a2a2a' }}>Atraso</option>
                <option value="Outro" style={{ background: '#2a2a2a' }}>Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
              <textarea
                value={sosDesc}
                onChange={e => setSosDesc(e.target.value)}
                placeholder="Descreva o imprevisto..."
                rows={3}
                className="w-full rounded-xl p-3 text-sm resize-none text-white placeholder-gray-600"
                style={{ background: '#2a2a2a', border: '1px solid rgba(212,175,55,0.3)' }}
              />
            </div>
            <button
              onClick={sendSOS}
              disabled={sosSending || !sosDesc.trim()}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 text-white rounded-xl p-3 font-bold transition-colors"
              style={{ background: sosSending || !sosDesc.trim() ? '#333' : 'linear-gradient(135deg, #dc2626, #991b1b)' }}
            >
              <Send className="w-4 h-4" />
              {sosSending ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </div>
      )}


      {showFuel && activeTrip && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl border" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.3)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Fuel className="w-5 h-5" style={{ color: '#D4AF37' }} />
                Registrar Abastecimento
              </h3>
              <button onClick={() => setShowFuel(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FuelLogForm employeeId={employeeId} tripId={activeTrip.id} onClose={() => setShowFuel(false)} />
          </div>
        </div>
      )}

      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl border" style={{ background: '#1a1a1a', borderColor: 'rgba(212,175,55,0.3)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-white">Assinatura do Cliente</h3>
              <button onClick={() => setShowSignaturePad(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white rounded-lg p-2 overflow-hidden">
              <SignaturePad
                onSave={saveSignature}
                onClear={() => setShowSignaturePad(false)}
              />
            </div>
            <p className="mt-3 text-[10px] text-gray-500 text-center uppercase font-bold tracking-widest">A ASSINATURA SERÁ VINCULADA À VIAGEM ATUAL</p>
          </div>
        </div>
      )}
    </div>
  );
}

