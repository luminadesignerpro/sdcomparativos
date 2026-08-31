import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Search, Eye, Phone, Mail, DollarSign, CheckCircle, MessageCircle, Edit, X, User, MapPin, Calendar, Clock, Package, Wrench, StickyNote, FileDown, Trash } from 'lucide-react';
import { format } from 'date-fns';
import PdfUploader from '../admin/PdfUploader';

const db = supabase as any;

const SalesPage: React.FC = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [showPdfUploader, setShowPdfUploader] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    client_address: '',
    name: '',
    description: '',
    value: 0,
    status: 'em_negociacao',
    project_type: 'Móveis Projetados',
    material: '',
    deadline: '',
    meeting_time: '09:00',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [projRes, cliRes] = await Promise.all([
      db.from('client_projects').select('*, clients(name, phone, email, address)').order('created_at', { ascending: false }),
      db.from('clients').select('id, name, phone, email, address').order('name'),
    ]);
    setProjects(projRes.data || []);
    setClients(cliRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = (overrides: any = {}) => ({
    client_id: '', client_name: '', client_phone: '', client_email: '',
    client_address: '', name: '', description: '', value: 0,
    status: 'em_negociacao', project_type: 'Móveis Projetados',
    material: '', deadline: '', meeting_time: '09:00', notes: '',
    ...overrides,
  });

  const handleSave = async () => {
    if (!form.name.trim() || (!form.client_id && !form.client_name.trim())) {
      toast({ title: '⚠️ Preencha nome do projeto e cliente', variant: 'destructive' });
      return;
    }

    let clientId = form.client_id;

    // Se digitou nome manual e não selecionou cliente existente, cria um novo
    if (!clientId && form.client_name.trim()) {
      const { data: newClient, error: clientErr } = await db.from('clients').insert({ 
        name: form.client_name.trim(),
        phone: form.client_phone.trim() || null,
        email: form.client_email.trim() || null,
        address: form.client_address.trim() || null,
        status: 'active'
      }).select('id').single();

      if (clientErr) {
        toast({ title: '❌ Erro ao criar cliente', description: clientErr.message, variant: 'destructive' });
        return;
      }
      clientId = newClient.id;
    }

    if (!clientId) {
      toast({ title: '❌ Erro: Cliente não identificado', variant: 'destructive' });
      return;
    }

    const payload = {
      client_id: clientId,
      title: form.name,
      description: form.description || null,
      value: form.value,
      status: form.status,
      project_type: form.project_type || null,
      material: form.material || null,
      deadline: form.deadline || null,
      notes: form.notes || null,
    };
    
    let error;

    // Atualiza os dados do cliente também
    const { error: clientUpdateErr } = await db.from('clients').update({
      name: form.client_name.trim(),
      phone: form.client_phone.trim() || null,
      email: form.client_email.trim() || null,
      address: form.client_address.trim() || null,
    }).eq('id', clientId);

    if (clientUpdateErr) {
      console.error('Client update error:', clientUpdateErr);
      // Não bloqueia o salvamento do projeto, mas avisa
    }

    if (editingId) {
      const res = await db.from('client_projects').update(payload).eq('id', editingId);
      error = res.error;
      if (!error) toast({ title: '✅ Projeto atualizado' });
    } else {
      const res = await db.from('client_projects').insert(payload);
      error = res.error;
      if (!error) toast({ title: '✅ Novo projeto/venda criado' });
    }

    if (error) {
      console.error('Save error:', error);
      toast({ title: '❌ Erro ao salvar projeto', description: error.message, variant: 'destructive' });
      return;
    }

    setShowForm(false);
    setEditingId(null);
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await db.from('client_projects').update({ status }).eq('id', id);
    if (error) {
      toast({ title: '❌ Erro ao atualizar status', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Status atualizado' });
      fetchData();
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-gray-400 border border-white/20',
    em_negociacao: 'bg-amber-900/50 text-amber-500 border border-amber-500/30',
    assinado: 'bg-green-900/50 text-green-400 border border-green-500/30',
    producao: 'bg-blue-900/50 text-blue-400 border border-blue-500/30',
    instalacao: 'bg-purple-900/50 text-purple-400 border border-purple-500/30',
    concluido: 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30',
    cancelado: 'bg-red-900/50 text-red-500 border border-red-500/30',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    em_negociacao: 'Em Negociação',
    assinado: 'Assinado',
    assasinado: 'Assinado',
    producao: 'Produção',
    instalacao: 'Instalação',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta venda/projeto? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('client_projects').delete().eq('id', id);
    if (error) {
      toast({ title: '❌ Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Venda excluída com sucesso' });
      fetchData();
    }
  };

  const handleWhatsAppShare = async (p: any) => {
    const phone = p.clients?.phone || p.client_phone;
    if (!phone) {
      toast({ title: '⚠️ Cliente sem telefone cadastrado', variant: 'destructive' });
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const target = cleanPhone.length > 11 ? cleanPhone : '55' + cleanPhone;
    
    const message = `Olá *${p.clients?.name || p.client_name || 'Cliente'}*! 🏠\n\n` +
      `Sou da *SD Móveis Projetados*. Gostaria de falar sobre o projeto: *${p.title || p.name}*.\n\n` +
      `💰 *Valor:* R$ ${(p.value || 0).toLocaleString('pt-BR')}\n` +
      `📍 *Status:* ${statusLabels[p.status] || p.status}\n\n` +
      `🔑 *CHAVES PIX PARA PAGAMENTO:*\n\n` +
      `💎 *InfinityPay (CNPJ):* 49.228.811/0001-33\n` +
      `📧 *E-mail:* sdmoveis48@gmail.com\n` +
      `🏦 *Itaú (Celular):* 85 99760-2237\n\n` +
      `*Titular:* Samuel David C\n\n` +
      `Aguardamos seu contato!`;

    try {
      toast({ title: '⏳ Enviando PIX...', description: 'Aguarde um momento.' });
      
      // Busca ou cria conversa
      const { data: conv } = await db.from('whatsapp_conversations').select('id').eq('phone_number', target).maybeSingle();
      let convId = conv?.id;
      if (!convId) {
        const { data: newConv } = await db.from('whatsapp_conversations').insert({ 
          phone_number: target, 
          contact_name: p.clients?.name || p.client_name 
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
      toast({ title: '✅ Mensagem e QR Code enviados!', description: 'O cliente recebeu as chaves e o QR Code do Pix.' });
    } catch (e: any) {
      console.error('Erro ao enviar WhatsApp:', e);
      // Fallback para o link direto se a API falhar
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const totalRevenue = projects.reduce((sum, p) => sum + (p.value || 0), 0);
  const signedCount = projects.filter(p => ['assinado', 'producao', 'instalacao', 'concluido'].includes(p.status)).length;
  const inProduction = projects.filter(p => p.status === 'producao').length;
  const conversionRate = projects.length > 0 ? Math.round((signedCount / projects.length) * 100) : 0;

  const filtered = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = "w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all";
  const labelCls = "text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1";

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] w-full text-white">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-500" />
            Negócios SD
          </h1>
          <p className="text-gray-400 mt-1">Acompanhamento de Vendas e Produção</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <button onClick={() => setShowPdfUploader(true)}
            className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
            <FileDown className="w-5 h-5 text-amber-500" /> Importar PDF
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(resetForm()); }}
            className="text-black px-8 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
          >
            <Plus className="w-5 h-5" />
            + Nova Venda / Projeto
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
          <p className="text-xs text-gray-400 uppercase font-bold">Total em Contratos</p>
          <p className="text-2xl font-black text-white mt-1">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-[#111111] border border-green-500/20 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
          <p className="text-xs text-gray-400 uppercase font-bold">Assinados</p>
          <p className="text-2xl font-black text-green-400 mt-1">{signedCount} contratos</p>
        </div>
        <div className="bg-[#111111] border border-blue-500/20 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
          <p className="text-xs text-gray-400 uppercase font-bold">Em Produção</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{inProduction} projetos</p>
        </div>
        <div className="bg-[#111111] border border-purple-500/20 rounded-2xl p-4 shadow-lg hover:border-amber-500/30 transition-colors">
          <p className="text-xs text-gray-400 uppercase font-bold">Taxa de Conversão</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{conversionRate}%</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-3 w-5 h-5 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projeto ou cliente..." className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600" />
      </div>
      
      {showPdfUploader && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <PdfUploader 
            mode="venda"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-2xl border border-amber-500/30 p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl text-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                {editingId ? 'Editar' : 'Nova'} Venda / Projeto
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome do Cliente */}
              <div>
                <label className={labelCls}><User className="w-4 h-4 text-amber-500" /> Nome do Cliente *</label>
                <input type="text" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                  placeholder="Nome completo do cliente" className={inputCls} />
              </div>

              {/* Celular */}
              <div>
                <label className={labelCls}><Phone className="w-4 h-4 text-green-500" /> Celular</label>
                <input type="tel" value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="(00) 00000-0000" className={inputCls} />
              </div>

              {/* E-mail */}
              <div>
                <label className={labelCls}><Mail className="w-4 h-4 text-blue-500" /> E-mail</label>
                <input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })}
                  placeholder="email@cliente.com" className={inputCls} />
              </div>

              {/* Endereço */}
              <div>
                <label className={labelCls}><MapPin className="w-4 h-4 text-red-500" /> Endereço</label>
                <input type="text" value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade" className={inputCls} />
              </div>

              {/* Título do Projeto */}
              <div>
                <label className={labelCls}><FileText className="w-4 h-4 text-amber-500" /> Título do Projeto *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Cozinha Planejada, Quarto Completo..." className={inputCls} />
              </div>

              {/* Tipo de Projeto + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Package className="w-4 h-4 text-amber-500" /> Tipo</label>
                  <input type="text" value={form.project_type} onChange={e => setForm({ ...form, project_type: e.target.value })}
                    className={inputCls} placeholder="Móveis Projetados" />
                </div>
                <div>
                  <label className={labelCls}><DollarSign className="w-4 h-4 text-green-500" /> Valor (R$)</label>
                  <input type="number" value={form.value} onChange={e => setForm({ ...form, value: +e.target.value })}
                    placeholder="0,00" className={inputCls} />
                </div>
              </div>

              {/* Material */}
              <div>
                <label className={labelCls}><Wrench className="w-4 h-4 text-gray-500" /> Material</label>
                <input type="text" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}
                  placeholder="Ex: MDF Branco, BP Nogal..." className={inputCls} />
              </div>

              {/* Data + Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Calendar className="w-4 h-4 text-amber-500" /> Data *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                      className="w-full h-11 bg-[#1a1a1a] rounded-xl pl-10 pr-3 border border-white/10 text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}><Clock className="w-4 h-4 text-amber-500" /> Horário</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <select value={form.meeting_time} onChange={e => setForm({ ...form, meeting_time: e.target.value })}
                      className="w-full h-11 bg-[#1a1a1a] rounded-xl pl-10 pr-3 border border-white/10 text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all appearance-none">
                      {['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}><CheckCircle className="w-4 h-4 text-green-500" /> Status *</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full h-11 bg-[#1a1a1a] rounded-xl px-3 border border-white/10 text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all">
                  <option value="draft">Rascunho</option>
                  <option value="em_negociacao">Em Negociação</option>
                  <option value="assinado">Assinado</option>
                  <option value="producao">Produção</option>
                  <option value="instalacao">Instalação</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label className={labelCls}><StickyNote className="w-4 h-4 text-gray-500" /> Descrição do Projeto</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes do projeto, ambiente, medidas..." rows={2}
                  className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
              </div>

              {/* Observações */}
              <div>
                <label className={labelCls}><MessageCircle className="w-4 h-4 text-gray-500" /> Observações</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Detalhes adicionais, condições de pagamento..." rows={2}
                  className="w-full bg-[#1a1a1a] rounded-xl px-4 py-3 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave}
                className="flex-1 h-12 text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                <Plus className="w-4 h-4" />
                {editingId ? 'Salvar Alterações' : 'Confirmar Venda / Projeto'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="h-12 px-5 bg-white/10 border border-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProject(null)}>
          <div className="bg-[#111111] border border-amber-500/30 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-black text-white">{selectedProject.title || selectedProject.name}</h2>
              <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-gray-400"><strong className="text-white">Cliente:</strong> {selectedProject.clients?.name || selectedProject.client_name || '-'}</p>
              {(selectedProject.clients?.phone || selectedProject.client_phone) && (
                <p className="text-gray-400 flex items-center gap-2"><Phone className="w-4 h-4 text-green-500" /> {selectedProject.clients?.phone || selectedProject.client_phone}</p>
              )}
              {(selectedProject.clients?.email) && (
                <p className="text-gray-400 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-400" /> {selectedProject.clients.email}</p>
              )}
              {(selectedProject.clients?.address || selectedProject.client_address) && (
                <p className="text-gray-400 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-400" /> {selectedProject.clients?.address || selectedProject.client_address}</p>
              )}
              <p className="text-gray-400"><strong className="text-white">Valor:</strong> <span className="text-amber-500 font-bold">R$ {(selectedProject.value || 0).toLocaleString('pt-BR')}</span></p>
              <p className="text-gray-400"><strong className="text-white">Status:</strong> <span className={`px-3 py-1 rounded-full text-[10px] tracking-wider font-bold uppercase ${statusColors[selectedProject.status] || ''}`}>{statusLabels[selectedProject.status] || selectedProject.status}</span></p>
              {selectedProject.project_type && <p className="text-gray-400"><strong className="text-white">Tipo:</strong> {selectedProject.project_type}</p>}
              {selectedProject.material && <p className="text-gray-400"><strong className="text-white">Material:</strong> {selectedProject.material}</p>}
              {selectedProject.deadline && <p className="text-gray-400"><strong className="text-white">Data:</strong> {format(new Date(selectedProject.deadline), 'dd/MM/yyyy')}</p>}
              {selectedProject.description && <p className="text-gray-400"><strong className="text-white">Descrição:</strong> {selectedProject.description}</p>}
              {selectedProject.notes && <p className="text-gray-400"><strong className="text-white">Observações:</strong> {selectedProject.notes}</p>}
              <p className="text-gray-400"><strong className="text-white">Criado em:</strong> {format(new Date(selectedProject.created_at), 'dd/MM/yyyy')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto text-white">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[#1a1a1a] border-b border-white/10">
            <tr>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Cliente / Projeto</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Contato</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Material / Tipo</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Prazo</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Valor Total</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Status</th>
              <th className="text-left p-5 text-xs font-black text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-5">
                  <p className="font-bold text-white">{p.clients?.name || p.client_name || '-'}</p>
                  <p className="text-sm text-gray-400">{p.title || p.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(p.created_at), 'dd/MM/yyyy')}</p>
                </td>
                <td className="p-5">
                  {(p.clients?.phone || p.client_phone) && <p className="text-sm text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3 text-green-500" /> {p.clients?.phone || p.client_phone}</p>}
                  {(p.clients?.email) && <p className="text-sm text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3 text-amber-500" /> {p.clients.email}</p>}
                  {(p.clients?.address || p.client_address) && <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-red-400" /> {p.clients?.address || p.client_address}</p>}
                </td>
                <td className="p-5">
                  {p.project_type && <p className="text-sm text-gray-300">{p.project_type}</p>}
                  {p.material && <p className="text-xs text-gray-500">{p.material}</p>}
                </td>
                <td className="p-5 text-sm text-gray-400">
                  {p.deadline ? format(new Date(p.deadline), 'dd/MM/yyyy') : <span className="text-gray-600">—</span>}
                </td>
                <td className="p-5 font-black tracking-wide text-white text-lg">R$ {(p.value || 0).toLocaleString('pt-BR')}</td>
                <td className="p-5">
                  <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                    className={`px-4 py-2 rounded-full text-[10px] tracking-wider uppercase font-bold border-0 cursor-pointer focus:outline-none ${statusColors[p.status] || 'bg-[#1a1a1a] text-gray-400 border border-white/10'}`}>
                    <option value="draft" className="bg-[#1a1a1a] text-white">Rascunho</option>
                    <option value="em_negociacao" className="bg-[#1a1a1a] text-white">Em Negociação</option>
                    <option value="assinado" className="bg-[#1a1a1a] text-white">Assinado</option>
                    <option value="producao" className="bg-[#1a1a1a] text-white">Produção</option>
                    <option value="instalacao" className="bg-[#1a1a1a] text-white">Instalação</option>
                    <option value="concluido" className="bg-[#1a1a1a] text-white">Concluído</option>
                    <option value="cancelado" className="bg-[#1a1a1a] text-white">Cancelado</option>
                  </select>
                </td>
                <td className="p-5">
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedProject(p)}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-900/20 transition-all" title="Ver detalhes">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleWhatsAppShare(p)}
                      className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10" title="Mandar texto via WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    {p.pdf_url && (
                      <button onClick={async () => {
                        const phone = p.clients?.phone || p.client_phone;
                        if (!phone) {
                          toast({ title: '⚠️ Cliente sem telefone', variant: 'destructive' });
                          return;
                        }
                        
                        // Busca conversa ou cria uma
                        const cleanPhone = phone.replace(/\D/g, '');
                        const target = cleanPhone.length > 11 ? cleanPhone : '55' + cleanPhone;
                        
                        try {
                          toast({ title: '⏳ Enviando PDF...', description: 'Aguarde um momento.' });
                          const { data: conv } = await db.from('whatsapp_conversations').select('id').eq('phone_number', target).maybeSingle();
                          
                          let convId = conv?.id;
                          if (!convId) {
                             const { data: newConv } = await db.from('whatsapp_conversations').insert({ 
                               phone_number: target, 
                               contact_name: p.clients?.name || p.client_name 
                             }).select('id').single();
                             convId = newConv.id;
                          }

                          const res = await supabase.functions.invoke('whatsapp-send', {
                            body: { 
                              conversationId: convId, 
                              message: `Segue o PDF do projeto: *${p.title || p.name}*`,
                              mediaUrl: p.pdf_url,
                              fileName: `${p.title || 'projeto'}.pdf`
                            }
                          });

                          if (res.error) throw res.error;
                          toast({ title: '✅ PDF Enviado!', description: 'O arquivo foi enviado para o WhatsApp do cliente.' });
                        } catch (e: any) {
                          toast({ title: '❌ Erro ao enviar', description: e.message, variant: 'destructive' });
                        }
                      }}
                        className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10" title="Enviar PDF p/ WhatsApp">
                        <FileDown className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => {
                      setEditingId(p.id);
                      setForm(resetForm({
                        client_id: p.client_id || '',
                        client_name: p.clients?.name || p.client_name || '',
                        client_phone: p.clients?.phone || p.client_phone || '',
                        client_email: p.clients?.email || '',
                        client_address: p.clients?.address || p.client_address || '',
                        name: p.title || p.name,
                        description: p.description || '',
                        value: p.value || 0,
                        status: p.status,
                        project_type: p.project_type || '',
                        material: p.material || '',
                        deadline: p.deadline ? p.deadline.split('T')[0] : '',
                        meeting_time: '09:00',
                        notes: p.notes || '',
                      }));
                      setShowForm(true);
                    }}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 transition-all" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all" title="Excluir">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">{loading ? 'Carregando...' : 'Nenhum projeto encontrado'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesPage;
