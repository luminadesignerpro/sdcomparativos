import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User, Trash2, Camera, 
  Layers, Scissors, Check, Copy, RefreshCw, 
  HelpCircle, Lightbulb, Zap, FileText, ChevronRight,
  TrendingDown, ShoppingCart, MessageSquare, Download, Brain
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeTextWithGroq, analyzeImageWithGemini } from '@/services/geminiService';

export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  images?: string[];
  suggestedPieces?: Array<{
    name: string;
    material: string;
    length: number;
    width: number;
    quantity: number;
  }>;
}

interface ClaudeAIModuleProps {
  activeFolderName?: string;
  activeFolderId?: string;
  onNavigateToCuttingPlan?: () => void;
}

const CLAUDE_QUICK_PROMPTS = [
  {
    icon: '🪵',
    title: 'Orçamento Completo de Cozinha',
    prompt: 'Monte o orçamento completo de uma cozinha planejada em L com 3,20m x 1,80m, incluindo: gabinete pia, gabinete cooktop, aéreos, tamponamento, rodapés e lista de ferragens necessárias. Use MDF 15mm Branco TX.'
  },
  {
    icon: '📏',
    title: 'Fórmula de Gavetas com Corrediça',
    prompt: 'Qual a fórmula exata para calcular a largura das laterais de gaveta usando corrediça telescópica e corrediça oculta (soft close)? Considere um vão livre de 600mm de largura.'
  },
  {
    icon: '🔩',
    title: 'Lista de Ferragens por Módulo',
    prompt: 'Liste todas as ferragens necessárias (dobradiças, corrediças, puxadores, parafusos, cavilhas, minifix) para montar: 1 guarda-roupa 3 portas, 1 cômoda 4 gavetas e 1 sapateira. Com quantidades exatas.'
  },
  {
    icon: '📊',
    title: 'Comparar Fornecedores MDF',
    prompt: 'Compare as principais marcas de MDF disponíveis no Brasil (Duratex/Arauco, Berneck, Eucatex, Fibraplac) em termos de qualidade, preço médio e disponibilidade. Qual a melhor relação custo-benefício para marcenaria?'
  }
];

export const ClaudeAIModule: React.FC<ClaudeAIModuleProps> = ({
  activeFolderName = 'DAVI',
  activeFolderId,
  onNavigateToCuttingPlan
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ClaudeMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`sd_claude_chat_${activeFolderId || 'global'}`);
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome',
          role: 'assistant',
          content: `🧠 Olá! Sou o **SD Claude Opus 4.6**, sua inteligência artificial de elite para Marcenaria Profissional e Otimização de Projetos.\n\n🔮 **Minhas especialidades:**\n- 📐 **Orçamentos detalhados** com lista de materiais, ferragens e fitas de borda completas.\n- 🪵 **Cálculos de corte avançados**: folgas de gavetas, embutidos, dobradiças 35mm e corrediças.\n- 📸 **Leitura visual** de projetos, rascunhos e notas fiscais com precisão.\n- 🔩 **Consultoria de ferragens** — quantidades, tipos e especificações técnicas.\n- 💰 **Análise de custo** e comparativo entre fornecedores.\n\n⚡ Pergunte qualquer coisa sobre seus projetos! Sem login, sem conta, 100% direto.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } catch {
      return [];
    }
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`sd_claude_chat_${activeFolderId || 'global'}`, JSON.stringify(messages));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFolderId]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputPrompt).trim();
    if (!text && !selectedImage) return;

    const userMsg: ClaudeMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      images: selectedImage ? [selectedImage] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    const curImg = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let aiResponseText = '';

      const systemInstruction = `Você é o "SD Claude Opus 4.6", um assistente de inteligência artificial de elite integrado ao sistema SDcomparativo para marcenaria profissional e móveis planejados.

Diretrizes obrigatórias:
1. Responda SEMPRE em Português do Brasil de forma clara, técnica e profissional.
2. Use formatação com **negrito**, *itálico* e listas organizadas para facilitar a leitura.
3. Quando o usuário pedir cálculo ou lista de peças de móvel, forneça SEMPRE a lista detalhada com:
   - Nome da peça
   - Comprimento (mm)
   - Largura (mm) 
   - Quantidade
   - Material sugerido
4. Se gerar lista de peças cortadas, inclua no final da resposta um bloco JSON:
\`\`\`json
{
  "pieces": [
    { "name": "Lateral", "material": "MDF BRANCO TX 15", "length": 2100, "width": 550, "quantity": 2 }
  ]
}
\`\`\`
5. Para ferragens, especifique modelo, quantidade e marca quando possível.
6. Seja preciso nas fórmulas de cálculo (folgas de gaveta, vão de porta, embutidos).
7. Priorize a economia e otimização de materiais nas suas recomendações.`;

      if (curImg) {
        aiResponseText = await analyzeImageWithGemini(
          curImg, 
          `${systemInstruction}\n\nPergunta do usuário: ${text || 'Analise esta imagem de projeto/cotação de marcenaria e extraia todas as medidas, materiais e informações relevantes de forma organizada.'}`
        );
      } else {
        aiResponseText = await analyzeTextWithGroq(text, systemInstruction);
      }

      // Detectar peças sugeridas para importação ao plano de corte
      let extractedPieces: any[] | undefined = undefined;
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/) || aiResponseText.match(/\{[\s\S]*"pieces"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (Array.isArray(parsed.pieces) && parsed.pieces.length > 0) {
            extractedPieces = parsed.pieces;
          }
        } catch {}
      }

      const assistantMsg: ClaudeMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponseText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        suggestedPieces: extractedPieces
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Erro na resposta da IA:', err);
      const errorMsg: ClaudeMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Não foi possível processar a resposta: ${err.message || 'Verifique sua conexão de internet e tente novamente.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      toast({ title: 'Erro na comunicação com a IA', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      toast({ title: '📸 Imagem carregada para análise visual!' });
    };
    reader.readAsDataURL(file);
  };

  const handleClearHistory = () => {
    if (confirm('Limpar todo o histórico de conversas do Claude Opus 4.6?')) {
      const resetMsg: ClaudeMessage[] = [{
        id: Date.now().toString(),
        role: 'assistant',
        content: '🧹 Histórico limpo! Como posso te ajudar agora com seus projetos de marcenaria?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }];
      setMessages(resetMsg);
      localStorage.removeItem(`sd_claude_chat_${activeFolderId || 'global'}`);
      toast({ title: 'Histórico do Claude resetado!' });
    }
  };

  const handleAddPiecesToCuttingPlan = (piecesToAdd: Array<{ name: string; material: string; length: number; width: number; quantity: number }>) => {
    try {
      const key = `sd_cutting_pieces_${activeFolderId || 'default'}`;
      const saved = localStorage.getItem(key);
      const currentPieces = saved ? JSON.parse(saved) : [];

      const formattedNew = piecesToAdd.map(p => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        name: p.name || 'Peça Claude IA',
        material: p.material || 'MDF BRANCO TX 15',
        length: Number(p.length) || 700,
        width: Number(p.width) || 450,
        quantity: Number(p.quantity) || 1,
        rotateAllowed: true,
        edgeBanding: { top: true, bottom: false, left: false, right: false }
      }));

      localStorage.setItem(key, JSON.stringify([...formattedNew, ...currentPieces]));
      toast({ 
        title: `🚀 ${piecesToAdd.length} peças importadas para o Plano de Corte!`, 
        description: 'Vá para a aba "Plano de Corte" para otimizar e visualizar as chapas.' 
      });
      if (onNavigateToCuttingPlan) onNavigateToCuttingPlan();
    } catch {
      toast({ title: 'Erro ao importar peças', variant: 'destructive' });
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: '📋 Texto copiado!' });
  };

  return (
    <div className="space-y-4">
      {/* CABEÇALHO CLAUDE OPUS 4.6 */}
      <div className="bg-gradient-to-r from-[#1a1428] via-[#14101d] to-[#1a1428] border-2 border-orange-500/40 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-500 border border-orange-300/50 flex items-center justify-center text-white shadow-[0_0_25px_rgba(249,115,22,0.5)] shrink-0">
            <Brain className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                <span>SD Claude Opus 4.6</span>
                <span className="bg-orange-500/20 text-orange-300 border border-orange-400/40 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Opus Pro v4.6
                </span>
              </h2>
              <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" /> Sem Login • Apenas WiFi
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              IA de Elite para Marcenaria: orçamentos, ferragens, cálculos de corte, análise visual e estratégia de economia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="bg-[#0b0e14] border border-orange-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-orange-300 font-bold">
            <Brain className="w-4 h-4 text-orange-400" />
            <span>Claude Opus 4.6 • Raciocínio Avançado</span>
          </div>
          <button
            onClick={handleClearHistory}
            className="bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Limpar histórico"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Chat</span>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* COLUNA ESQUERDA: PROMPTS RÁPIDOS */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-[#10131a] border border-white/10 p-4 rounded-2xl shadow-lg space-y-3">
            <h3 className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-orange-400" /> Prompts Rápidos
            </h3>
            <p className="text-[11px] text-gray-400">
              Clique para perguntar diretamente ao Claude:
            </p>
            <div className="space-y-2">
              {CLAUDE_QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="w-full text-left bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/40 p-2.5 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-orange-300">
                    <span>{qp.icon}</span>
                    <span>{qp.title}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {qp.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Card Integração Plano de Corte */}
          <div className="bg-gradient-to-br from-amber-500/15 via-[#181510] to-amber-500/5 border border-amber-500/30 p-4 rounded-2xl space-y-2 text-xs">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-amber-400" /> Integração com Plano de Corte
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Peça ao Claude: <i>"Monte as peças de uma cozinha completa em L"</i> e envie direto para o Plano de Corte 2D com 1 clique!
            </p>
          </div>
        </div>

        {/* COLUNA DIREITA: CHAT */}
        <div className="lg:col-span-3 bg-[#0d0f14] border border-orange-500/30 rounded-3xl p-4 sm:p-5 flex flex-col h-[650px] shadow-2xl">
          
          {/* MENSAGENS */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in duration-150`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser 
                      ? 'bg-amber-500 text-black font-black text-xs' 
                      : 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 shadow-lg ${
                    isUser
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black font-medium'
                      : 'bg-[#151922] border border-orange-500/15 text-gray-100'
                  }`}>
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Anexo" className="w-24 h-24 object-cover rounded-xl border border-black/20" />
                        ))}
                      </div>
                    )}

                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>

                    {/* Botão Copiar (apenas para respostas do assistente) */}
                    {!isUser && m.id !== 'welcome' && (
                      <button
                        onClick={() => handleCopyMessage(m.content)}
                        className="text-[10px] text-gray-500 hover:text-orange-400 flex items-center gap-1 transition-colors mt-1"
                      >
                        <Copy className="w-3 h-3" /> Copiar resposta
                      </button>
                    )}

                    {/* Inserir Peças no Plano de Corte */}
                    {m.suggestedPieces && m.suggestedPieces.length > 0 && (
                      <div className="pt-3 mt-2 border-t border-white/10 bg-black/20 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" /> {m.suggestedPieces.length} Peças Prontas para Corte
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddPiecesToCuttingPlan(m.suggestedPieces!)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <Scissors className="w-4 h-4" />
                          <span>🚀 Inserir Peças no Plano de Corte 2D</span>
                        </button>
                      </div>
                    )}

                    <div className={`text-[9px] text-right font-mono ${isUser ? 'text-black/60 font-bold' : 'text-gray-500'}`}>
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-orange-600/30 text-orange-400 flex items-center justify-center">
                  <Brain className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-[#151922] border border-orange-500/30 rounded-2xl px-4 py-2.5 text-xs text-orange-300 font-bold flex items-center gap-2 shadow-md">
                  <span>Claude Opus 4.6 raciocínando e processando...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* PREVIEW IMAGEM */}
          {selectedImage && (
            <div className="flex items-center gap-2 p-2 bg-[#161a24] border border-orange-500/40 rounded-xl mb-2">
              <img src={selectedImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/20" />
              <div className="flex-1 text-xs text-gray-300 truncate font-mono">📸 Imagem Anexada</div>
              <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-white p-1">✕</button>
            </div>
          )}

          {/* INPUT BAR */}
          <div className="pt-3 border-t border-white/10">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 bg-white/5 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/40 text-gray-300 hover:text-orange-300 rounded-2xl flex items-center justify-center transition-all shrink-0"
                title="Anexar imagem de projeto / cotação"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Pergunte ao Claude Opus 4.6: ex: 'Orçe uma cozinha em L completa' ou 'Calcule folga de gaveta 600mm'..."
                disabled={isLoading}
                className="flex-1 bg-[#151922] border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputPrompt.trim() && !selectedImage)}
                className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-950/50 transition-all hover:scale-105 active:scale-95 shrink-0"
                title="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
