import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  User, 
  TrendingUp, 
  MessageSquare, 
  Zap, 
  PhoneCall,
  Flame,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Negotiation {
  id: string;
  contact_name: string;
  status: 'active' | 'closed' | 'lost';
  interest_score: number; // 0-100
  ai_summary: string;
  last_message: string;
  created_at: string;
  phone: string;
}

const AINegotiationDashboard: React.FC = () => {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchNegotiations();
    
    // Realtime subscription for new messages
    const channel = supabase
      .channel('public:whatsapp_conversations')
      .on('postgres_changes', { event: '*', table: 'whatsapp_conversations' }, () => {
        fetchNegotiations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNegotiations = async () => {
    try {
      setLoading(true);
      // Simulating fetching negotiations from conversations + AI summaries
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Map to our Negotiation interface using real database fields
      const mapped: Negotiation[] = (data || []).map(conv => ({
        id: conv.id,
        contact_name: conv.contact_name || 'Visitante',
        status: conv.status || 'active',
        interest_score: conv.lead_score || 0,
        ai_summary: conv.ai_summary || "Buscando informações...",
        last_message: conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'Iniciando conversa...',
        created_at: conv.created_at,
        phone: conv.phone_number || ''
      }));

      setNegotiations(mapped);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return 'text-red-500';
    if (score > 50) return 'text-amber-500';
    return 'text-blue-500';
  };

  return (
    <div className="p-6 space-y-6 bg-[#0a0a0a] min-h-screen">
      <header className="flex justify-between items-center bg-gray-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-xl relative overflow-hidden">
        <div className="z-10">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-amber-400" />
            Vendedor IA Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Acompanhe as negociações sendo feitas pelo robô em tempo real.</p>
        </div>
        <div className="flex gap-4 z-10">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-black">Conversões de Hoje</p>
            <p className="text-2xl font-black text-green-500">+12%</p>
          </div>
          <Zap className="w-10 h-10 text-amber-500 animate-pulse" />
        </div>
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900/30 border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Atendimentos Ativos</p>
          <p className="text-2xl font-black text-white">{negotiations.length}</p>
        </Card>
        <Card className="bg-gray-900/30 border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Qualificados pela IA</p>
          <p className="text-2xl font-black text-amber-500">{negotiations.filter(n => n.interest_score > 70).length}</p>
        </Card>
        <Card className="bg-gray-900/30 border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Tickets Gerados</p>
          <p className="text-2xl font-black text-blue-500">8</p>
        </Card>
        <Card className="bg-gray-900/30 border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Economia p/ Dono</p>
          <p className="text-2xl font-black text-emerald-500">~14 hrs/mês</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-gray-900/40 border-white/5 rounded-[32px] overflow-hidden">
          <CardHeader className="border-b border-white/5 px-8 py-6">
            <CardTitle className="text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" /> Negociações Quentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {negotiations.map(neg => (
                <div key={neg.id} className="p-6 hover:bg-white/5 transition-all flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold text-lg">{neg.contact_name}</h4>
                      <Badge className={neg.interest_score > 80 ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'}>
                        {neg.interest_score}% Interesse
                      </Badge>
                    </div>
                    <p className="text-gray-500 text-sm italic">"{neg.last_message}"</p>
                    <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 mt-2">
                      <p className="text-[10px] text-amber-300 uppercase font-black mb-1 flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Resumo da IA
                      </p>
                      <p className="text-gray-400 text-xs">{neg.ai_summary}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <Button variant="outline" className="bg-white/5 border-white/10 text-white rounded-xl hover:bg-white/10">
                      <MessageSquare className="w-4 h-4 mr-2" /> Ler Chat
                    </Button>
                    <Button className="bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl">
                      <PhoneCall className="w-4 h-4 mr-2" /> Assumir Conversa
                    </Button>
                    <Button variant="ghost" className="text-gray-500 hover:text-white rounded-xl">
                      <XCircle className="w-4 h-4" /> Descartar
                    </Button>
                  </div>
                </div>
              ))}
               {negotiations.length === 0 && (
                <div className="p-12 text-center flex flex-col items-center">
                  <Bot className="w-12 h-12 text-gray-600 mb-4" />
                  <p className="text-gray-600 font-bold uppercase tracking-widest mb-6">Aguardando atendimentos iniciados pelo robô...</p>
                  <Button 
                    className="bg-amber-600/10 border border-amber-600/30 text-amber-500 hover:bg-amber-600 hover:text-black transition-all"
                    onClick={async () => {
                      const mockConv = {
                        contact_name: 'Marcos Oliveira (Simulação)',
                        phone_number: '+5511999999999',
                        status: 'active',
                        lead_score: 85,
                        ai_summary: 'Cliente interessado em cozinha planejada com ilha. Já possui medidas aproximadas.',
                        last_message_at: new Date().toISOString(),
                        created_at: new Date().toISOString()
                      };
                      const { error } = await supabase.from('whatsapp_conversations').insert([mockConv]);
                      if (!error) {
                        fetchNegotiations();
                        toast({ title: "🤖 Simulação Ativada", description: "Um novo lead foi gerado para teste." });
                      }
                    }}
                  >
                    Simular Conversa de Cliente
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AINegotiationDashboard;
