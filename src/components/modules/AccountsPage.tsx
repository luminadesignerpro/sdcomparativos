import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Plus, Check, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const db = supabase as any;

interface AccountsPageProps {
  type: 'payable' | 'receivable';
}

const AccountsPage: React.FC<AccountsPageProps> = ({ type }) => {
  const { toast } = useToast();
  const table = type === 'payable' ? 'accounts_payable' : 'accounts_receivable';
  const isPay = type === 'payable';
  const [entries, setEntries] = useState<any[]>([]);
  const [refs, setRefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', amount: 0, due_date: '', category: 'Geral', notes: '', ref_id: '' });

  const fetchData = async () => {
    setLoading(true);
    const refTable = isPay ? 'suppliers' : 'clients';
    const [entriesRes, refsRes] = await Promise.all([
      db.from(table).select(`*, ${refTable}(name)`).order('due_date', { ascending: true }),
      db.from(refTable).select('id, name').order('name'),
    ]);
    setEntries(entriesRes.data || []);
    setRefs(refsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [type]);

  const handleSave = async () => {
    if (!form.description.trim() || !form.due_date) { toast({ title: '⚠️ Preencha os campos obrigatórios', variant: 'destructive' }); return; }
    const payload: any = { description: form.description, amount: form.amount, due_date: form.due_date, category: form.category, notes: form.notes || null };
    if (isPay) payload.supplier_id = form.ref_id || null;
    else payload.client_id = form.ref_id || null;
    await db.from(table).insert(payload);
    toast({ title: `✅ Conta ${isPay ? 'a pagar' : 'a receber'} registrada` });
    setShowForm(false);
    fetchData();
  };

  const markDone = async (id: string) => {
    const field = isPay ? 'paid' : 'received';
    const atField = isPay ? 'paid_at' : 'received_at';
    await db.from(table).update({ [field]: true, [atField]: new Date().toISOString() }).eq('id', id);
    toast({ title: isPay ? '✅ Pago!' : '✅ Recebido!' });
    fetchData();
  };

  const totalPending = entries.filter(e => !(isPay ? e.paid : e.received)).reduce((s, e) => s + e.amount, 0);
  const totalDone = entries.filter(e => (isPay ? e.paid : e.received)).reduce((s, e) => s + e.amount, 0);
  const overdue = entries.filter(e => !(isPay ? e.paid : e.received) && new Date(e.due_date) < new Date()).length;

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] w-full text-white">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-amber-500" />
            Contas a {isPay ? 'Pagar' : 'Receber'}
          </h1>
          <p className="text-gray-400 mt-1">Gestão financeira</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ description: '', amount: 0, due_date: '', category: 'Geral', notes: '', ref_id: '' }); }} className="text-black px-6 py-3 rounded-2xl font-bold hover:opacity-90 flex items-center gap-2 shadow-lg w-full sm:w-auto justify-center" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
          <Plus className="w-5 h-5" /> Nova Conta
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-2xl p-5 shadow-lg bg-[#111111] border ${isPay ? 'border-red-500/20' : 'border-green-500/20'} hover:border-amber-500/30 transition-colors`}>
          <p className="text-xs text-gray-400 uppercase font-bold">Pendente</p>
          <p className={`text-3xl font-black mt-1 ${isPay ? 'text-red-400' : 'text-green-400'}`}>R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-5 shadow-lg hover:border-amber-500/30 transition-colors">
          <p className="text-xs text-gray-400 uppercase font-bold">{isPay ? 'Pago' : 'Recebido'}</p>
          <p className="text-3xl font-black text-white mt-1">R$ {totalDone.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-2xl p-5 shadow-lg bg-[#111111] border ${overdue > 0 ? 'border-red-500/30' : 'border-white/10'} hover:border-amber-500/30 transition-colors`}>
          <p className="text-xs text-gray-400 uppercase font-bold flex items-center gap-1">{overdue > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />} Vencidas</p>
          <p className={`text-3xl font-black mt-1 ${overdue > 0 ? 'text-red-500' : 'text-white'}`}>{overdue}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#111111] border border-amber-500/20 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-lg text-white">Nova Conta a {isPay ? 'Pagar' : 'Receber'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição *" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-500" />
            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} placeholder="Valor (R$)" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-500" />
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-500" />
            <select value={form.ref_id} onChange={e => setForm({ ...form, ref_id: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option value="">{isPay ? 'Fornecedor' : 'Cliente'} (opcional)</option>
              {refs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option>Geral</option><option>Material</option><option>Mão de Obra</option><option>Transporte</option><option>Aluguel</option><option>Impostos</option><option>Projeto</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="text-black px-6 py-3 rounded-xl font-bold transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>Salvar</button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto text-white">
        <table className="w-full min-w-[700px]">
          <thead className="bg-[#1a1a1a] border-b border-white/10">
            <tr>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Descrição</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">{isPay ? 'Fornecedor' : 'Cliente'}</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Vencimento</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Valor</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Status</th>
              <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Ação</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const done = isPay ? e.paid : e.received;
              const isOverdue = !done && new Date(e.due_date) < new Date();
              const refName = isPay ? e.suppliers?.name : e.clients?.name;
              return (
                <tr key={e.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${isOverdue ? 'bg-red-900/10' : ''}`}>
                  <td className="p-4 font-bold text-white">{e.description}</td>
                  <td className="p-4 text-gray-400">{refName || '-'}</td>
                  <td className="p-4 text-sm flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-500" />
                    <span className={isOverdue ? 'text-red-500 font-bold' : 'text-gray-400'}>{format(new Date(e.due_date), 'dd/MM/yyyy')}</span>
                  </td>
                  <td className="p-4 font-bold text-white">R$ {e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${done ? 'bg-green-900/50 text-green-400 border-green-500/30' : isOverdue ? 'bg-red-900/50 text-red-500 border-red-500/30' : 'bg-amber-900/50 text-amber-500 border-amber-500/30'}`}>
                      {done ? (isPay ? 'Pago' : 'Recebido') : isOverdue ? 'Vencido' : 'Pendente'}
                    </span>
                  </td>
                  <td className="p-4">
                    {!done && (
                      <button onClick={() => markDone(e.id)} className="w-9 h-9 bg-green-900/40 border border-green-500/30 rounded-xl flex items-center justify-center hover:bg-green-900/60 text-green-400 transition-all">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">{loading ? 'Carregando...' : 'Nenhuma conta encontrada'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountsPage;
