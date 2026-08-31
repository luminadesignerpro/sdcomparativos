import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Plus, Trash2, Loader2 } from 'lucide-react';

const db = supabase as any;

interface Tool {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  notes: string | null;
}

export default function ToolInventory({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const [tools, setTools] = useState<Tool[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTools();
  }, [employeeId]);

  const fetchTools = async () => {
    const { data } = await db
      .from('tool_inventory')
      .select('*')
      .eq('employee_id', employeeId)
      .order('name');
    if (data) setTools(data);
  };

  const addTool = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await db.from('tool_inventory').insert({
      employee_id: employeeId,
      name: name.trim(),
      quantity: parseInt(quantity) || 1,
      condition,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🔧 Ferramenta adicionada!' });
      setName(''); setQuantity('1'); setCondition('good'); setNotes(''); setShowAdd(false);
      fetchTools();
    }
  };

  const removeTool = async (id: string) => {
    await db.from('tool_inventory').delete().eq('id', id);
    toast({ title: '🗑️ Ferramenta removida' });
    fetchTools();
  };

  const conditionLabel: Record<string, string> = {
    good: '✅ Bom',
    fair: '⚠️ Regular',
    poor: '❌ Ruim',
  };

  const conditionColor: Record<string, string> = {
    good: 'bg-green-100 text-green-700',
    fair: 'bg-amber-100 text-amber-700',
    poor: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-500" /> Minhas Ferramentas
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-bold text-xs hover:bg-amber-600 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> {showAdd ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome da ferramenta"
            className="w-full p-3 rounded-lg border border-amber-200 bg-white text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase">Qtd</label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full p-3 rounded-lg border border-amber-200 bg-white text-sm mt-1"
                min="1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase">Estado</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="w-full p-3 rounded-lg border border-amber-200 bg-white text-sm mt-1"
              >
                <option value="good">Bom</option>
                <option value="fair">Regular</option>
                <option value="poor">Ruim</option>
              </select>
            </div>
          </div>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full p-3 rounded-lg border border-amber-200 bg-white text-sm"
          />
          <button
            onClick={addTool}
            disabled={saving || !name.trim()}
            className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar Ferramenta
          </button>
        </div>
      )}

      <div className="space-y-2">
        {tools.map(tool => (
          <div key={tool.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
            <div className="flex items-center gap-3">
              <Wrench className="w-4 h-4 text-gray-400" />
              <div>
                <span className="font-bold text-gray-900">{tool.name}</span>
                <span className="text-gray-500 ml-2">×{tool.quantity}</span>
                {tool.notes && <p className="text-xs text-gray-400">{tool.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${conditionColor[tool.condition] || conditionColor.good}`}>
                {conditionLabel[tool.condition] || tool.condition}
              </span>
              <button onClick={() => removeTool(tool.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {tools.length === 0 && !showAdd && (
          <p className="text-center text-gray-400 py-4 text-sm">Nenhuma ferramenta cadastrada</p>
        )}
      </div>
    </div>
  );
}
