import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  FileSignature, Plus, Search, Edit, Sparkles, Key, MessageCircle, X, 
  User, Phone, MapPin, ClipboardList, DollarSign, Clock, FileDown, Trash2 
} from 'lucide-react';
import { format } from 'date-fns';
import ContractGenerator from './ContractGenerator';
import PdfUploader from '../admin/PdfUploader';

const db = supabase as any;

const ContractsPage: React.FC = () => {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_phone: '',
    client_address: '',
    title: '',
    content: '',
    value: 0,
    status: 'rascunho',
    notes: '',
    payment_terms: '',
    delivery_deadline: ''
  });
  const [showGenerator, setShowGenerator] = useState<'contrato_servico' | 'ordem_servico' | null>(null);
  const [showPdfUploader, setShowPdfUploader] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [contRes, cliRes] = await Promise.all([
      db.from('contracts').select('*, clients(name, phone, email, address)').order('created_at', { ascending: false }),
      db.from('clients').select('id, name, phone, email, address').order('name'),
    ]);
    setContracts(contRes.data || []);
    setClients(cliRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: '⚠️ Título obrigatório', variant: 'destructive' }); return; }

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
      fetchData();
    } else if (clientId) {
      // Opcional: Atualizar info do cliente se houver clientId
      await db.from('clients').update({
        phone: form.client_phone || null,
        address: form.client_address || null
      }).eq('id', clientId);
    }

    const payload = {
      client_id: clientId,
      title: form.title,
      content: form.content,
      value: form.value,
      status: form.status,
      notes: `${form.notes || ''}\n[Prazos: ${form.delivery_deadline} | Pagamento: ${form.payment_terms}]`.trim(),
    };

    let result;
    if (editingId) {
      result = await db.from('contracts').update(payload).eq('id', editingId);
    } else {
      result = await db.from('contracts').insert(payload);
    }

    if (result.error) {
      toast({ title: '❌ Erro ao salvar', description: result.error.message, variant: 'destructive' });
      return;
    }

    toast({ title: editingId ? '✅ Contrato atualizado' : '✅ Contrato criado' });
    setShowForm(false);
    setEditingId(null);
    setForm({
      client_id: '', client_name: '', client_phone: '', client_address: '',
      title: '', content: '', value: 0, status: 'rascunho', 
      notes: '', payment_terms: '', delivery_deadline: ''
    });
    fetchData();
  };

  const statusColors: Record<string, string> = {
    rascunho: 'bg-white/10 text-gray-400 border border-white/20',
    ativo: 'bg-green-900/50 text-green-400 border border-green-500/30',
    assinado: 'bg-blue-900/50 text-blue-400 border border-blue-500/30',
    cancelado: 'bg-red-900/50 text-red-500 border border-red-500/30',
    finalizado: 'bg-purple-900/50 text-purple-400 border border-purple-500/30',
  };

  const handleWhatsAppShare = async (c: any) => {
    const phone = c.client_phone || c.clients?.phone;
    if (!phone) {
      toast({ title: '⚠️ Cliente sem telefone', variant: 'destructive' });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const target = cleanPhone.length > 11 ? cleanPhone : '55' + cleanPhone;

    const message = `Olá *${c.clients?.name || c.client_name || 'Cliente'}*! 📄\n\n` +
      `Sou da *SD Móveis Projetados*. Tratando sobre o *Contrato #${c.contract_number}*: *${c.title}*.\n\n` +
      `💰 *Valor:* R$ ${(c.value || 0).toLocaleString('pt-BR')}\n` +
      `📅 *Prazo:* ${c.delivery_deadline || 'A combinar'}\n` +
      `💳 *Pagamento:* ${c.payment_terms || 'A combinar'}\n\n` +
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
          contact_name: c.clients?.name || c.client_name 
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
      toast({ title: '✅ Mensagem e QR Code enviados!', description: 'O cliente recebeu os dados do contrato e o QR Code do Pix.' });
    } catch (e: any) {
      console.error('Erro ao enviar WhatsApp:', e);
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const generateClientLogin = async (contract: any) => {
    if (!contract.clients) {
      toast({ title: '⚠️ Vincule um cliente primeiro', variant: 'destructive' });
      return;
    }
    
    const clientName = contract.clients.name;

    // Busca todos os registros de clientes com esse nome (evita maybeSingle que falha com múltiplos)
    const { data: empList } = await db
      .from('employees')
      .select('id, password')
      .eq('name', clientName)
      .eq('role', 'Cliente')
      .limit(5);
    
    // Se já tem algum com senha, mostra a primeira
    const existing = empList?.find((e: any) => e.password);
    if (existing?.password) {
      toast({ 
        title: '🔑 Acesso do Cliente', 
        description: `Senha atual de ${clientName}: ${existing.password}`, 
        duration: 15000 
      });
      return;
    }

    // Se tem registros sem senha, atualiza o primeiro com uma senha
    if (empList && empList.length > 0) {
      const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
      await db.from('employees').update({ password: tempPassword }).eq('id', empList[0].id);
      toast({ title: '🔑 Senha Definida!', description: `Senha de ${clientName}: ${tempPassword}`, duration: 15000 });
      return;
    }

    // Não existe nenhum registro — cria um novo
    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const { error } = await db.from('employees').insert([{
        name: clientName,
        email: `cliente_${contract.client_id}@sdmoveis.com`,
        password: tempPassword,
        role: 'Cliente',
        active: true
      }]);
      
      if (error) throw error;
      toast({ title: '🔑 Acesso Criado!', description: `Senha de ${clientName}: ${tempPassword}`, duration: 15000 });
    } catch (e: any) {
      toast({ title: '❌ Erro ao gerar acesso', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('contracts').delete().eq('id', id);
    if (error) {
      toast({ title: '❌ Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Contrato excluído com sucesso' });
      fetchData();
    }
  };

  const filtered = contracts.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    (c.clients?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] w-full text-white">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <FileSignature className="w-8 h-8 text-amber-500" />
            Contratos <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded ml-2 border border-amber-500/30">v3.0 GOLD</span>
          </h1>
          <p className="text-gray-400 mt-1">Gestão de contratos (Design Black Gold Atualizado)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <button onClick={() => setShowPdfUploader(true)}
            className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 w-full xl:w-auto justify-center">
            <FileDown className="w-5 h-5 text-amber-500" /> Importar PDF
          </button>
          <button onClick={() => setShowGenerator('contrato_servico')} className="bg-[#1a1a1a] border border-amber-500/30 text-amber-500 px-5 py-3 rounded-2xl font-bold hover:bg-amber-500/10 flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto transition-colors">
            <Sparkles className="w-5 h-5" /> Gerar Contrato (IA)
          </button>
          <button onClick={() => setShowForm(true)} className="text-black px-5 py-3 rounded-2xl font-bold hover:opacity-90 flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto transition-opacity" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
            <Plus className="w-5 h-5" /> Manual
          </button>
        </div>
      </header>

      {showGenerator && (
        <ContractGenerator 
          templateType={showGenerator} 
          clients={clients} 
          onClose={() => setShowGenerator(null)} 
          onSaved={fetchData} 
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['rascunho', 'ativo', 'assinado', 'finalizado'].map(st => (
          <div key={st} className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
            <p className="text-xs text-gray-400 uppercase font-bold">{st}</p>
            <p className="text-2xl font-black text-white mt-1">{contracts.filter(c => c.status === st).length}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-3 w-5 h-5 text-gray-500" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar contrato..." 
          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:outline-none focus:border-amber-500" 
        />
      </div>

      {showPdfUploader && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <PdfUploader 
            mode="contrato"
            onClose={() => setShowPdfUploader(false)} 
            onSuccess={() => {
              fetchData();
              setShowPdfUploader(false);
            }}
          />
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-2xl border border-amber-500/30 p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl text-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-amber-500" />
                {editingId ? 'Editar' : 'Novo'} Contrato Manual
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><ClipboardList className="w-4 h-4 text-amber-500" /> Título do Projeto *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} 
                  placeholder="Ex: Cozinha Gourmet" className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><User className="w-4 h-4 text-amber-500" /> Cliente Cadastrado</label>
                  <select value={form.client_id} onChange={e => {
                    const c = clients.find(cl => cl.id === e.target.value);
                    setForm({ ...form, client_id: e.target.value, client_name: c?.name || '', client_phone: c?.phone || '', client_address: c?.address || '' });
                  }} className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm outline-none focus:border-amber-500">
                    <option value="">Selecionar...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1">Nome Manual</label>
                  <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><Phone className="w-4 h-4 text-green-500" /> Celular</label>
                  <input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><MapPin className="w-4 h-4 text-red-500" /> Endereço</label>
                  <input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /> Pagamento</label>
                  <input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} 
                    placeholder="Ex: 50% + 50%" className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /> Prazo</label>
                  <input value={form.delivery_deadline} onChange={e => setForm({ ...form, delivery_deadline: e.target.value })} 
                    placeholder="Ex: 45 dias" className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /> Valor (R$)</label>
                  <input type="number" value={form.value} onChange={e => setForm({ ...form, value: +e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm outline-none focus:border-amber-500">
                    <option value="rascunho">Rascunho</option>
                    <option value="ativo">Ativo</option>
                    <option value="assinado">Assinado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-300 border-white/10 flex items-center gap-2 mb-1"><MessageCircle className="w-4 h-4 text-gray-500" /> Descrição</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} 
                  rows={2} className="w-full bg-[#1a1a1a] rounded-xl px-4 py-2 border border-white/10 text-white text-sm outline-none focus:border-amber-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleSave} 
                className="flex-1 h-12 text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
              >
                <FileSignature className="w-4 h-4" /> Finalizar
              </button>
              <button onClick={() => setShowForm(false)} className="h-12 px-6 bg-white/10 text-white rounded-xl font-bold border border-white/10">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto text-white">
        <table className="w-full min-w-[800px]">
          <thead className="bg-[#1a1a1a] border-b border-white/10">
            <tr>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">#</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Título</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Cliente</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Valor</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Status</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Data</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-4 font-bold text-gray-500">#{c.contract_number}</td>
                <td className="p-4 font-bold text-white">{c.title}</td>
                <td className="p-4 text-gray-400">{c.clients?.name || c.client_name || '-'}</td>
                <td className="p-4 font-bold text-amber-500">R$ {(c.value || 0).toLocaleString('pt-BR')}</td>
                <td className="p-4"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[c.status] || ''}`}>{c.status}</span></td>
                <td className="p-4 text-sm text-gray-400">{format(new Date(c.created_at), 'dd/MM/yyyy')}</td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => generateClientLogin(c)} title="Gerar Login" className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center hover:bg-amber-500/10"><Key className="w-4 h-4" /></button>
                  <button onClick={() => handleWhatsAppShare(c)} className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"><MessageCircle className="w-4 h-4" /></button>
                  {c.pdf_url && (
                    <button onClick={async () => {
                      const phone = c.clients?.phone || c.client_phone;
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
                           const { data: newConv } = await db.from('whatsapp_conversations').insert({ phone_number: target, contact_name: c.clients?.name || c.client_name }).select('id').single();
                           convId = newConv.id;
                        }
                        const res = await supabase.functions.invoke('whatsapp-send', {
                          body: { 
                            conversationId: convId, 
                            message: `Segue o PDF do contrato: *${c.title}*`,
                            mediaUrl: c.pdf_url,
                            fileName: `${c.title}.pdf`
                          }
                        });
                        if (res.error) throw res.error;
                        toast({ title: '✅ PDF Enviado!' });
                      } catch (e: any) {
                        toast({ title: '❌ Erro ao enviar', description: e.message, variant: 'destructive' });
                      }
                    }}
                      className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-white transition-all" title="Enviar PDF p/ WhatsApp">
                      <FileDown className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => {
                    setEditingId(c.id);
                    setForm({
                      client_id: c.client_id || '',
                      client_name: c.client_name || c.clients?.name || '',
                      client_phone: c.client_phone || c.clients?.phone || '',
                      client_address: c.client_address || c.clients?.address || '',
                      title: c.title,
                      content: c.content || '',
                      value: c.value || 0,
                      status: c.status,
                      notes: c.notes || '',
                      payment_terms: c.payment_terms || '',
                      delivery_deadline: c.delivery_deadline || ''
                    });
                    setShowForm(true);
                  }} className="w-9 h-9 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/20"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c.id)}
                    className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all" title="Excluir contrato">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractsPage;
