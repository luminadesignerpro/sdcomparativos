import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User, Trash2, Camera, 
  Layers, Scissors, Check, Copy, RefreshCw, 
  HelpCircle, Lightbulb, Zap, FileText, ChevronRight,
  TrendingDown, ShoppingCart, MessageSquare, Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeTextWithGroq, analyzeImageWithGemini } from '@/services/geminiService';

export interface AIMessage {
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

interface GeminiAIModuleProps {
  activeFolderName?: string;
  activeFolderId?: string;
  onSendPiecesToCuttingPlan?: (pieces: Array<{ name: string; material: string; length: number; width: number; quantity: number }>) => void;
  onNavigateToCuttingPlan?: () => void;
}

const QUICK_PROMPTS = [
  {
    icon: '📐',
    title: 'Gerar Peças de Armário',
    prompt: 'Calcule e gere a lista completa de peças para um guarda-roupa de 2 portas de 2100x1200x550mm em MDF 15mm, com tampo, base, laterais, 2 portas e 3 prateleiras.'
  },
  {
    icon: '🗄️',
    title: 'Cálculo de Gavetas & Folgas',
    prompt: 'Qual o cálculo exato para fazer 4 gavetas em um vão livre de 800mm de largura por 700mm de altura usando corrediças telescópicas de 45cm?'
  },
  {
    icon: '💡',
    title: 'Dicas de Usinagem & Fita',
    prompt: 'Quais as melhores práticas para fitamento de borda em MDF e como evitar descolamento com cola PUR vs Hotmelt?'
  },
  {
    icon: '💰',
    title: 'Estratégia de Economia',
    prompt: 'Como posso otimizar o corte de chapas de MDF para reduzir o desperdício abaixo de 10% em móveis planejados?'
  }
];

export const GeminiAIModule: React.FC<GeminiAIModuleProps> = ({
  activeFolderName = 'DAVI',
  activeFolderId,
  onSendPiecesToCuttingPlan,
  onNavigateToCuttingPlan
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`sd_gemini_chat_${activeFolderId || 'global'}`);
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome',
          role: 'assistant',
          content: `👋 Olá! Sou o **SD Gemini 3.7 Flash Medium**, sua IA especialista em Marcenaria 4.0, Cálculos de MDF, Ferragens e Planos de Corte.\n\n⚡ **Como posso te ajudar hoje?**\n- 📐 **Calcular medidas e gerar listas de corte** para enviar direto ao Plano de Corte.\n- 📸 **Ler fotos, rascunhos de projetos ou notas de cotação** sem precisar digitar.\n- 🗄️ **Calcular folgas de gavetas, portas e dobradiças** com precisão milimétrica.\n- 💰 **Dicas para economizar chapas e ferragens** nos fornecedores.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } catch {
      return [];
    }
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash-medium');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`sd_gemini_chat_${activeFolderId || 'global'}`, JSON.stringify(messages));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFolderId]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputPrompt).trim();
    if (!text && !selectedImage) return;

    const userMsg: AIMessage = {
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

      const systemInstruction = `Você é o "SD Gemini 3.7 Flash Medium", o assistente de inteligência artificial de elite integrado ao sistema SDcomparativo para marcenaria e móveis planejados.
Diretrizes:
1. Responda em Português do Brasil de forma clara, técnica e profissional.
2. Quando o usuário pedir cálculo ou lista de peças de móvel (ex: armário, gaveteiro, balcão), forneça sempre a lista detalhada com Comprimento (mm), Largura (mm), Quantidade e Material sugerido (ex: MDF BRANCO TX 15 ou MDF 15 ITAPUA).
3. Se gerar peças cortadas, coloque no final da resposta um bloco JSON estruturado assim:
\`\`\`json
{
  "pieces": [
    { "name": "Lateral", "material": "MDF BRANCO TX 15", "length": 2100, "width": 550, "quantity": 2 },
    { "name": "Porta", "material": "MDF 15 ITAPUA", "length": 2000, "width": 440, "quantity": 2 }
  ]
}
\`\`\`
4. Seja direto, prático e focado na rotina do marceneiro moderno.`;

      if (curImg) {
        aiResponseText = await analyzeImageWithGemini(curImg, `${systemInstruction}\n\nPergunta do usuário: ${text || 'Analise esta imagem de projeto/cotação e extraia todas as medidas e informações relevantes.'}`);
      } else {
        aiResponseText = await analyzeTextWithGroq(text, systemInstruction);
      }

      // Detectar peças sugeridas para importação direta no plano de corte
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

      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponseText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        suggestedPieces: extractedPieces
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Erro na resposta da IA:', err);
      const errorMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Não foi possível processar a resposta no momento: ${err.message || 'Verifique sua conexão de internet e tente novamente.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      toast({ title: 'Erro de Comunicação com a IA', variant: 'destructive' });
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
    if (confirm('Deseja limpar todo o histórico de conversas da IA?')) {
      const resetMsg: AIMessage[] = [{
        id: Date.now().toString(),
        role: 'assistant',
        content: '🧹 Histórico limpo! Como posso te ajudar agora com seus projetos de marcenaria?',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }];
      setMessages(resetMsg);
      localStorage.removeItem(`sd_gemini_chat_${activeFolderId || 'global'}`);
      toast({ title: 'Histórico resetado com sucesso!' });
    }
  };

  const handleAddSuggestedPiecesToCuttingPlan = (piecesToAdd: Array<{ name: string; material: string; length: number; width: number; quantity: number }>) => {
    try {
      const key = `sd_cutting_pieces_${activeFolderId || 'default'}`;
      const saved = localStorage.getItem(key);
      const currentPieces = saved ? JSON.parse(saved) : [];

      const formattedNew = piecesToAdd.map(p => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        name: p.name || 'Peça Gerada por IA',
        material: p.material || 'MDF BRANCO TX 15',
        length: Number(p.length) || 700,
        width: Number(p.width) || 450,
        quantity: Number(p.quantity) || 1,
        rotateAllowed: true,
        edgeBanding: { top: true, bottom: false, left: false, right: false }
      }));

      const merged = [...formattedNew, ...currentPieces];
      localStorage.setItem(key, JSON.stringify(merged));

      toast({ 
        title: `🚀 ${piecesToAdd.length} peças importadas para o Plano de Corte!`, 
        description: 'Vá para a aba "Plano de Corte" para visualizar as chapas otimizadas.' 
      });

      if (onNavigateToCuttingPlan) {
        onNavigateToCuttingPlan();
      }
    } catch (err) {
      toast({ title: 'Erro ao importar peças', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO MÓDULO GEMINI 3.7 */}
      <div className="bg-gradient-to-r from-[#141824] via-[#10141d] to-[#141824] border-2 border-cyan-500/40 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-500 to-indigo-600 border border-cyan-300/50 flex items-center justify-center text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] shrink-0">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
                <span>SD Gemini 3.7 Flash</span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Medium v3.7 Pro
                </span>
              </h2>
              <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" /> Sem Login • Conexão Direta
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              IA Autônoma para Marcenaria 4.0: cálculo de corte, leitura visual de projetos, fórmulas e estratégias de economia
            </p>
          </div>
        </div>

        {/* Controles de Topo */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="bg-[#0b0e14] border border-cyan-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-cyan-300 font-bold">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>Modelo: Gemini 3.7 Flash Medium</span>
          </div>

          <button
            onClick={handleClearHistory}
            className="bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Limpar histórico de mensagens"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Chat</span>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO CHAT */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* COLUNA ESQUERDA: SUGESTÕES RÁPIDAS */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-[#10131a] border border-white/10 p-4 rounded-2xl shadow-lg space-y-3">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Prompts Rápidos de Marcenaria
            </h3>
            <p className="text-[11px] text-gray-400">
              Clique em qualquer pergunta para a IA calcular e responder na hora:
            </p>

            <div className="space-y-2">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="w-full text-left bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 p-2.5 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:text-cyan-300">
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

          {/* Card de Destaque Plano de Corte */}
          <div className="bg-gradient-to-br from-amber-500/15 via-[#181510] to-amber-500/5 border border-amber-500/30 p-4 rounded-2xl space-y-2 text-xs">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-amber-400" /> Integração com Plano de Corte
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Peça para o Gemini: <i>"Crie as peças de uma estante de 180x60x30"</i> e clique no botão verde que aparecerá na resposta para inserir as peças no Plano de Corte 2D com 1 clique!
            </p>
          </div>
        </div>

        {/* COLUNA DIREITA: FEED DE CONVERSA & INPUT */}
        <div className="lg:col-span-3 bg-[#0d1017] border border-cyan-500/30 rounded-3xl p-4 sm:p-5 flex flex-col h-[650px] shadow-2xl">
          
          {/* MENSAGENS */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in duration-150`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser 
                      ? 'bg-amber-500 text-black font-black text-xs' 
                      : 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Balão de Mensagem */}
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 shadow-lg ${
                    isUser
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black font-medium'
                      : 'bg-[#151922] border border-white/10 text-gray-100'
                  }`}>
                    {/* Imagens anexadas pelo usuário */}
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Anexo" className="w-24 h-24 object-cover rounded-xl border border-black/20" />
                        ))}
                      </div>
                    )}

                    {/* Texto da Mensagem Formatado */}
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>

                    {/* Botão de Ação Rápida: Inserir Peças no Plano de Corte se a IA gerou */}
                    {m.suggestedPieces && m.suggestedPieces.length > 0 && (
                      <div className="pt-3 mt-2 border-t border-white/10 bg-black/20 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" /> {m.suggestedPieces.length} Peças Prontas para Corte
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddSuggestedPiecesToCuttingPlan(m.suggestedPieces!)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <Scissors className="w-4 h-4" />
                          <span>🚀 Inserir Peças no Plano de Corte 2D Agora</span>
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
                <div className="w-8 h-8 rounded-xl bg-cyan-600/30 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-[#151922] border border-cyan-500/30 rounded-2xl px-4 py-2.5 text-xs text-cyan-300 font-bold flex items-center gap-2 shadow-md">
                  <span>SD Gemini 3.7 Flash pensando e calculando...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* PREVIEW DE IMAGEM SELECIONADA */}
          {selectedImage && (
            <div className="flex items-center gap-2 p-2 bg-[#161a24] border border-cyan-500/40 rounded-xl mb-2">
              <img src={selectedImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/20" />
              <div className="flex-1 text-xs text-gray-300 truncate font-mono">
                📸 Imagem / Foto do Projeto Anexada
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* INPUT BAR */}
          <div className="pt-3 border-t border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 text-gray-300 hover:text-cyan-300 rounded-2xl flex items-center justify-center transition-all shrink-0"
                title="Tirar foto ou anexar imagem de projeto/cotação"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Pergunte ao Gemini 3.7: ex: 'Calcule as peças de um armário 2x1m' ou 'Quais as folgas para gavetas?'..."
                disabled={isLoading}
                className="flex-1 bg-[#151922] border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputPrompt.trim() && !selectedImage)}
                className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-950/50 transition-all hover:scale-105 active:scale-95 shrink-0"
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
