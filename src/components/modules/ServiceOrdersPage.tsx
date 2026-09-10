import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast'
import { ClipboardList, Plus, Search, Edit, Calendar, Clock, Phone, MapPin, User, DollarSign, StickyNote, MessageCircle, X, Eye, FileDown, Trash, Trash2, Image, FileText, Info, List, Camera, ChevronRight, Printer } from 'lucide-react';
import PdfUploader from '../admin/PdfUploader';
import { format } from 'date-fns';
import logoSD from '@/assets/logo-sd.jpeg';

const db = supabase as any;

// Tipo para item de produto/serviço na OS
interface OSItem {
  id: string;
  description: string;
  unit: string;
  width: number;
  height: number;
  total_m2: number;
  value: number;
  quantity: number;
  total_value: number;
}

const ServiceOrdersPage: React.FC = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showPdfUploader, setShowPdfUploader] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  // Flag que indica se os itens do form foram carregados do banco (para evitar deleção acidental)
  const [itemsLoaded, setItemsLoaded] = useState(false);

  // Tabs dentro do formulário
  const [activeTab, setActiveTab] = useState<'obs' | 'produtos' | 'imagens' | 'controle'>('obs');

  // Itens da lista de produtos/serviços
  const [osItems, setOsItems] = useState<OSItem[]>([]);
  const [editingItem, setEditingItem] = useState<OSItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({
    description: '',
    unit: 'un',
    width: 0,
    height: 0,
    value: 0,
    quantity: 1,
  });

  // Imagens da OS
  const [osImages, setOsImages] = useState<{ id: string; url: string; caption: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos de controle interno
  const [internalNotes, setInternalNotes] = useState('');
  const [serviceToPerform, setServiceToPerform] = useState('');
  const [problemsToFix, setProblemsToFix] = useState('');
  const [currentStage, setCurrentStage] = useState('');

  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_phone: '',
    client_address: '',
    description: '',
    status: 'aberta',
    priority: 'normal',
    assigned_to: '',
    total_value: 0,
    notes: '',
    estimated_date: '',
    meeting_time: '09:00',
  });

  const fetchData = async () => {
    setLoading(true);
    const [ordRes, cliRes, empRes] = await Promise.all([
      db.from('service_orders').select('*, clients(name, phone, address), employees(name)').order('created_at', { ascending: false }),
      db.from('clients').select('id, name, phone, address').order('name'),
      db.from('employees').select('id, name').eq('active', true).order('name'),
    ]);
    setOrders(ordRes.data || []);
    setClients(cliRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = (overrides: any = {}) => ({
    client_id: '', client_name: '', client_phone: '', client_address: '',
    description: '', status: 'aberta', priority: 'normal', assigned_to: '',
    total_value: 0, notes: '', estimated_date: '', meeting_time: '09:00',
    ...overrides,
  });

  const handleSave = async () => {
    if (!form.description.trim() && !form.client_name.trim() && !form.client_id) {
      toast({ title: '⚠️ Preencha pelo menos o cliente e descrição', variant: 'destructive' });
      return;
    }

    let clientId = form.client_id || null;

    if (!clientId && form.client_name.trim()) {
      const { data: newClient, error: clientErr } = await db.from('clients').insert({ 
        name: form.client_name.trim(),
        phone: form.client_phone || null,
        address: form.client_address || null
      }).select('id').single();
      
      if (clientErr) {
        toast({ title: '❌ Erro ao criar cliente', description: clientErr.message, variant: 'destructive' });
        return;
      }
      clientId = newClient.id;
    } else if (clientId) {
      const { error: clientUpdateErr } = await db.from('clients').update({
        name: form.client_name.trim(),
        phone: form.client_phone || null,
        address: form.client_address || null
      }).eq('id', clientId);

      if (clientUpdateErr) {
        console.error('Client update error:', clientUpdateErr);
      }
    }

    // Calcular valor total dos itens
    const itemsTotal = osItems.reduce((sum, item) => sum + item.total_value, 0);

    const payload = {
      client_id: clientId,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      total_value: itemsTotal > 0 ? itemsTotal : form.total_value,
      notes: [
        form.notes,
        serviceToPerform ? `[Serviço a ser Realizado]: ${serviceToPerform}` : '',
        problemsToFix ? `[Problemas a Reparar]: ${problemsToFix}` : '',
        currentStage ? `[Etapa do Serviço]: ${currentStage}` : '',
        internalNotes ? `[Notas Internas]: ${internalNotes}` : '',
      ].filter(Boolean).join('\n') || null,
      estimated_date: form.estimated_date || null,
    };

    let targetOsId = editingId;
    let error;
    if (editingId) {
      const res = await db.from('service_orders').update(payload).eq('id', editingId);
      error = res.error;
      if (!error) toast({ title: '✅ OS atualizada' });
    } else {
      const res = await db.from('service_orders').insert(payload).select('id').single();
      error = res.error;
      if (!error && res.data) {
        targetOsId = res.data.id;
        toast({ title: '✅ OS criada com sucesso' });
      }
    }

    if (error) {
      toast({ title: '❌ Erro ao salvar OS', description: error.message, variant: 'destructive' });
      return;
    }

    // Salva ou atualiza os itens na tabela itens_projeto
    // Só altera os itens se eles foram explicitamente carregados/editados nesta sessão
    if (targetOsId && itemsLoaded) {
      if (osItems.length > 0) {
        await db.from('itens_projeto').delete().eq('service_order_id', targetOsId);
        const itemsPayload = osItems.map(it => ({
          service_order_id: targetOsId,
          description: it.description,
          unit: it.unit || 'un',
          unit_value: it.value,
          quantity: it.quantity,
          total_value: it.total_value,
          width: it.width || 0,
          height: it.height || 0,
          total_m2: it.total_m2 || 0,
        }));
        await db.from('itens_projeto').insert(itemsPayload);
      } else {
        // Itens foram carregados mas lista está vazia = usuário deletou todos os itens
        await db.from('itens_projeto').delete().eq('service_order_id', targetOsId);
      }
    } else if (targetOsId && !editingId && osItems.length > 0) {
      // Nova OS sem editingId anterior — insere normalmente
      const itemsPayload = osItems.map(it => ({
        service_order_id: targetOsId,
        description: it.description,
        unit: it.unit || 'un',
        unit_value: it.value,
        quantity: it.quantity,
        total_value: it.total_value,
        width: it.width || 0,
        height: it.height || 0,
        total_m2: it.total_m2 || 0,
      }));
      await db.from('itens_projeto').insert(itemsPayload);
    }

    // Se concluiu a OS, finalizar qualquer viagem ativa do funcionário
    if (form.status === 'concluida' && form.assigned_to) {
      try {
        const { data: activeTrips } = await db
          .from('trips')
          .select('id')
          .eq('employee_id', form.assigned_to)
          .eq('status', 'active');
        
        if (activeTrips && activeTrips.length > 0) {
          for (const trip of activeTrips) {
            await db
              .from('trips')
              .update({ status: 'completed', ended_at: new Date().toISOString() })
              .eq('id', trip.id);
          }
          toast({ title: '🏁 Viagem associada finalizada automaticamente' });
        }
      } catch (e) {
        console.error('Erro ao finalizar viagem:', e);
      }
    }

    setShowForm(false);
    setEditingId(null);
    resetFormState();
    fetchData();
  };

  const resetFormState = () => {
    setForm(resetForm());
    setOsItems([]);
    setSelectedItemId(null);
    setOsImages([]);
    setServiceToPerform('');
    setProblemsToFix('');
    setCurrentStage('');
    setInternalNotes('');
    setActiveTab('obs');
    setItemsLoaded(false);
  };

  // ===================== ITEMS (Produtos/Serviços) =====================
  const calcItemTotalM2 = (w: number, h: number) => +(w * h).toFixed(3);
  const calcItemTotal = (value: number, qty: number, m2: number) => {
    if (m2 > 0) return +(value * m2).toFixed(2);
    return +(value * qty).toFixed(2);
  };

  const openItemForm = (item?: OSItem) => {
    if (item) {
      const isExistingInList = osItems.some(it => it.id === item.id);
      setEditingItem(isExistingInList ? item : null);
      setItemForm({
        description: item.description,
        unit: item.unit,
        width: item.width,
        height: item.height,
        value: item.value,
        quantity: item.quantity,
      });
    } else {
      setEditingItem(null);
      setItemForm({ description: '', unit: 'un', width: 0, height: 0, value: 0, quantity: 1 });
    }
    setShowItemForm(true);
  };

  const saveItem = () => {
    if (!itemForm.description.trim()) {
      toast({ title: '⚠️ Informe a descrição do produto/serviço', variant: 'destructive' });
      return;
    }
    const total_m2 = calcItemTotalM2(itemForm.width, itemForm.height);
    const total_value = calcItemTotal(itemForm.value, itemForm.quantity, total_m2);

    const isExisting = editingItem && osItems.some(it => it.id === editingItem.id);
    if (isExisting && editingItem) {
      setOsItems(prev => prev.map(it => it.id === editingItem.id ? {
        ...editingItem, ...itemForm, total_m2, total_value
      } : it));
      toast({ title: '✅ Item atualizado' });
    } else {
      const newItem: OSItem = {
        id: Date.now().toString(),
        ...itemForm,
        total_m2,
        total_value,
      };
      setOsItems(prev => [...prev, newItem]);
      toast({ title: '✅ Item incluído' });
    }
    setShowItemForm(false);
    setEditingItem(null);
  };

  const deleteItem = (id: string) => {
    if (!confirm('Excluir este item?')) return;
    setOsItems(prev => prev.filter(it => it.id !== id));
    toast({ title: '🗑️ Item excluído' });
  };

  const statusColors: Record<string, string> = {
    aberta: 'bg-blue-900/50 text-blue-400 border border-blue-500/30',
    em_andamento: 'bg-amber-900/50 text-amber-500 border border-amber-500/30',
    concluida: 'bg-green-900/50 text-green-400 border border-green-500/30',
    cancelada: 'bg-red-900/50 text-red-500 border border-red-500/30',
  };

  const statusLabels: Record<string, string> = {
    aberta: 'Aberta',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('service_orders').delete().eq('id', id);
    if (error) {
      toast({ title: '❌ Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ OS excluída com sucesso' });
      fetchData();
    }
  };

  const handleWhatsAppShare = async (o: any) => {
    const phone = o.clients?.phone || o.client_phone;
    if (!phone) {
      toast({ title: '⚠️ Cliente sem telefone cadastrado', variant: 'destructive' });
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const target = cleanPhone.length > 11 ? cleanPhone : '55' + cleanPhone;
    
    const message = `Olá *${o.clients?.name || o.client_name || 'Cliente'}*! 🛠️\n\n` +
      `Sou da *SD Móveis Projetados*. Tratando sobre a sua *Ordem de Serviço (OS #${o.order_number})*.\n\n` +
      `📝 *Serviço:* ${o.description}\n` +
      `📍 *Status:* ${statusLabels[o.status] || o.status}\n` +
      `💰 *Valor:* R$ ${(o.total_value || 0).toLocaleString('pt-BR')}\n` +
      `📅 *Previsão:* ${o.estimated_date ? format(new Date(o.estimated_date), 'dd/MM/yyyy') : 'A definir'}\n\n` +
      `🔑 *CHAVES PIX PARA PAGAMENTO:*\n\n` +
      `💎 *InfinityPay (CNPJ):* 49.228.811/0001-33\n` +
      `📧 *E-mail:* sdmoveis48@gmail.com\n` +
      `🏦 *Itaú (Celular):* 85 99760-2237\n\n` +
      `*Titular:* Samuel David C\n\n` +
      `Aguardamos seu contato!`;

    try {
      toast({ title: '⏳ Enviando PIX...', description: 'Aguarde um momento.' });
      
      const { data: conv } = await db.from('whatsapp_conversations').select('id').eq('phone_number', target).maybeSingle();
      let convId = conv?.id;
      if (!convId) {
        const { data: newConv } = await db.from('whatsapp_conversations').insert({ 
          phone_number: target, 
          contact_name: o.clients?.name || o.client_name 
        }).select('id').single();
        convId = newConv.id;
      }

      const res = await supabase.functions.invoke('whatsapp-send', {
        body: { 
          conversationId: convId, 
          message: message,
          mediaUrl: 'https://nglwscakhhdhelhbqkyb.supabase.co/storage/v1/object/public/documents/assets/pix_qr.png',
          fileName: 'pix_sd_moveis.png'
        }
      });

      if (res.error) throw res.error;
      toast({ title: '✅ Mensagem e QR Code enviados!', description: 'O cliente recebeu os dados da OS e o QR Code do Pix.' });
    } catch (e: any) {
      console.error('Erro ao enviar WhatsApp:', e);
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const priorityColors: Record<string, string> = {
    baixa: 'bg-white/10 text-gray-400 border border-white/20',
    normal: 'bg-blue-900/50 text-blue-400 border border-blue-500/30',
    alta: 'bg-orange-900/50 text-orange-400 border border-orange-500/30',
    urgente: 'bg-red-900/50 text-red-500 border border-red-500/30',
  };

  const priorityLabels: Record<string, string> = {
    baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente',
  };

  const filtered = orders.filter(o =>
    (o.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.employees?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openForm = async (o?: any) => {
    setFormLoading(true);
    if (o) {
      setEditingId(o.id);
      setForm(resetForm({
        client_id: o.client_id || '',
        client_name: o.client_name || o.clients?.name || '',
        client_phone: o.client_phone || o.clients?.phone || '',
        client_address: o.client_address || o.clients?.address || '',
        description: o.description || '',
        status: o.status,
        priority: o.priority,
        assigned_to: o.assigned_to || '',
        total_value: o.total_value || 0,
        notes: o.notes || '',
        estimated_date: o.estimated_date ? o.estimated_date.slice(0, 10) : '',
        meeting_time: '09:00',
      }));

      // Extrai os blocos das observações do campo notes
      const notesStr = o.notes || '';
      const extractNote = (tag: string) => {
        const m = notesStr.match(new RegExp(`\\[${tag}\\]: ([^\\[]*)`))
        return m ? m[1].trim() : '';
      };
      setServiceToPerform(extractNote('Serviço a ser Realizado'));
      setProblemsToFix(extractNote('Problemas a Reparar'));
      setCurrentStage(extractNote('Etapa do Serviço'));
      setInternalNotes(extractNote('Notas Internas'));

      // Carrega os itens gravados da tabela itens_projeto
      // OBS: removido o .order('created_at', ...) — a tabela itens_projeto pode não
      // ter essa coluna (ou ela pode estar inacessível via RLS), o que fazia a query
      // falhar silenciosamente (o erro só ia pro console.error) e a lista de itens
      // aparecer vazia no modal de edição mesmo com itens salvos no banco.
      const { data: itens, error: itensError } = await db
        .from('itens_projeto')
        .select('*')
        .eq('service_order_id', o.id);
      if (itensError) {
        console.error('Erro ao carregar itens:', itensError);
        toast({ title: '⚠️ Erro ao carregar itens da OS', description: itensError.message, variant: 'destructive' });
      }
      if (itens && itens.length > 0) {
        setOsItems(itens.map((it: any) => ({
          id: it.id,
          description: it.description,
          unit: it.unit || 'un',
          width: it.width || 0,
          height: it.height || 0,
          total_m2: it.total_m2 || 0,
          value: it.unit_value || 0,
          quantity: it.quantity || 1,
          total_value: it.total_value || 0,
        })));
        setActiveTab('produtos');
      } else {
        setOsItems([]);
        setActiveTab('obs');
      }
      // Marca que os itens foram carregados do banco nesta sessão de edição
      setItemsLoaded(true);
    } else {
      setEditingId(null);
      setForm(resetForm());
      setOsItems([]);
      setItemsLoaded(true); // Nova OS: itens começam vazios, pode salvar vazio
      setServiceToPerform('');
      setProblemsToFix('');
      setCurrentStage('');
      setInternalNotes('');
      setActiveTab('obs');
    }
    setSelectedItemId(null);
    setOsImages([]);
    setFormLoading(false);
    setShowForm(true);
  };


  const inputCls = "w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all";
  const labelCls = "text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1";

  const totalItemsValue = osItems.reduce((s, i) => s + i.total_value, 0);

  const TABS = [
    { id: 'obs', label: 'Observações Gerais do Serviço', icon: StickyNote },
    { id: 'produtos', label: 'Lista de Produtos e Serviços', icon: List },
    { id: 'imagens', label: 'Imagens do Trabalho / Serviço', icon: Camera },
    { id: 'controle', label: 'Informações de Controle Interno / Registros Diversos', icon: Info },
  ] as const;

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] w-full text-white">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-amber-500" />
            Ordens de Serviço
          </h1>
          <p className="text-gray-400 mt-1">Gerenciamento de OS</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <button onClick={() => setShowPdfUploader(true)}
            className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
            <FileDown className="w-5 h-5 text-amber-500" /> Importar PDF
          </button>
          <button onClick={() => openForm()}
            className="text-black px-8 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
            <Plus className="w-5 h-5" /> + Nova OS
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['aberta', 'em_andamento', 'concluida', 'cancelada'].map(st => (
          <div key={st} className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
            <p className="text-xs text-gray-500 uppercase font-bold">{statusLabels[st]}</p>
            <p className="text-2xl font-black text-white mt-1">{orders.filter(o => o.status === st).length}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-3 w-5 h-5 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OS, cliente ou responsável..."
          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600" />
      </div>

      {showPdfUploader && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <PdfUploader 
            onClose={() => setShowPdfUploader(false)} 
            onSuccess={() => {
              fetchData();
              setShowPdfUploader(false);
            }}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#111111] rounded-2xl border border-amber-500/30 w-full max-w-4xl max-h-[97vh] flex flex-col shadow-2xl text-white">
            
            {/* Header do formulário */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                  {editingId ? 'Editar' : 'Nova'} Ordem de Serviço
                </h3>
                {editingId && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                    Editando
                  </span>
                )}
                {(totalItemsValue > 0 || form.total_value > 0) && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold flex items-center gap-1">
                    💰 R$ {(totalItemsValue > 0 ? totalItemsValue : form.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <button onClick={() => { setShowForm(false); setEditingId(null); resetFormState(); }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dados do cliente (sempre visíveis) */}
            <div className="px-6 py-3 bg-[#0d0d0d] border-b border-white/5 flex-shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}><User className="w-4 h-4 text-amber-500" /> Cliente</label>
                  <input type="text" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Nome do cliente" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}><Phone className="w-4 h-4 text-green-500" /> Celular</label>
                  <input type="tel" value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })}
                    placeholder="(00) 00000-0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}><MapPin className="w-4 h-4 text-red-500" /> Endereço</label>
                  <input type="text" value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })}
                    placeholder="Rua, número, cidade" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}><ClipboardList className="w-4 h-4 text-amber-500" /> Descrição do Serviço</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Ex: Instalação de armários" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className={labelCls}><Calendar className="w-4 h-4 text-amber-500" /> Data</label>
                  <input type="date" value={form.estimated_date} onChange={e => setForm({ ...form, estimated_date: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}><Clock className="w-4 h-4 text-amber-500" /> Horário</label>
                  <select value={form.meeting_time} onChange={e => setForm({ ...form, meeting_time: e.target.value })}
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 outline-none transition-all appearance-none">
                    {['00:00','00:30','01:00','01:30','02:00','02:30','03:00','03:30','04:00','04:30','05:00','05:30',
                      '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                      '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
                      '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00','23:30'
                    ].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Responsável</label>
                  <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 outline-none transition-all">
                    <option value="">Selecionar funcionário</option>
                    {employees.map(em => <option key={em.id} value={em.id}>{em.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 outline-none transition-all">
                    <option value="aberta">Aberta</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Abas */}
            <div className="flex border-b border-white/10 bg-[#0a0a0a] flex-shrink-0 overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {tab.label}
                    {tab.id === 'produtos' && osItems.length > 0 && (
                      <span className="ml-1 bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-black">
                        {osItems.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo das abas */}
            <div className="flex-1 overflow-y-auto">

              {/* ABA 1 - Observações Gerais */}
              {activeTab === 'obs' && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}><StickyNote className="w-4 h-4 text-green-400" /> Serviço a ser Realizado</label>
                      <textarea value={serviceToPerform} onChange={e => setServiceToPerform(e.target.value)}
                        rows={5} placeholder="Descreva o serviço que será realizado..."
                        className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
                    </div>
                    <div>
                      <label className={labelCls}><Info className="w-4 h-4 text-red-400" /> Problemas e Reparos a Serem Feitos no Serviço</label>
                      <textarea value={problemsToFix} onChange={e => setProblemsToFix(e.target.value)}
                        rows={5} placeholder="Descreva os problemas e reparos..."
                        className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}><ChevronRight className="w-4 h-4 text-amber-400" /> Etapa do Serviço Sendo Realizado</label>
                    <textarea value={currentStage} onChange={e => setCurrentStage(e.target.value)}
                      rows={4} placeholder="Ex: Medição concluída, aguardando fabricação..."
                      className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
                  </div>
                </div>
              )}

              {/* ABA 2 - Lista de Produtos e Serviços */}
              {activeTab === 'produtos' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => openItemForm()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-black text-sm font-bold shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                      <Plus className="w-4 h-4" /> Incluir
                    </button>
                    <button
                      onClick={() => {
                        const target = osItems.find(it => it.id === selectedItemId) || osItems[osItems.length - 1];
                        if (target) openItemForm(target);
                        else toast({ title: '⚠️ Selecione um item para alterar', variant: 'destructive' });
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-bold hover:bg-blue-600/30 transition-all">
                      <Edit className="w-4 h-4" /> Alterar
                    </button>
                    <button
                      onClick={() => {
                        const target = osItems.find(it => it.id === selectedItemId) || osItems[osItems.length - 1];
                        if (target) deleteItem(target.id);
                        else toast({ title: '⚠️ Nenhum item para excluir', variant: 'destructive' });
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-600/30 transition-all">
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold">Valor Total dos Itens</p>
                      <p className="text-lg font-black text-amber-400">R$ {(totalItemsValue > 0 ? totalItemsValue : (form.total_value || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Tabela de itens */}
                  <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-[#1a1a1a] border-b border-white/10">
                        <tr>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Nº</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Descrição do Produto</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Un</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Largura</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Altura</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Tot M²</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Valor</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Quant.</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Vlr Total</th>
                          <th className="text-left p-3 text-xs font-black text-gray-400 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {osItems.length === 0 && (
                          <tr><td colSpan={10} className="p-8 text-center text-gray-600 text-sm italic">
                            Nenhum item adicionado. Clique em "Incluir" para adicionar produtos ou serviços.
                          </td></tr>
                        )}
                        {osItems.map((item, idx) => {
                          const isSelected = selectedItemId === item.id;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedItemId(item.id)}
                              className={`border-t border-white/5 cursor-pointer transition-colors ${
                                isSelected ? 'bg-amber-500/15 border-l-2 border-l-amber-500' : 'hover:bg-white/5'
                              }`}
                            >
                              <td className="p-3 text-gray-500 font-bold text-xs">{String(idx + 1).padStart(4, '0')}</td>
                              <td className="p-3 text-white font-medium text-sm max-w-[200px] truncate">{item.description}</td>
                              <td className="p-3 text-gray-400 text-xs">{item.unit}</td>
                              <td className="p-3 text-gray-400 text-xs">{item.width > 0 ? item.width.toFixed(2) : '-'}</td>
                              <td className="p-3 text-gray-400 text-xs">{item.height > 0 ? item.height.toFixed(2) : '-'}</td>
                              <td className="p-3 text-gray-400 text-xs">{item.total_m2 > 0 ? item.total_m2.toFixed(3) : '-'}</td>
                              <td className="p-3 text-gray-300 text-xs">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-gray-400 text-xs">{item.quantity}</td>
                              <td className="p-3 font-bold text-amber-400 text-sm">R$ {item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-3">
                                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => openItemForm(item)}
                                    className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all" title="Alterar">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteItem(item.id)}
                                    className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all" title="Excluir">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {osItems.length > 0 && (
                        <tfoot className="border-t border-amber-500/20 bg-[#1a1a1a]">
                          <tr>
                            <td colSpan={8} className="p-3 text-right text-xs font-black text-gray-400 uppercase">Total Geral:</td>
                            <td colSpan={2} className="p-3 font-black text-amber-400">R$ {totalItemsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Modal de item */}
                  {showItemForm && (
                    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-[#111111] border border-amber-500/30 rounded-2xl p-6 w-full max-w-lg shadow-2xl text-white">
                        <div className="flex items-center justify-between mb-5">
                          <h4 className="text-base font-bold text-amber-400 flex items-center gap-2">
                            <List className="w-4 h-4" />
                            {editingItem ? 'Alterar Item' : 'Incluir Novo Item'}
                          </h4>
                          <button onClick={() => setShowItemForm(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className={labelCls}>Descrição do Produto/Serviço *</label>
                            <input type="text" value={itemForm.description}
                              onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                              placeholder="Ex: Armário planejado 3 portas" className={inputCls} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Unidade</label>
                              <select value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                                className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 outline-none">
                                <option value="un">un</option>
                                <option value="m²">m²</option>
                                <option value="m">m</option>
                                <option value="pç">pç</option>
                                <option value="hr">hr</option>
                                <option value="vb">vb</option>
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Largura (m)</label>
                              <input type="number" step="0.01" value={itemForm.width}
                                onChange={e => setItemForm({ ...itemForm, width: +e.target.value })}
                                placeholder="0.00" className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>Altura (m)</label>
                              <input type="number" step="0.01" value={itemForm.height}
                                onChange={e => setItemForm({ ...itemForm, height: +e.target.value })}
                                placeholder="0.00" className={inputCls} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelCls}><DollarSign className="w-4 h-4 text-green-500" /> Valor Unitário (R$)</label>
                              <input type="number" step="0.01" value={itemForm.value}
                                onChange={e => setItemForm({ ...itemForm, value: +e.target.value })}
                                placeholder="0,00" className={inputCls} />
                            </div>
                            <div>
                              <label className={labelCls}>Quantidade</label>
                              <input type="number" step="1" min="1" value={itemForm.quantity}
                                onChange={e => setItemForm({ ...itemForm, quantity: +e.target.value })}
                                placeholder="1" className={inputCls} />
                            </div>
                          </div>
                          {/* Preview do total */}
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                            <p className="text-xs text-gray-400 uppercase font-bold">Prévia do Total</p>
                            <p className="text-lg font-black text-amber-400 mt-1">
                              R$ {calcItemTotal(
                                itemForm.value, itemForm.quantity,
                                calcItemTotalM2(itemForm.width, itemForm.height)
                              ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {(itemForm.width > 0 && itemForm.height > 0) && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                M²: {calcItemTotalM2(itemForm.width, itemForm.height).toFixed(3)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <button onClick={saveItem}
                            className="flex-1 h-11 text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                            <Plus className="w-4 h-4" /> {editingItem ? 'Salvar Alterações' : 'Incluir Item'}
                          </button>
                          <button onClick={() => setShowItemForm(false)}
                            className="h-11 px-5 bg-white/10 border border-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3 - Imagens do Trabalho */}
              {activeTab === 'imagens' && (
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-400">Adicione fotos do trabalho antes e depois da execução do serviço.</p>
                  <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const newImages = files.map(f => ({
                        id: Date.now().toString() + Math.random(),
                        url: URL.createObjectURL(f),
                        caption: f.name,
                      }));
                      setOsImages(prev => [...prev, ...newImages]);
                    }}
                  />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-amber-500/40 text-amber-400 text-sm font-bold hover:bg-amber-500/10 transition-all">
                    <Camera className="w-4 h-4" /> Adicionar Imagens
                  </button>

                  {osImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-2xl">
                      <Camera className="w-12 h-12 text-gray-700 mb-3" />
                      <p className="text-gray-600 text-sm">Nenhuma imagem adicionada</p>
                      <p className="text-gray-700 text-xs mt-1">Clique em "Adicionar Imagens" para incluir fotos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {osImages.map(img => (
                        <div key={img.id} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-square bg-[#1a1a1a]">
                          <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                            <button onClick={() => setOsImages(prev => prev.filter(i => i.id !== img.id))}
                              className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                              <Trash2 className="w-4 h-4 text-white" />
                            </button>
                          </div>
                          <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] p-1 truncate">{img.caption}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4 - Informações de Controle Interno */}
              {activeTab === 'controle' && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Prioridade</label>
                      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                        className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 outline-none transition-all">
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}><DollarSign className="w-4 h-4 text-green-500" /> Valor Manual (R$)</label>
                      <input type="number" value={form.total_value} onChange={e => setForm({ ...form, total_value: +e.target.value })}
                        placeholder="0,00" className={inputCls} />
                      {totalItemsValue > 0 && (
                        <p className="text-xs text-amber-400 mt-1">⚠️ Valor dos itens: R$ {totalItemsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (sobrescreve este campo)</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}><Info className="w-4 h-4 text-blue-400" /> Notas Internas / Registros Diversos</label>
                    <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                      rows={6} placeholder="Registros internos, observações para a equipe, histórico de alterações..."
                      className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Footer com botões de ação */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3 bg-[#0d0d0d] flex-shrink-0">
              <div className="flex gap-2 flex-1 flex-wrap">
                {totalItemsValue > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">Total Itens: R$ {totalItemsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              {/* Botão Imprimir */}
              {editingId && (
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=800,height=600');
                    if (!printWindow) return;
                    const itemsRows = osItems.map((it, idx) => `
                      <tr style="border-bottom:1px solid #eee">
                        <td style="padding:6px 8px;text-align:center">${idx + 1}</td>
                        <td style="padding:6px 8px">${it.description}</td>
                        <td style="padding:6px 8px;text-align:center">${it.unit}</td>
                        <td style="padding:6px 8px;text-align:right">${it.width > 0 ? it.width.toFixed(2) : '-'}</td>
                        <td style="padding:6px 8px;text-align:right">${it.height > 0 ? it.height.toFixed(2) : '-'}</td>
                        <td style="padding:6px 8px;text-align:right">${it.total_m2 > 0 ? it.total_m2.toFixed(3) : '-'}</td>
                        <td style="padding:6px 8px;text-align:right">R$ ${it.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td style="padding:6px 8px;text-align:center">${it.quantity}</td>
                        <td style="padding:6px 8px;text-align:right;font-weight:bold">R$ ${it.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>`).join('');
                    const totalValue = totalItemsValue > 0 ? totalItemsValue : (form.total_value || 0);
                    printWindow.document.write(`
                      <!DOCTYPE html><html><head>
                        <meta charset="UTF-8" />
                        <title>OS - ${form.description || 'Ordem de Servi\u00e7o'}</title>
                        <style>
                          * { box-sizing: border-box; margin: 0; padding: 0; }
                          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
                          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 12px; margin-bottom: 16px; }
                          .company { font-size: 20px; font-weight: 900; color: #222; }
                          .subtitle { color: #666; font-size: 11px; margin-top: 2px; }
                          .os-badge { background: #D4AF37; color: #111; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 14px; }
                          .section { margin-bottom: 14px; }
                          .section-title { font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #D4AF37; border-bottom: 1px solid #D4AF37; padding-bottom: 4px; margin-bottom: 8px; font-size: 11px; }
                          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                          .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
                          .field label { font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; }
                          .field p { font-size: 13px; color: #111; font-weight: 600; margin-top: 2px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
                          thead { background: #222; color: white; }
                          thead th { padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
                          tbody tr:nth-child(even) { background: #f9f9f9; }
                          .total-row { background: #D4AF37 !important; font-weight: bold; }
                          .total-row td { padding: 8px; font-size: 13px; }
                          .obs-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 12px; white-space: pre-wrap; }
                          .footer { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                          .sign-line { border-top: 1px solid #555; padding-top: 6px; text-align: center; color: #666; font-size: 11px; }
                          @media print { body { padding: 10px; } button { display: none; } }
                        </style>
                      </head><body>
                        <div class="header">
                          <div style="display:flex;align-items:center;gap:14px;">
                            <img src="${logoSD}" alt="SD" style="width:55px;height:55px;object-fit:cover;border-radius:10px;border:2px solid #D4AF37;" />
                            <div>
                              <div class="company">SD Móveis Projetados</div>
                              <div class="subtitle">Marcenaria e Móveis Planejados</div>
                            </div>
                          </div>
                          <div class="os-badge">OS #${orders.find(o => o.id === editingId)?.order_number || ''}</div>
                        </div>

                        <div class="section">
                          <div class="section-title">Dados do Cliente</div>
                          <div class="grid4">
                            <div class="field"><label>Cliente</label><p>${form.client_name || '-'}</p></div>
                            <div class="field"><label>Celular</label><p>${form.client_phone || '-'}</p></div>
                            <div class="field"><label>Endere\u00e7o</label><p>${form.client_address || '-'}</p></div>
                            <div class="field"><label>Descri\u00e7\u00e3o do Servi\u00e7o</label><p>${form.description || '-'}</p></div>
                          </div>
                        </div>

                        <div class="section">
                          <div class="section-title">Informa\u00e7\u00f5es da Ordem</div>
                          <div class="grid4">
                            <div class="field"><label>Data</label><p>${form.estimated_date ? form.estimated_date : '-'}</p></div>
                            <div class="field"><label>Hor\u00e1rio</label><p>${form.meeting_time || '-'}</p></div>
                            <div class="field"><label>Status</label><p>${form.status === 'concluida' ? 'Concu\u00edda' : form.status === 'em_andamento' ? 'Em Andamento' : form.status === 'cancelada' ? 'Cancelada' : 'Aberta'}</p></div>
                            <div class="field"><label>Valor Total</label><p>R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                          </div>
                        </div>

                        ${osItems.length > 0 ? `
                        <div class="section">
                          <div class="section-title">Lista de Produtos e Servi\u00e7os</div>
                          <table>
                            <thead><tr>
                              <th style="width:35px">N\u00ba</th>
                              <th>Descri\u00e7\u00e3o</th>
                              <th style="width:40px">Un</th>
                              <th style="width:55px;text-align:right">Larg.</th>
                              <th style="width:55px;text-align:right">Alt.</th>
                              <th style="width:60px;text-align:right">M\u00b2</th>
                              <th style="width:80px;text-align:right">Valor Un.</th>
                              <th style="width:45px;text-align:center">Qtd</th>
                              <th style="width:90px;text-align:right">Total</th>
                            </tr></thead>
                            <tbody>${itemsRows}
                              <tr class="total-row">
                                <td colspan="8" style="text-align:right">TOTAL GERAL:</td>
                                <td style="text-align:right">R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>` : ''}

                        ${serviceToPerform || problemsToFix || currentStage ? `
                        <div class="section">
                          <div class="section-title">Observa\u00e7\u00f5es do Servi\u00e7o</div>
                          ${serviceToPerform ? `<p style="font-weight:bold;margin-bottom:4px">Servi\u00e7o a ser Realizado:</p><div class="obs-box" style="margin-bottom:10px">${serviceToPerform}</div>` : ''}
                          ${problemsToFix ? `<p style="font-weight:bold;margin-bottom:4px">Problemas e Reparos:</p><div class="obs-box" style="margin-bottom:10px">${problemsToFix}</div>` : ''}
                          ${currentStage ? `<p style="font-weight:bold;margin-bottom:4px">Etapa do Servi\u00e7o:</p><div class="obs-box">${currentStage}</div>` : ''}
                        </div>` : ''}

                        <div class="footer">
                          <div class="sign-line">Assinatura do Cliente</div>
                          <div class="sign-line">Assinatura do Respons\u00e1vel</div>
                        </div>
                        <script>window.onload = () => window.print();<\/script>
                      </body></html>`);
                    printWindow.document.close();
                  }}
                  className="h-11 px-5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-600/40 transition-all"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              )}
              <button onClick={() => { setShowForm(false); setEditingId(null); resetFormState(); }}
                className="h-11 px-5 bg-white/10 border border-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all">
                Cancelar
              </button>
              <button onClick={handleSave}
                className="h-11 px-6 text-black rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                <ClipboardList className="w-4 h-4" />
                {editingId ? 'Salvar Alterações' : 'Criar Ordem de Serviço'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#111111] border border-amber-500/30 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-black text-white">OS #{selectedOrder.order_number}</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-gray-400"><strong className="text-white">Cliente:</strong> {selectedOrder.clients?.name || selectedOrder.client_name || '-'}</p>
              {(selectedOrder.clients?.phone || selectedOrder.client_phone) && (
                <p className="text-gray-400 flex items-center gap-2"><Phone className="w-4 h-4 text-green-500" /> {selectedOrder.clients?.phone || selectedOrder.client_phone}</p>
              )}
              {(selectedOrder.clients?.address || selectedOrder.client_address) && (
                <p className="text-gray-400 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-400" /> {selectedOrder.clients?.address || selectedOrder.client_address}</p>
              )}
              {selectedOrder.description && <p className="text-gray-400"><strong className="text-white">Serviço:</strong> {selectedOrder.description}</p>}
              <p className="text-gray-400"><strong className="text-white">Status:</strong> <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[selectedOrder.status] || ''}`}>{statusLabels[selectedOrder.status] || selectedOrder.status}</span></p>
              <p className="text-gray-400"><strong className="text-white">Prioridade:</strong> <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${priorityColors[selectedOrder.priority] || ''}`}>{priorityLabels[selectedOrder.priority] || selectedOrder.priority}</span></p>
              {selectedOrder.employees?.name && <p className="text-gray-400"><strong className="text-white">Responsável:</strong> {selectedOrder.employees.name}</p>}
              {selectedOrder.estimated_date && <p className="text-gray-400"><strong className="text-white">Data Prevista:</strong> {format(new Date(selectedOrder.estimated_date), 'dd/MM/yyyy')}</p>}
              <p className="text-gray-400"><strong className="text-white">Valor:</strong> <span className="text-amber-500 font-bold">R$ {(selectedOrder.total_value || 0).toLocaleString('pt-BR')}</span></p>
              {selectedOrder.notes && <p className="text-gray-400"><strong className="text-white">Observações:</strong> {selectedOrder.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Table & Horizontal Scroll Controls */}
      <div className="space-y-2">
        <div className="hidden sm:flex items-center justify-between flex-wrap gap-2 px-2 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></span>
            <span>↔ Deslize para o lado para ver todas as colunas e ações</span>
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                const el = document.getElementById('os-table-container');
                if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-amber-500/20 hover:text-amber-400 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all"
              title="Rolar para a esquerda"
            >
              ◀ Esquerda
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('os-table-container');
                if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-amber-500/20 hover:text-amber-400 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all"
              title="Rolar para a direita"
            >
              Direita ▶
            </button>
          </div>
        </div>

        {/* MOBILE: lista de cards (sem tabela, sem scroll horizontal) */}
        <div className="sm:hidden space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="bg-[#111111] border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white">#{o.order_number}</p>
                  <p className="font-bold text-white text-sm mt-0.5">{o.clients?.name || o.client_name || '-'}</p>
                  {(o.clients?.address || o.client_address) && (
                    <div className="text-[10px] text-gray-500 leading-tight flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                      {o.clients?.address || o.client_address}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${statusColors[o.status] || ''}`}>{statusLabels[o.status] || o.status}</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${priorityColors[o.priority] || ''}`}>{priorityLabels[o.priority] || o.priority}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                {(o.clients?.phone || o.client_phone) && (
                  <p className="flex items-center gap-1 col-span-2"><Phone className="w-3 h-3 text-green-500 flex-shrink-0" /> {o.clients?.phone || o.client_phone}</p>
                )}
                <p><span className="text-gray-600">Responsável:</span> {o.employees?.name || <span className="italic text-gray-600">Não atribuído</span>}</p>
                <p><span className="text-gray-600">Previsto:</span> {o.estimated_date ? format(new Date(o.estimated_date), 'dd/MM/yyyy') : '—'}</p>
                {o.description && <p className="col-span-2"><span className="text-gray-600">Descrição:</span> {o.description}</p>}
                <p className="col-span-2 font-bold text-amber-400 text-sm">R$ {(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="flex gap-2 items-center pt-1 border-t border-white/5">
                <button onClick={() => setSelectedOrder(o)}
                  className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-900/20 transition-all" title="Ver detalhes">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleWhatsAppShare(o)}
                  className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all" title="Mandar texto via WhatsApp">
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button onClick={() => openForm(o)} disabled={formLoading}
                  className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 hover:border-amber-500/30 transition-all text-gray-400 hover:text-blue-400 disabled:opacity-50" title="Editar">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(o.id)}
                  className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all" title="Excluir">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-[#111111] border border-white/10 rounded-2xl">{loading ? 'Carregando...' : 'Nenhuma OS encontrada'}</div>
          )}
        </div>

        <div
          id="os-table-container"
          className="hidden sm:block bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto text-white scrollbar-thin scrollbar-thumb-amber-500/40 w-full touch-pan-x"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
        >
          <table className="w-full min-w-[1050px]">
            <thead className="bg-[#1a1a1a] border-b border-white/10 sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">OS #</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Cliente</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Contato</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Responsável</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Descrição</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Prioridade</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Status</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Previsto</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Valor</th>
                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase sticky right-0 bg-[#1a1a1a] shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold text-white whitespace-nowrap">#{o.order_number}</td>
                  <td className="p-4 min-w-[180px]">
                    <div className="font-bold text-white">{o.clients?.name || o.client_name || '-'}</div>
                    {(o.clients?.address || o.client_address) && (
                      <div className="text-[10px] text-gray-500 leading-tight max-w-[180px] truncate flex items-center gap-1 mt-0.5" title={o.clients?.address || o.client_address}>
                        <MapPin className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                        {o.clients?.address || o.client_address}
                      </div>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {(o.clients?.phone || o.client_phone) ? (
                      <p className="text-sm text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3 text-green-500" /> {o.clients?.phone || o.client_phone}</p>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-sm whitespace-nowrap">{o.employees?.name || <span className="text-gray-600 italic">Não atribuído</span>}</td>
                  <td className="p-4 text-gray-400 text-sm max-w-xs min-w-[200px] truncate" title={o.description}>{o.description || '-'}</td>
                  <td className="p-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${priorityColors[o.priority] || ''}`}>{priorityLabels[o.priority] || o.priority}</span></td>
                  <td className="p-4 whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[o.status] || ''}`}>{statusLabels[o.status] || o.status}</span></td>
                  <td className="p-4 text-xs text-gray-400 whitespace-nowrap">
                    {o.estimated_date
                      ? format(new Date(o.estimated_date), 'dd/MM/yyyy')
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="p-4 font-bold text-amber-400 whitespace-nowrap">R$ {(o.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 sticky right-0 bg-[#111111] shadow-[-6px_0_12px_rgba(0,0,0,0.5)]">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setSelectedOrder(o)}
                        className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-900/20 transition-all" title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleWhatsAppShare(o)}
                        className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10" title="Mandar texto via WhatsApp">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      {o.pdf_url && (
                        <button onClick={async () => {
                          const phone = o.clients?.phone || o.client_phone;
                          if (!phone) {
                            toast({ title: '⚠️ Cliente sem telefone', variant: 'destructive' });
                            return;
                          }
                          
                          const cleanPhone = phone.replace(/\D/g, '');
                          const target = cleanPhone.length > 11 ? cleanPhone : '55' + cleanPhone;
                          
                          try {
                            toast({ title: '⏳ Enviando PDF...', description: 'Aguarde um momento.' });
                            const { data: conv } = await db.from('whatsapp_conversations').select('id').eq('phone_number', target).maybeSingle();
                            
                            let convId = conv?.id;
                            if (!convId) {
                               const { data: newConv } = await db.from('whatsapp_conversations').insert({ 
                                 phone_number: target, 
                                 contact_name: o.clients?.name || o.client_name 
                               }).select('id').single();
                               convId = newConv.id;
                            }

                            const res = await supabase.functions.invoke('whatsapp-send', {
                              body: { 
                                conversationId: convId, 
                                message: `Segue o PDF da OS #${o.order_number}: *${o.description}*`,
                                mediaUrl: o.pdf_url,
                                fileName: `OS_${o.order_number}.pdf`
                              }
                            });

                            if (res.error) throw res.error;
                            toast({ title: '✅ PDF Enviado!', description: 'A OS foi enviada para o WhatsApp do cliente.' });
                          } catch (e: any) {
                            toast({ title: '❌ Erro ao enviar', description: e.message, variant: 'destructive' });
                          }
                        }}
                          className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10" title="Enviar PDF p/ WhatsApp">
                          <FileDown className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openForm(o)} disabled={formLoading}
                        className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 hover:border-amber-500/30 transition-all text-gray-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-wait" title="Editar">
                        {formLoading ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        ) : (
                          <Edit className="w-4 h-4" />
                        )}
                      </button>
                      <button onClick={() => handleDelete(o.id)}
                        className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all" title="Excluir">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-gray-500">{loading ? 'Carregando...' : 'Nenhuma OS encontrada'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ServiceOrdersPage;
