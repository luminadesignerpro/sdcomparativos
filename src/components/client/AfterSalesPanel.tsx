import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, Wrench, Send, 
  Droplets, Sun, ThermometerSun, AlertTriangle, 
  CheckCircle, Upload, MessageCircle
} from 'lucide-react';

const CONSERVATION_TIPS = [
  {
    icon: <Droplets className="w-5 h-5 text-blue-400" />,
    title: 'Limpeza do MDF',
    desc: 'Use pano úmido com detergente neutro. Nunca use produtos abrasivos, álcool ou água em excesso.',
  },
  {
    icon: <Sun className="w-5 h-5 text-amber-500" />,
    title: 'Exposição Solar',
    desc: 'Evite exposição direta ao sol. Isso pode causar descoloração ao longo do tempo.',
  },
  {
    icon: <ThermometerSun className="w-5 h-5 text-red-400" />,
    title: 'Temperatura e Umidade',
    desc: 'Mantenha o ambiente ventilado. Umidade excessiva pode causar inchaço no MDF.',
  },
  {
    icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
    title: 'Peso nas Prateleiras',
    desc: 'Respeite a capacidade de carga para evitar empenamento das peças.',
  },
];

interface AfterSalesPanelProps { userName?: string; }

const AfterSalesPanel: React.FC<AfterSalesPanelProps> = ({ userName = 'Cliente' }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'manual' | 'service'>('manual');
  const [loading, setLoading] = useState(false);
  const [serviceForm, setServiceForm] = useState({ subject: '', description: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitService = async () => {
    if (!serviceForm.subject || !serviceForm.description) {
      toast({ title: "⚠️ Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('assistance_tickets').insert({
      client_name: userName,
      subject: serviceForm.subject,
      description: serviceForm.description,
      status: 'pendente'
    });

    setLoading(false);

    if (error) {
      toast({ title: "❌ Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
      toast({ 
        title: "✅ Chamado Aberto!", 
        description: `Protocolo gerado com sucesso. Responderemos em breve.` 
      });
    }
  };

  const tabBtn = (t: 'manual' | 'service') => `px-6 py-3 rounded-xl font-bold text-sm transition-all border ${
    activeTab === t 
      ? 'border-amber-500/50 text-black shadow-lg shadow-amber-500/10' 
      : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'
  }`;

  return (
    <div className="p-8 space-y-6 overflow-auto h-full bg-[#0a0a0a] text-white">
      <header>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-amber-500" />
          Pós-Venda SD
        </h1>
        <p className="text-white/40 mt-1 font-bold uppercase text-[10px] tracking-widest">Conservação & Assistência</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('manual')}
          className={tabBtn('manual')}
          style={activeTab === 'manual' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Manual de Conservação
        </button>
        <button
          onClick={() => setActiveTab('service')}
          className={tabBtn('service')}
          style={activeTab === 'service' ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)' } : {}}
        >
          <Wrench className="w-4 h-4 inline mr-2" />
          Solicitar Assistência
        </button>
      </div>

      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Warranty Card */}
          <div className="bg-gradient-to-r from-green-950/40 to-emerald-950/40 border border-green-500/20 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-black text-green-400">Garantia Ativa — 5 Anos</h3>
            </div>
            <p className="text-white/60 text-sm">
              Sua garantia está plenamente ativa. Em caso de qualquer imprevisto, nossa equipe técnica está à disposição.
            </p>
          </div>

          {/* Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONSERVATION_TIPS.map((tip, i) => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-amber-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white/5 rounded-lg group-hover:bg-amber-500/10 transition-colors">
                    {tip.icon}
                  </div>
                  <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">{tip.title}</h3>
                </div>
                <p className="text-sm text-white/40 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'service' && (
        <div className="max-w-2xl">
          {submitted ? (
            <div className="bg-white/5 border border-green-500/20 rounded-3xl p-12 text-center">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-white mb-2">Chamado Aberto!</h2>
              <p className="text-white/40 mb-8">Nossa equipe analisará sua solicitação e retornará em breve.</p>
              <button
                onClick={() => { setSubmitted(false); setServiceForm({ subject: '', description: '' }); }}
                className="text-amber-500 font-bold hover:underline"
              >
                Abrir novo chamado
              </button>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-amber-500" />
                Abrir Assistência Técnica
              </h3>

              <div>
                <label className="text-[10px] font-black uppercase text-white/40 block mb-2 tracking-widest">Assunto</label>
                <select
                  value={serviceForm.subject}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full h-12 bg-black border border-white/10 rounded-xl px-4 text-white focus:border-amber-500 outline-none transition-all"
                >
                  <option value="">Selecione o problema...</option>
                  <option value="porta_desalinhada">Porta desalinhada</option>
                  <option value="gaveta_travando">Gaveta travando</option>
                  <option value="defeito_acabamento">Defeito no acabamento</option>
                  <option value="ferragem_quebrada">Ferragem quebrada</option>
                  <option value="outro">Outro problema</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-white/40 block mb-2 tracking-widest">Detalhes do problema</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o que está acontecendo..."
                  className="w-full h-32 bg-black border border-white/10 rounded-xl p-4 text-white resize-none focus:border-amber-500 outline-none transition-all"
                />
              </div>

              <button
                onClick={handleSubmitService}
                disabled={loading}
                className="w-full text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-600/10 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
              >
                {loading ? 'Enviando...' : 'Enviar Chamado Premium'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AfterSalesPanel;
