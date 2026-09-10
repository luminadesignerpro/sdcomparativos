import React, { useState, useEffect } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Package, Clock, Truck, Calculator } from 'lucide-react';

interface ProjectCostPanelProps {
  projectId: string;
  projectName: string;
  totalValue: number;
}

interface CostItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  quantity: number;
  unit: string;
}

const CATEGORIES = ['Material', 'Mão de Obra', 'Deslocamento', 'Ferragem', 'Acabamento', 'Outro'];

export default function ProjectCostPanel({ projectId, projectName, totalValue }: ProjectCostPanelProps) {
  const { toast } = useToast();
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCost, setNewCost] = useState({ category: 'Material', description: '', amount: '', quantity: '1', unit: 'un' });
  const [laborHours, setLaborHours] = useState(0);
  const [laborRate, setLaborRate] = useState(0);

  useEffect(() => {
    fetchCosts();
    fetchLaborCost();
  }, [projectId]);

  const fetchCosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('project_costs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    if (data) setCosts(data);
    setLoading(false);
  };

  const fetchLaborCost = async () => {
    // Get project's client, find related trips for labor hours
    const { data: project } = await supabase
      .from('client_projects')
      .select('client_id')
      .eq('id', projectId)
      .maybeSingle();
    
    if (project) {
      // Get average employee rate and total trip hours
      const { data: employees } = await supabase.from('employees').select('hourly_rate').limit(10);
      if (employees && employees.length > 0) {
        const avgRate = employees.reduce((s, e) => s + Number(e.hourly_rate), 0) / employees.length;
        setLaborRate(avgRate);
      }
    }
  };

  const addCost = async () => {
    if (!newCost.description || !newCost.amount) return;
    const { error } = await supabase.from('project_costs').insert({
      project_id: projectId,
      category: newCost.category,
      description: newCost.description,
      amount: parseFloat(newCost.amount),
      quantity: parseFloat(newCost.quantity) || 1,
      unit: newCost.unit,
    });
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Custo adicionado!' });
      setNewCost({ category: 'Material', description: '', amount: '', quantity: '1', unit: 'un' });
      setShowAdd(false);
      fetchCosts();
    }
  };

  const deleteCost = async (id: string) => {
    await supabase.from('project_costs').delete().eq('id', id);
    fetchCosts();
  };

  const totalCosts = costs.reduce((s, c) => s + (Number(c.amount) * Number(c.quantity)), 0);
  const laborCost = laborHours * laborRate;
  const totalWithLabor = totalCosts + laborCost;
  const profit = totalValue - totalWithLabor;
  const margin = totalValue > 0 ? ((profit / totalValue) * 100) : 0;

  const costsByCategory = CATEGORIES.map(cat => ({
    category: cat,
    total: costs.filter(c => c.category === cat).reduce((s, c) => s + (Number(c.amount) * Number(c.quantity)), 0),
  })).filter(c => c.total > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-amber-500" />
          Custo Real — {projectName}
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Adicionar Custo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-2xl p-5 text-center">
          <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-xs text-blue-600 font-bold uppercase mb-1">Materiais + Custos</p>
          <p className="text-xl font-black text-blue-700">R$ {totalCosts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-purple-50 rounded-2xl p-5 text-center">
          <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-xs text-purple-600 font-bold uppercase mb-1">Mão de Obra</p>
          <input
            type="number"
            value={laborHours || ''}
            onChange={e => setLaborHours(parseFloat(e.target.value) || 0)}
            placeholder="Horas"
            className="w-full text-center text-lg font-black text-purple-700 bg-transparent border-b-2 border-purple-200 focus:outline-none"
          />
          <p className="text-xs text-purple-400 mt-1">× R$ {laborRate.toFixed(2)}/h = R$ {laborCost.toFixed(2)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-5 text-center">
          <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-xs text-amber-600 font-bold uppercase mb-1">Valor Vendido</p>
          <p className="text-xl font-black text-amber-700">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-2xl p-5 text-center ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          {profit >= 0 ? <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" /> : <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />}
          <p className={`text-xs font-bold uppercase mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Lucro Real</p>
          <p className={`text-xl font-black ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className={`text-xs font-bold mt-1 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            Margem: {margin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Cost Breakdown by Category */}
      {costsByCategory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-900 mb-4">Distribuição de Custos</h3>
          <div className="space-y-3">
            {costsByCategory.map(cat => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-600 w-28">{cat.category}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4">
                  <div
                    className="bg-amber-500 h-4 rounded-full transition-all"
                    style={{ width: `${totalWithLabor > 0 ? (cat.total / totalWithLabor * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-900 w-28 text-right">
                  R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Cost Form */}
      {showAdd && (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase">Categoria</label>
              <select
                value={newCost.category}
                onChange={e => setNewCost({ ...newCost, category: e.target.value })}
                className="w-full p-2 rounded-lg border border-amber-200 bg-white text-sm mt-1"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase">Descrição</label>
              <input
                value={newCost.description}
                onChange={e => setNewCost({ ...newCost, description: e.target.value })}
                placeholder="Ex: Chapa MDF 18mm"
                className="w-full p-2 rounded-lg border border-amber-200 bg-white text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase">Valor Unitário (R$)</label>
              <input
                type="number"
                value={newCost.amount}
                onChange={e => setNewCost({ ...newCost, amount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2 rounded-lg border border-amber-200 bg-white text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Qtd</label>
                <input
                  type="number"
                  value={newCost.quantity}
                  onChange={e => setNewCost({ ...newCost, quantity: e.target.value })}
                  className="w-full p-2 rounded-lg border border-amber-200 bg-white text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Unidade</label>
                <select
                  value={newCost.unit}
                  onChange={e => setNewCost({ ...newCost, unit: e.target.value })}
                  className="w-full p-2 rounded-lg border border-amber-200 bg-white text-sm mt-1"
                >
                  <option>un</option>
                  <option>m</option>
                  <option>m²</option>
                  <option>kg</option>
                  <option>L</option>
                </select>
              </div>
            </div>
          </div>
          <button
            onClick={addCost}
            className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600"
          >
            Salvar Custo
          </button>
        </div>
      )}

      {/* Cost List */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="font-bold text-gray-900 mb-4">Itens de Custo</h3>
        <div className="space-y-2 max-h-64 overflow-auto">
          {costs.map(cost => (
            <div key={cost.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">{cost.category}</span>
                <span className="text-gray-900">{cost.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{cost.quantity} {cost.unit}</span>
                <span className="font-bold text-gray-900">R$ {(Number(cost.amount) * Number(cost.quantity)).toFixed(2)}</span>
                <button onClick={() => deleteCost(cost.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {costs.length === 0 && (
            <p className="text-center text-gray-400 py-6">Nenhum custo registrado. Adicione itens acima.</p>
          )}
        </div>
      </div>
    </div>
  );
}
