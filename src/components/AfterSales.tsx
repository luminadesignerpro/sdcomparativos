import React, { useState } from 'react';
import {
  BookOpen, Star, MessageCircle, Phone, Calendar, CheckCircle,
  Clock, AlertCircle, Plus, Wrench, Shield, Heart, ThumbsUp,
  ChevronRight, Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ServiceRequest {
  id: string;
  type: string;
  description: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

const SERVICE_REQUESTS: ServiceRequest[] = [
  { id: '1', type: 'Ajuste de Porta', description: 'Porta do armário superior desalinhada', date: '20/02/2026', status: 'in_progress', priority: 'medium' },
  { id: '2', type: 'Troca de Puxador', description: 'Puxador da gaveta 3 com defeito', date: '15/02/2026', status: 'completed', priority: 'low' },
  { id: '3', type: 'Revisão Geral', description: 'Revisão de 6 meses agendada', date: '28/02/2026', status: 'pending', priority: 'low' },
];

const TIPS = [
  { icon: '🧹', title: 'Limpeza dos Móveis', desc: 'Use pano úmido com sabão neutro. Evite produtos abrasivos ou esponjas de aço.' },
  { icon: '💧', title: 'Cuidado com Umidade', desc: 'Seque imediatamente qualquer respingo de água nos módulos de MDF.' },
  { icon: '🔧', title: 'Regulagem de Dobradiças', desc: 'As dobradiças possuem 3 parafusos de regulagem. Consulte-nos se precisar de ajuda.' },
  { icon: '🛡️', title: 'Garantia SD', desc: 'Sua garantia cobre defeitos de fabricação por 5 anos. Guarde o certificado.' },
];

const AfterSales: React.FC = () => {
  const { toast } = useToast();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [newRequestType, setNewRequestType] = useState('');
  const [newRequestDesc, setNewRequestDesc] = useState('');

  const statusInfo: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏳ Aguardando' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: '🔧 Em Andamento' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Concluído' },
  };

  const handleNewRequest = () => {
    if (!newRequestType || !newRequestDesc) {
      toast({ title: '⚠️ Preencha todos os campos', variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Solicitação Enviada!', description: 'Nossa equipe entrará em contato em até 24h.' });
    setShowNewRequest(false);
    setNewRequestType('');
    setNewRequestDesc('');
  };

  return (
    <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-amber-500" /> Pós-Venda SD
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Cuidamos do seu projeto mesmo após a entrega</p>
        </div>
        <button onClick={() => setShowNewRequest(!showNewRequest)} className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-colors flex items-center gap-2 shadow-lg">
          <Plus className="w-5 h-5" /> Nova Solicitação
        </button>
      </header>

      {/* New Request Form */}
      {showNewRequest && (
        <div className="bg-white rounded-3xl p-8 shadow-xl mb-8 border-2 border-amber-200">
          <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-500" /> Nova Solicitação de Serviço</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-bold text-gray-600 block mb-2">Tipo de Serviço</label>
              <select value={newRequestType} onChange={(e) => setNewRequestType(e.target.value)} className="w-full h-12 bg-gray-50 rounded-xl px-4 border border-gray-200 outline-none">
                <option value="">Selecione...</option>
                <option value="Ajuste">Ajuste de Móvel</option>
                <option value="Troca">Troca de Peça</option>
                <option value="Revisão">Revisão Geral</option>
                <option value="Garantia">Chamado de Garantia</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600 block mb-2">Prioridade</label>
              <select className="w-full h-12 bg-gray-50 rounded-xl px-4 border border-gray-200 outline-none">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-600 block mb-2">Descrição</label>
            <textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} placeholder="Descreva o problema ou solicitação..." className="w-full h-24 bg-gray-50 rounded-xl p-4 border border-gray-200 outline-none resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleNewRequest} className="bg-amber-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors flex items-center gap-2">
              <Send className="w-4 h-4" /> Enviar Solicitação
            </button>
            <button onClick={() => setShowNewRequest(false)} className="bg-gray-100 text-gray-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Service Requests */}
        <div className="col-span-2 bg-white rounded-3xl p-6 shadow-xl">
          <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-500" /> Minhas Solicitações</h3>
          <div className="space-y-4">
            {SERVICE_REQUESTS.map(req => (
              <div key={req.id} className="bg-gray-50 rounded-2xl p-5 border hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">{req.type}</p>
                    <p className="text-sm text-gray-500 mt-1">{req.description}</p>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Calendar className="w-3 h-3" /> {req.date}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo[req.status].bg} ${statusInfo[req.status].text}`}>
                    {statusInfo[req.status].label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-xl text-center">
            <h3 className="font-black text-gray-900 mb-4 flex items-center justify-center gap-2"><Star className="w-5 h-5 text-amber-500" /> Avaliação</h3>
            <p className="text-sm text-gray-500 mb-4">Como foi sua experiência com a SD Móveis?</p>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => { setSatisfaction(n); toast({ title: `⭐ Obrigado! Avaliação: ${n}/5` }); }} className={`w-12 h-12 rounded-xl text-2xl transition-all hover:scale-110 ${satisfaction && satisfaction >= n ? 'bg-amber-100 scale-110' : 'bg-gray-100'}`}>
                  {satisfaction && satisfaction >= n ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {satisfaction && (
              <p className="text-sm text-green-600 font-bold flex items-center justify-center gap-1"><ThumbsUp className="w-4 h-4" /> Obrigado pelo feedback!</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white">
            <h3 className="font-black mb-3 flex items-center gap-2"><Phone className="w-5 h-5 text-amber-400" /> Suporte Direto</h3>
            <p className="text-gray-400 text-sm mb-4">Precisa de ajuda imediata?</p>
            <button className="w-full bg-green-600 py-3 rounded-xl font-bold hover:bg-green-500 transition-colors flex items-center justify-center gap-2">
              <MessageCircle className="w-5 h-5" /> WhatsApp Suporte
            </button>
            <p className="text-center text-gray-500 text-xs mt-2">Resposta em até 2h</p>
          </div>
        </div>
      </div>

      {/* Maintenance Tips */}
      <div className="bg-white rounded-3xl p-6 shadow-xl">
        <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Dicas de Conservação</h3>
        <div className="grid grid-cols-4 gap-4">
          {TIPS.map((tip, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-5 text-center border hover:shadow-md transition-shadow">
              <span className="text-4xl block mb-3">{tip.icon}</span>
              <p className="font-bold text-gray-900 text-sm mb-2">{tip.title}</p>
              <p className="text-xs text-gray-500">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AfterSales;
