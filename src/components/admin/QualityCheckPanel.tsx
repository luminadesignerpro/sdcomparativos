import React, { useState, useEffect } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, CheckCircle, XCircle, Plus, AlertTriangle } from 'lucide-react';

interface QualityCheckPanelProps {
  projectId: string;
  projectName: string;
}

const DEFAULT_ITEMS = [
  'Superfícies sem riscos ou danos',
  'Furação completa e alinhada',
  'Ferragens instaladas corretamente',
  'Acabamento de bordas uniforme',
  'Portas e gavetas funcionando',
  'Medidas conferidas com projeto',
  'Embalagem adequada para transporte',
  'Puxadores e acessórios inclusos',
];

export default function QualityCheckPanel({ projectId, projectName }: QualityCheckPanelProps) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');

  useEffect(() => {
    fetchChecklist();
  }, [projectId]);

  const fetchChecklist = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quality_checklists')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setChecklist(data);
      setNotes(data.notes || '');
      setInspectorName(data.inspector_name || '');
      const { data: checkItems } = await supabase
        .from('quality_check_items')
        .select('*')
        .eq('checklist_id', data.id)
        .order('sort_order');
      if (checkItems) setItems(checkItems);
    }
    setLoading(false);
  };

  const createChecklist = async () => {
    const { data: cl, error } = await supabase
      .from('quality_checklists')
      .insert({ project_id: projectId, inspector_name: inspectorName || null })
      .select()
      .single();
    if (error || !cl) return;

    const checkItems = DEFAULT_ITEMS.map((label, i) => ({
      checklist_id: cl.id,
      label,
      checked: false,
      sort_order: i,
    }));
    await supabase.from('quality_check_items').insert(checkItems);
    toast({ title: '✅ Checklist criado!' });
    fetchChecklist();
  };

  const toggleItem = async (item: any) => {
    await supabase.from('quality_check_items').update({ checked: !item.checked }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
  };

  const finalizeChecklist = async () => {
    if (!checklist) return;
    const unchecked = items.filter(i => !i.checked);
    if (unchecked.length > 0) {
      toast({ title: '⚠️ Itens pendentes', description: `${unchecked.length} item(ns) não conferido(s)`, variant: 'destructive' });
      return;
    }
    await supabase.from('quality_checklists').update({
      status: 'Aprovado',
      notes,
      inspector_name: inspectorName,
      completed_at: new Date().toISOString(),
    }).eq('id', checklist.id);
    toast({ title: '✅ Qualidade aprovada!', description: 'Móvel liberado para entrega.' });
    fetchChecklist();
  };

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-green-500" />
          Controle de Qualidade — {projectName}
        </h2>
        {checklist?.status === 'Aprovado' && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold text-sm flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Aprovado
          </span>
        )}
      </div>

      {!checklist ? (
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhuma inspeção realizada para este projeto.</p>
          <input
            value={inspectorName}
            onChange={e => setInspectorName(e.target.value)}
            placeholder="Nome do inspetor"
            className="p-3 border rounded-xl text-sm mb-3 w-64"
          />
          <br />
          <button
            onClick={createChecklist}
            className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Iniciar Inspeção
          </button>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">Progresso da Inspeção</p>
              <span className="text-sm font-bold text-gray-500">{checkedCount}/{items.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${checkedCount === items.length ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${items.length > 0 ? (checkedCount / items.length * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl p-6 shadow-lg space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => checklist.status !== 'Aprovado' && toggleItem(item)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl text-left text-sm transition-all ${
                  item.checked ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                } ${checklist.status === 'Aprovado' ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                  item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                }`}>
                  {item.checked && '✓'}
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Notes & Finalize */}
          {checklist.status !== 'Aprovado' && (
            <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações da inspeção (opcional)..."
                className="w-full p-3 border rounded-xl text-sm resize-none h-20"
              />
              <button
                onClick={finalizeChecklist}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" /> Aprovar e Liberar para Entrega
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
