import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Search, Edit, Trash2, AlertTriangle } from 'lucide-react';

const db = supabase as any;

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock_quantity: number;
  min_stock: number;
  supplier_id: string | null;
  active: boolean;
}

const ProductsPage: React.FC = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', sku: '', category: 'Geral', unit: 'un', cost_price: 0, sell_price: 0, stock_quantity: 0, min_stock: 0, supplier_id: '' });

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, supRes] = await Promise.all([
      db.from('products').select('*').eq('active', true).order('name'),
      db.from('suppliers').select('id, name').eq('active', true).order('name'),
    ]);
    setProducts(prodRes.data || []);
    setSuppliers(supRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: '⚠️ Nome obrigatório', variant: 'destructive' }); return; }
    const payload = { ...form, supplier_id: form.supplier_id || null };
    if (editingId) {
      await db.from('products').update(payload).eq('id', editingId);
      toast({ title: '✅ Produto atualizado' });
    } else {
      await db.from('products').insert(payload);
      toast({ title: '✅ Produto cadastrado' });
    }
    setShowForm(false);
    setEditingId(null);
    fetchData();
  };

  const handleEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description || '', sku: p.sku || '', category: p.category, unit: p.unit, cost_price: p.cost_price, sell_price: p.sell_price, stock_quantity: p.stock_quantity, min_stock: p.min_stock, supplier_id: p.supplier_id || '' });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await db.from('products').update({ active: false }).eq('id', id);
    toast({ title: '🗑️ Produto removido' });
    fetchData();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.stock_quantity <= p.min_stock).length;

  return (
    <div className="p-4 sm:p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] relative w-full pt-16">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-amber-500" />
            Produtos & Estoque
          </h1>
          <p className="text-gray-500 mt-1">Controle de materiais e inventário</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', sku: '', category: 'Geral', unit: 'un', cost_price: 0, sell_price: 0, stock_quantity: 0, min_stock: 0, supplier_id: '' }); }} className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-amber-700 flex items-center gap-2 shadow-lg shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-5 h-5" /> Novo Produto
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-lg text-white">
          <p className="text-xs text-amber-500/80 uppercase font-bold">Total Produtos</p>
          <p className="text-2xl font-black mt-1">{products.length}</p>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 shadow-lg text-white">
          <p className="text-xs text-amber-500/80 uppercase font-bold">Valor em Estoque</p>
          <p className="text-2xl font-black text-green-400 mt-1">R$ {products.reduce((s, p) => s + p.cost_price * p.stock_quantity, 0).toLocaleString('pt-BR')}</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-lg border border-white/10 ${lowStock > 0 ? 'bg-red-950/20 border-red-500/30' : 'bg-[#111111]'} text-white`}>
          <p className="text-xs text-amber-500/80 uppercase font-bold flex items-center gap-1">{lowStock > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />} Estoque Baixo</p>
          <p className={`text-2xl font-black mt-1 ${lowStock > 0 ? 'text-red-400' : 'text-white'}`}>{lowStock} itens</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto ou SKU..." className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500" />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#111111] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 text-white">
          <h3 className="font-bold text-lg text-amber-500">{editingId ? 'Editar' : 'Novo'} Produto</h3>
          <div className="grid grid-cols-3 gap-4">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome *" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="SKU / Código" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option>Geral</option><option>MDF</option><option>MDP</option><option>Ferragens</option><option>Vidros</option><option>Pedras</option><option>Tintas</option><option>Acessórios</option><option>Puxadores</option>
            </select>
            <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: +e.target.value })} placeholder="Preço Custo" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <input type="number" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: +e.target.value })} placeholder="Preço Venda" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option value="un">Unidade</option><option value="m">Metro</option><option value="m²">m²</option><option value="kg">Kg</option><option value="L">Litro</option><option value="chapa">Chapa</option>
            </select>
            <input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: +e.target.value })} placeholder="Qtd Estoque" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: +e.target.value })} placeholder="Estoque Mínimo" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              <option value="">Sem fornecedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" rows={2} />
          <div className="flex gap-3">
            <button onClick={handleSave} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700">Salvar</button>
            <button onClick={() => setShowForm(false)} className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-[#1a1a1a] border-b border-white/10">
            <tr>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Produto</th>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Categoria</th>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Preço Custo</th>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Preço Venda</th>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Estoque</th>
              <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${p.stock_quantity <= p.min_stock ? 'bg-red-950/10' : ''}`}>
                <td className="p-4">
                  <p className="font-bold text-white">{p.name}</p>
                  {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                </td>
                <td className="p-4"><span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold">{p.category}</span></td>
                <td className="p-4 text-gray-300">R$ {p.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4 font-bold text-amber-400">R$ {p.sell_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4">
                  <span className={`font-bold ${p.stock_quantity <= p.min_stock ? 'text-red-400' : 'text-green-400'}`}>
                    {p.stock_quantity} {p.unit}
                  </span>
                  {p.stock_quantity <= p.min_stock && <AlertTriangle className="w-4 h-4 text-red-500 inline ml-2" />}
                </td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => handleEdit(p)} className="w-9 h-9 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-all"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="w-9 h-9 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">{loading ? 'Carregando...' : 'Nenhum produto encontrado'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsPage;
