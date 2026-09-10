import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Banknote, Plus, TrendingUp, TrendingDown, Calendar, Search, 
  Eye, Edit, Trash, MessageCircle, X, ArrowUpRight, ArrowDownRight, 
  CreditCard, Wallet, FileText, CheckCircle2, DollarSign
} from 'lucide-react';
import { format } from 'date-fns';

const db = supabase as any;

interface CashEntry {
  id: string;
  type: 'entrada' | 'saida';
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  date: string;
  created_at?: string;
  reference_id?: string | null;
  reference_type?: string | null;
}

const CashRegisterPage: React.FC = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  
  // Modais e Estados de Edição
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null);

  const [form, setForm] = useState({
    type: 'entrada' as 'entrada' | 'saida',
    category: 'Geral',
    description: '',
    amount: 0,
    payment_method: 'dinheiro',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await db
      .from('cash_register')
      .select('*')
      .order('date', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: '❌ Erro ao carregar caixa', description: error.message, variant: 'destructive' });
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNewForm = () => {
    setEditingId(null);
    setForm({
      type: 'entrada',
      category: 'Geral',
      description: '',
      amount: 0,
      payment_method: 'dinheiro',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowForm(true);
  };

  const openEditForm = (entry: CashEntry) => {
    setEditingId(entry.id);
    setForm({
      type: entry.type,
      category: entry.category || 'Geral',
      description: entry.description || '',
      amount: entry.amount || 0,
      payment_method: entry.payment_method || 'dinheiro',
      date: entry.date ? format(new Date(entry.date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      toast({ title: '⚠️ Descrição obrigatória', variant: 'destructive' });
      return;
    }
    if (form.amount <= 0) {
      toast({ title: '⚠️ O valor deve ser maior que zero', variant: 'destructive' });
      return;
    }

    const payload = {
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
      payment_method: form.payment_method,
      date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await db.from('cash_register').update(payload).eq('id', editingId);
      if (error) {
        toast({ title: '❌ Erro ao atualizar lançamento', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: '✅ Lançamento atualizado com sucesso!' });
    } else {
      const { error } = await db.from('cash_register').insert(payload);
      if (error) {
        toast({ title: '❌ Erro ao salvar lançamento', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: '✅ Lançamento registrado com sucesso!' });
    }

    setShowForm(false);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    
    const { error } = await db.from('cash_register').delete().eq('id', id);
    if (error) {
      toast({ title: '❌ Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Lançamento excluído com sucesso' });
      fetchData();
    }
  };

  const handleWhatsAppShare = (e: CashEntry) => {
    const isEntrada = e.type === 'entrada';
    const message = `*COMPROVANTE DE MOVIMENTAÇÃO FINANCEIRA* 💵\n` +
      `*SD Móveis Projetados*\n\n` +
      `📌 *Tipo:* ${isEntrada ? '🟢 ENTRADA' : '🔴 SAÍDA'}\n` +
      `📝 *Descrição:* ${e.description}\n` +
      `🏷️ *Categoria:* ${e.category}\n` +
      `💳 *Forma de Pgto:* ${(e.payment_method || '').toUpperCase()}\n` +
      `📅 *Data:* ${format(new Date(e.date), 'dd/MM/yyyy HH:mm')}\n` +
      `💰 *Valor:* R$ ${e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `_Registro efetuado no sistema SD Vision_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Cálculos de Totais
  const totalEntradas = entries.filter(e => e.type === 'entrada').reduce((s, e) => s + e.amount, 0);
  const totalSaidas = entries.filter(e => e.type === 'saida').reduce((s, e) => s + e.amount, 0);
  const saldo = totalEntradas - totalSaidas;

  // Filtragem
  const filteredEntries = entries.filter(e => {
    const matchesSearch = 
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.payment_method || '').toLowerCase().includes(search.toLowerCase()) ||
      String(e.amount).includes(search);

    const matchesType = typeFilter === 'todos' || e.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const inputCls = "w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white placeholder:text-gray-600 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-all";
  const labelCls = "text-sm font-semibold text-gray-300 flex items-center gap-2 mb-1";

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] w-full text-white">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <Banknote className="w-8 h-8 text-amber-500" />
            Caixa
          </h1>
          <p className="text-gray-400 mt-1">Controle de movimentações financeiras</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={openNewForm} 
            className="text-black px-6 py-3.5 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center" 
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
          >
            <Plus className="w-5 h-5" /> Novo Lançamento
          </button>
        </div>
      </header>

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111111] border border-green-500/20 rounded-2xl p-5 shadow-lg hover:border-green-500/40 transition-colors">
          <p className="text-xs text-green-400 uppercase font-bold flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-green-400" /> Entradas
          </p>
          <p className="text-3xl font-black text-green-400 mt-1">
            R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {entries.filter(e => e.type === 'entrada').length} recebimento(s)
          </p>
        </div>

        <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-5 shadow-lg hover:border-red-500/40 transition-colors">
          <p className="text-xs text-red-500 uppercase font-bold flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-red-500" /> Saídas
          </p>
          <p className="text-3xl font-black text-red-500 mt-1">
            R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {entries.filter(e => e.type === 'saida').length} despesa(s)
          </p>
        </div>

        <div className={`rounded-2xl p-5 shadow-lg bg-[#111111] border ${saldo >= 0 ? 'border-blue-500/20 hover:border-blue-500/40' : 'border-red-500/20 hover:border-red-500/40'} transition-colors`}>
          <p className="text-xs text-gray-400 uppercase font-bold flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-amber-400" /> Saldo Líquido
          </p>
          <p className={`text-3xl font-black mt-1 ${saldo >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
            R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {entries.length} movimentação(ões) no total
          </p>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por descrição, categoria, valor..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600 text-sm" 
          />
        </div>

        {/* Filtros de Tipo */}
        <div className="flex items-center gap-2 bg-[#111111] p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setTypeFilter('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              typeFilter === 'todos' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos ({entries.length})
          </button>
          <button
            onClick={() => setTypeFilter('entrada')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              typeFilter === 'entrada' 
                ? 'bg-green-600 text-white shadow-md' 
                : 'text-green-400 hover:bg-green-500/10'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Entradas ({entries.filter(e => e.type === 'entrada').length})
          </button>
          <button
            onClick={() => setTypeFilter('saida')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              typeFilter === 'saida' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" /> Saídas ({entries.filter(e => e.type === 'saida').length})
          </button>
        </div>
      </div>

      {/* Modal de Formulário (Novo / Editar) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#111111] rounded-2xl border border-amber-500/30 w-full max-w-xl shadow-2xl text-white overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
              <div className="flex items-center gap-3">
                <Banknote className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                  {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                {editingId && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                    Editando
                  </span>
                )}
              </div>
              <button 
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do formulário */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Tipo de Lançamento Toggle */}
              <div>
                <label className={labelCls}>Tipo de Movimentação *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'entrada' })}
                    className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                      form.type === 'entrada'
                        ? 'bg-green-600/30 border-green-500 text-green-400 shadow-lg shadow-green-500/10'
                        : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Entrada (Receita)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'saida' })}
                    className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                      form.type === 'saida'
                        ? 'bg-red-600/30 border-red-500 text-red-400 shadow-lg shadow-red-500/10'
                        : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" /> Saída (Despesa)
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className={labelCls}><FileText className="w-4 h-4 text-amber-500" /> Descrição *</label>
                <input 
                  type="text" 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Ex: Recebimento de entrada da OS #1003" 
                  className={inputCls} 
                />
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><DollarSign className="w-4 h-4 text-green-500" /> Valor (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={form.amount || ''} 
                    onChange={e => setForm({ ...form, amount: +e.target.value })} 
                    placeholder="0,00" 
                    className={inputCls} 
                  />
                </div>
                <div>
                  <label className={labelCls}><Calendar className="w-4 h-4 text-blue-400" /> Data e Hora</label>
                  <input 
                    type="datetime-local" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                    className={inputCls} 
                  />
                </div>
              </div>

              {/* Categoria e Forma de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Categoria</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({ ...form, category: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="Geral">Geral</option>
                    <option value="Material">Material</option>
                    <option value="Mão de Obra">Mão de Obra</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Venda">Venda</option>
                    <option value="Recebimento">Recebimento</option>
                    <option value="Pagamento Fornecedor">Pagamento Fornecedor</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}><CreditCard className="w-4 h-4 text-purple-400" /> Forma de Pagamento</label>
                  <select 
                    value={form.payment_method} 
                    onChange={e => setForm({ ...form, payment_method: e.target.value })} 
                    className="w-full h-11 bg-[#1a1a1a] rounded-xl px-4 border border-white/10 text-white text-sm focus:border-amber-500 outline-none"
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão de Crédito</option>
                    <option value="debito">Cartão de Débito</option>
                    <option value="boleto">Boleto</option>
                    <option value="transferencia">Transferência Bancária</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Footer do modal */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-[#0d0d0d]">
              <button 
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="h-11 px-5 bg-white/10 border border-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="h-11 px-6 text-black rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg text-sm"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {editingId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Detalhes do Lançamento */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEntry(null)}>
          <div className="bg-[#111111] border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${selectedEntry.type === 'entrada' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {selectedEntry.type === 'entrada' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Comprovante de Caixa</h2>
                  <p className="text-xs text-gray-500">ID: {selectedEntry.id.slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm bg-[#161616] p-5 rounded-2xl border border-white/5">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Valor</p>
                <p className={`text-2xl font-black ${selectedEntry.type === 'entrada' ? 'text-green-400' : 'text-red-500'}`}>
                  {selectedEntry.type === 'entrada' ? '+' : '-'} R$ {selectedEntry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="border-t border-white/5 pt-3">
                <p className="text-xs text-gray-500 uppercase font-bold">Descrição</p>
                <p className="text-white font-medium mt-0.5">{selectedEntry.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Tipo</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${
                    selectedEntry.type === 'entrada' 
                      ? 'bg-green-900/50 text-green-400 border border-green-500/30' 
                      : 'bg-red-900/50 text-red-500 border border-red-500/30'
                  }`}>
                    {selectedEntry.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Categoria</p>
                  <p className="text-white font-semibold mt-1">{selectedEntry.category || 'Geral'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Forma de Pagamento</p>
                  <p className="text-white font-semibold uppercase mt-0.5">{selectedEntry.payment_method || 'Dinheiro'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Data do Registro</p>
                  <p className="text-gray-300 text-xs mt-0.5">{format(new Date(selectedEntry.date), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => handleWhatsAppShare(selectedEntry)}
                className="flex-1 py-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600/30 transition-all text-sm"
              >
                <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
              </button>
              <button 
                onClick={() => {
                  const toEdit = selectedEntry;
                  setSelectedEntry(null);
                  openEditForm(toEdit);
                }}
                className="py-3 px-5 bg-white/10 border border-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all text-sm"
              >
                <Edit className="w-4 h-4" /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Lançamentos */}
      <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto text-white">
        <table className="w-full min-w-[850px]">
          <thead className="bg-[#1a1a1a] border-b border-white/10">
            <tr>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Data</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Tipo</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Descrição</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Categoria</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Forma Pgto</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Valor</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(e => (
              <tr key={e.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-sm text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  {format(new Date(e.date), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                    e.type === 'entrada' 
                      ? 'bg-green-900/50 text-green-400 border-green-500/30' 
                      : 'bg-red-900/50 text-red-500 border-red-500/30'
                  }`}>
                    {e.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                  </span>
                </td>
                <td className="p-4 font-bold text-white max-w-xs truncate">{e.description}</td>
                <td className="p-4">
                  <span className="bg-white/10 border border-white/10 text-gray-300 px-3 py-1 rounded-full text-xs font-bold">
                    {e.category}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-400 uppercase tracking-wider">{e.payment_method}</td>
                <td className={`p-4 font-bold text-base ${e.type === 'entrada' ? 'text-green-400' : 'text-red-500'}`}>
                  {e.type === 'entrada' ? '+' : '-'} R$ {e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {/* Botão Ver Detalhes */}
                    <button 
                      onClick={() => setSelectedEntry(e)}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-900/20 transition-all" 
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Botão WhatsApp */}
                    <button 
                      onClick={() => handleWhatsAppShare(e)}
                      className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10" 
                      title="Compartilhar no WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Botão Editar */}
                    <button 
                      onClick={() => openEditForm(e)}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 hover:border-amber-500/30 transition-all text-gray-400 hover:text-blue-400" 
                      title="Editar lançamento"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Botão Excluir */}
                    <button 
                      onClick={() => handleDelete(e.id)}
                      className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all" 
                      title="Excluir lançamento"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  {loading ? 'Carregando movimentações...' : 'Nenhum lançamento encontrado com os filtros aplicados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashRegisterPage;
