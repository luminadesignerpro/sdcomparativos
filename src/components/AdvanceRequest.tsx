import React, { useState } from 'react';
import { DollarSign, Send, Clock, CheckCircle, XCircle, AlertCircle, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdvanceRequestData {
  id: string;
  date: string;
  value: number;
  reason: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  approvedBy?: string;
  responseDate?: string;
  responseNote?: string;
}

const ADVANCE_HISTORY: AdvanceRequestData[] = [
  { id: '1', date: '15/02/2026', value: 500, reason: 'Despesas médicas urgentes', status: 'aprovado', approvedBy: 'Jerffeson', responseDate: '15/02/2026', responseNote: 'Aprovado. Será descontado no próximo contracheque.' },
  { id: '2', date: '10/01/2026', value: 300, reason: 'Manutenção do veículo', status: 'aprovado', approvedBy: 'Jerffeson', responseDate: '11/01/2026', responseNote: 'Aprovado. Descontado em janeiro.' },
  { id: '3', date: '20/12/2025', value: 1000, reason: 'Despesas de fim de ano', status: 'recusado', approvedBy: 'Jerffeson', responseDate: '21/12/2025', responseNote: 'Valor excede o limite de 50% do salário. Solicite um valor menor.' },
];

interface AdvanceRequestProps {
  employeeName: string;
}

const AdvanceRequest: React.FC<AdvanceRequestProps> = ({ employeeName }) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState(ADVANCE_HISTORY);
  const [showForm, setShowForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newReason, setNewReason] = useState('');

  const handleSubmit = () => {
    if (!newValue || !newReason.trim()) {
      toast({ title: '⚠️ Preencha todos os campos', variant: 'destructive' });
      return;
    }
    const value = parseFloat(newValue);
    if (isNaN(value) || value <= 0) {
      toast({ title: '⚠️ Valor inválido', variant: 'destructive' });
      return;
    }
    if (value > 1400) {
      toast({ title: '⚠️ Limite excedido', description: 'O valor máximo do vale é 50% do salário base (R$ 1.400)', variant: 'destructive' });
      return;
    }

    const newRequest: AdvanceRequestData = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-BR'),
      value,
      reason: newReason,
      status: 'pendente',
    };
    setRequests(prev => [newRequest, ...prev]);
    setNewValue('');
    setNewReason('');
    setShowForm(false);
    toast({ title: '✅ Solicitação enviada', description: `Vale de R$ ${value.toFixed(2)} solicitado com sucesso. Aguarde a aprovação.` });
  };

  const statusConfig = {
    pendente: { icon: <Clock className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700', label: '⏳ Pendente' },
    aprovado: { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700', label: '✅ Aprovado' },
    recusado: { icon: <XCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700', label: '❌ Recusado' },
  };

  const pendingCount = requests.filter(r => r.status === 'pendente').length;
  const approvedTotal = requests.filter(r => r.status === 'aprovado').reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-amber-500" /> Solicitar Vale
          </h1>
          <p className="text-gray-500 mt-1">{employeeName} • Adiantamento salarial</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
        >
          <DollarSign className="w-5 h-5" /> Novo Vale
        </button>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Limite Disponível</p>
          <p className="text-3xl font-black text-green-600 mt-1">R$ 1.400,00</p>
          <p className="text-xs text-gray-400 mt-1">50% do salário base</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Pendentes</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-xs text-gray-400 mt-1">Aguardando aprovação</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold">Total Aprovado (últimos 3 meses)</p>
          <p className="text-3xl font-black text-gray-900 mt-1">R$ {approvedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Descontado em folha</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border-2 border-amber-200">
          <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-500" /> Nova Solicitação de Vale
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Valor (R$)</label>
              <input
                type="number"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Ex: 500"
                max={1400}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-amber-500 focus:outline-none text-lg font-bold"
              />
              <p className="text-xs text-gray-400 mt-1">Máximo: R$ 1.400,00 (50% do salário)</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Motivo</label>
              <textarea
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                placeholder="Descreva o motivo da solicitação..."
                rows={3}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:border-amber-500 focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all">
              <Send className="w-5 h-5" /> Enviar Solicitação
            </button>
            <button onClick={() => setShowForm(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-3 rounded-2xl font-bold transition-all">
              Cancelar
            </button>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">O vale será descontado integralmente no próximo contracheque. Solicitações acima de R$ 700 necessitam de aprovação do gestor.</p>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-black text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" /> Histórico de Solicitações
          </h3>
        </div>
        <div className="divide-y">
          {requests.map(req => (
            <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    req.status === 'aprovado' ? 'bg-green-100' : req.status === 'recusado' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    {statusConfig[req.status].icon}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-lg">R$ {req.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm text-gray-600 mt-1">{req.reason}</p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {req.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConfig[req.status].color}`}>
                    {statusConfig[req.status].label}
                  </span>
                  {req.responseNote && (
                    <p className="text-xs text-gray-500 mt-2 max-w-xs text-right">{req.responseNote}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdvanceRequest;
