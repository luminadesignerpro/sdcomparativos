import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Check,
  MessageSquare,
  ArrowLeft,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Edit,
  Save,
  RotateCcw,
  Send,
  Bot,
  Play,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FlowOption {
  id: string;
  emoji: string;
  label: string;
  response: string;
  subOptions?: FlowOption[];
}

interface FlowTemplate {
  id: string;
  name: string;
  greeting: string;
  options: FlowOption[];
}

const DEFAULT_TEMPLATES: FlowTemplate[] = [
  {
    id: "main",
    name: "Menu Principal",
    greeting:
      "Olá! 👋 Bem-vindo à *SD Móveis*!\nSomos especialistas em móveis projetados.\n\nComo posso te ajudar hoje?",
    options: [
      {
        id: "orcamento",
        emoji: "1️⃣",
        label: "Orçamento de móveis projetados",
        response:
          "Ótima escolha! 🎉\n\nNós usamos uma tecnologia exclusiva de *Realidade Aumentada* para orçar seu projeto sem precisar ir na sua casa agora!\n\n📐 *Quer medir seu ambiente sozinho?* Use nosso Studio AR: https://sdmoveis.com.br/studio-ar\n\nOu me informe aqui:\n✅ Qual o ambiente?\n✅ Medidas aproximadas?\n\nO que você prefere? 😊",
        subOptions: [
          {
            id: "cozinha",
            emoji: "🍳",
            label: "Cozinha projetada",
            response:
              "Excelente! Cozinhas são nossa especialidade! 🍳\n\nNós trabalhamos com projetos totalmente personalizados. Para que o nosso CEO possa analisar seu espaço e te passar o melhor valor, preciso de:\n- Metragem linear da cozinha\n- Se terá ilha/bancada\n- Tipo de acabamento preferido\n\nPosso agendar uma visita técnica gratuita! 📅",
          },
          {
            id: "quarto",
            emoji: "🛏️",
            label: "Quarto/Closet",
            response:
              "Quartos planejados trazem muito mais organização! 🛏️\n\nCada projeto é único. O que você precisa?\n- Guarda-roupa / Closet\n- Cabeceira com painel\n- Bancada de estudo\n- Cômoda\n\nMe conte suas necessidades para enviarmos para análise técnica! 😊",
          },
          {
            id: "banheiro",
            emoji: "🚿",
            label: "Banheiro",
            response:
              "Banheiros planejados ficam incríveis! 🚿\n\nOpções disponíveis:\n- Gabinete sob medida\n- Espelheira com iluminação LED\n- Nicho para box\n\nMe envie o tamanho aproximado para iniciarmos o seu estudo de design! 📏",
          },
        ],
      },
      {
        id: "acompanhar",
        emoji: "2️⃣",
        label: "Acompanhar meu projeto",
        response:
          "Perfeito! Vou verificar o andamento do seu projeto. 📋\n\nPor favor, me informe:\n📝 *Seu nome completo*\n📄 *Número do contrato* (se tiver)\n\nAssim consigo buscar todas as informações atualizadas para você! ⏳",
      },
      {
        id: "posvenda",
        emoji: "3️⃣",
        label: "Pós-venda / Garantia",
        response:
          "Estamos aqui para te ajudar no pós-venda! 🛡️\n\nNosso compromisso:\n✅ Garantia de *5 anos* em todos os móveis\n✅ Assistência técnica especializada\n✅ Manutenção preventiva\n\nQual é a sua necessidade?",
        subOptions: [
          {
            id: "garantia",
            emoji: "🛡️",
            label: "Acionar garantia",
            response:
              "Para acionar a garantia, preciso das seguintes informações:\n\n📄 *Número do contrato*\n📸 *Fotos do problema*\n📝 *Descrição do defeito*\n\nNossa equipe técnica vai analisar e agendar uma visita em até 48h úteis. 🔧",
          },
          {
            id: "manutencao",
            emoji: "🔧",
            label: "Solicitar manutenção",
            response:
              "Vou agendar uma manutenção para você! 🔧\n\nMe informe:\n- *Endereço* para a visita\n- *Melhor dia e horário*\n- *O que precisa ser ajustado*\n\nValor da visita técnica: *R$ 80,00* (descontado se houver serviço). 📅",
          },
          {
            id: "conservacao",
            emoji: "📖",
            label: "Dicas de conservação",
            response:
              "Aqui vão nossas dicas de conservação! 📖\n\n🧹 *Limpeza diária:* Pano úmido com detergente neutro\n⚠️ *Evite:* Produtos abrasivos, álcool e água sanitária\n💧 *Umidade:* Seque respingos imediatamente\n☀️ *Sol:* Evite exposição direta prolongada\n🔩 *Dobradiças:* Lubrifique a cada 6 meses\n\nSeguindo essas dicas, seus móveis vão durar muitos anos! 💪",
          },
        ],
      },
      {
        id: "atendente",
        emoji: "4️⃣",
        label: "Falar com um atendente",
        response:
          "Vou te conectar com um de nossos atendentes! 👤\n\n⏰ *Horário de atendimento:*\nSeg a Sex: 8h às 18h\nSáb: 8h às 12h\n\n📞 Telefone: (XX) XXXXX-XXXX\n📧 Email: contato@sdmoveis.com.br\n\nUm momento, por favor... 😊",
      },
      {
        id: "horario",
        emoji: "5️⃣",
        label: "Horário de funcionamento",
        response:
          "🕐 *Horário de Funcionamento:*\n\n📅 Segunda a Sexta: *8h às 18h*\n📅 Sábado: *8h às 12h*\n📅 Domingo e Feriados: *Fechado*\n\n📍 *Endereço:* [Seu endereço aqui]\n\n🗺️ Venha nos visitar! Teremos prazer em recebê-lo! 😊",
      },
    ],
  },
];

export function ChatFlowPanel() {
  const [templates, setTemplates] = useState<FlowTemplate[]>(DEFAULT_TEMPLATES);
  const [activeTemplate, setActiveTemplate] = useState<FlowTemplate>(templates[0]);
  const [chatHistory, setChatHistory] = useState<{ role: "bot" | "user"; content: string }[]>([]);
  const [currentOptions, setCurrentOptions] = useState<FlowOption[]>([]);
  const [navigationStack, setNavigationStack] = useState<FlowOption[][]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editResponse, setEditResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const { toast } = useToast();

  // 1. Carregar configurações do banco de dados na inicialização
  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from('atendimento_config')
        .select('*')
        .eq('chave', 'menu_principal')
        .single();
      
      if (data && data.conteudo) {
        const config = data.conteudo;
        setTemplates(prev => {
           const updated = [...prev];
           updated[0].greeting = config.greeting;
           // Mapear respostas do banco para as opções do template
           if (config.responses) {
             updated[0].options = updated[0].options.map(opt => {
                const key = opt.id === "orcamento" ? "1" : 
                            opt.id === "acompanhar" ? "2" : 
                            opt.id === "posvenda" ? "3" : 
                            opt.id === "atendente" ? "4" : 
                            opt.id === "horario" ? "5" : "";
                return { ...opt, response: config.responses[key] || opt.response };
             });
           }
           setActiveTemplate(updated[0]);
           return updated;
        });
      }
    };
    fetchConfig();
  }, []);

  // 2. Salvar Alterações no Banco de Dados (Sincronização com WhatsApp)
  const saveToDB = async (updatedTemplate: FlowTemplate) => {
     const config = {
       greeting: updatedTemplate.greeting,
       responses: {
         "1": updatedTemplate.options.find(o => o.id === "orcamento")?.response,
         "2": updatedTemplate.options.find(o => o.id === "acompanhar")?.response,
         "3": updatedTemplate.options.find(o => o.id === "posvenda")?.response,
         "4": updatedTemplate.options.find(o => o.id === "atendente")?.response,
         "5": updatedTemplate.options.find(o => o.id === "horario")?.response,
       }
     };

     const { error } = await supabase
       .from('atendimento_config')
       .upsert({ chave: 'menu_principal', conteudo: config });

     if (error) {
       toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
     } else {
       toast({ title: "✅ Sincronizado com WhatsApp", description: "O seu robô já aprendeu as novas informações!" });
     }
  };

  const startFlow = () => {
    setChatHistory([{ role: "bot", content: activeTemplate.greeting }]);
    setCurrentOptions(activeTemplate.options);
    setNavigationStack([]);
  };

  const selectOption = (option: FlowOption) => {
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: `${option.emoji} ${option.label}` },
      { role: "bot", content: option.response },
    ]);

    if (option.subOptions && option.subOptions.length > 0) {
      setNavigationStack((prev) => [...prev, currentOptions]);
      setCurrentOptions(option.subOptions);
    } else {
      setCurrentOptions([]);
    }
  };

  const goBack = () => {
    if (navigationStack.length > 0) {
      const prev = [...navigationStack];
      const lastOptions = prev.pop()!;
      setNavigationStack(prev);
      setCurrentOptions(lastOptions);
      setChatHistory((h) => h.slice(0, -2));
    }
  };

  const resetFlow = () => {
    startFlow();
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };

  const generateAIResponse = async (context: string) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-ai", {
        body: {
          conversationId: "flow-builder",
          contactName: "Cliente",
          messageHistory: [
            { direction: "inbound", content: context },
            ...(customPrompt
              ? [{ direction: "inbound", content: customPrompt }]
              : []),
          ],
        },
      });

      if (error) throw error;

      if (data?.content) {
        setChatHistory((prev) => [
          ...prev,
          { role: "bot", content: data.content },
        ]);
        toast({ title: "IA respondeu", description: "Resposta gerada com sucesso!" });
      }
    } catch (error: any) {
      console.error("AI error:", error);
      toast({
        title: "Erro na IA",
        description: error?.message || "Não foi possível gerar resposta.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
      setCustomPrompt("");
    }
  };

  const saveEditedResponse = (optionId: string) => {
    const updateOptions = (opts: FlowOption[]): FlowOption[] =>
      opts.map((o) => {
        if (o.id === optionId) return { ...o, response: editResponse };
        if (o.subOptions) return { ...o, subOptions: updateOptions(o.subOptions) };
        return o;
      });

    const updated = { ...activeTemplate, options: updateOptions(activeTemplate.options) };
    setActiveTemplate(updated);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingOption(null);
    setEditResponse("");
    saveToDB(updated); // ✅ Salva no banco de dados para o WhatsApp ler
  };

  const copyFullFlow = async () => {
    const fullText = chatHistory.map((m) => (m.role === "bot" ? `🤖 SD Móveis:\n${m.content}` : `👤 Cliente:\n${m.content}`)).join("\n\n---\n\n");
    await copyToClipboard(fullText, "full-flow");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-success" />
            Fluxo de Atendimento
          </h3>
          <p className="text-sm text-muted-foreground">
            Simule o atendimento e copie as respostas para o WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="w-4 h-4 mr-1" />
            {isEditing ? "Sair da edição" : "Editar fluxo"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Flow Options / Editor */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">
              {isEditing ? "Editor de Respostas" : "Menu de Opções"}
            </h4>
            {!isEditing && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={resetFlow}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reiniciar
                </Button>
                {chatHistory.length > 0 && (
                  <Button size="sm" variant="outline" onClick={copyFullFlow}>
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar tudo
                  </Button>
                )}
              </div>
            )}
          </div>

          {chatHistory.length === 0 && !isEditing ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">Clique para iniciar o fluxo de atendimento</p>
              <Button onClick={startFlow} className="bg-success hover:bg-success/90">
                <Play className="w-4 h-4 mr-2" />
                Iniciar Fluxo
              </Button>
            </div>
          ) : isEditing ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {/* Greeting edit */}
                <div className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">Saudação</Badge>
                    {editingOption === "greeting" ? (
                      <Button size="sm" variant="ghost" onClick={() => {
                        const updated = { ...activeTemplate, greeting: editResponse };
                        setActiveTemplate(updated);
                        setEditingOption(null);
                        saveToDB(updated);
                      }}>
                        <Save className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingOption("greeting");
                        setEditResponse(activeTemplate.greeting);
                      }}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {editingOption === "greeting" ? (
                    <Textarea value={editResponse} onChange={(e) => setEditResponse(e.target.value)} rows={4} />
                  ) : (
                    <p className="text-sm whitespace-pre-line">{activeTemplate.greeting}</p>
                  )}
                </div>

                {/* Options edit */}
                {activeTemplate.options.map((opt) => (
                  <div key={opt.id} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge>{opt.emoji} {opt.label}</Badge>
                      {editingOption === opt.id ? (
                        <Button size="sm" variant="ghost" onClick={() => saveEditedResponse(opt.id)}>
                          <Save className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingOption(opt.id);
                          setEditResponse(opt.response);
                        }}>
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {editingOption === opt.id ? (
                      <Textarea value={editResponse} onChange={(e) => setEditResponse(e.target.value)} rows={6} />
                    ) : (
                      <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">{opt.response}</p>
                    )}
                    {opt.subOptions && (
                      <div className="pl-4 space-y-2 border-l-2 border-muted">
                        {opt.subOptions.map((sub) => (
                          <div key={sub.id} className="p-2 rounded border border-border/50">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="text-xs">{sub.emoji} {sub.label}</Badge>
                              {editingOption === sub.id ? (
                                <Button size="sm" variant="ghost" onClick={() => saveEditedResponse(sub.id)}>
                                  <Save className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => {
                                  setEditingOption(sub.id);
                                  setEditResponse(sub.response);
                                }}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            {editingOption === sub.id ? (
                              <Textarea value={editResponse} onChange={(e) => setEditResponse(e.target.value)} rows={4} className="mt-2" />
                            ) : (
                              <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3 mt-1">{sub.response}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="space-y-3">
              {navigationStack.length > 0 && (
                <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
              )}
              {currentOptions.length > 0 ? (
                <div className="space-y-2">
                  {currentOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(opt)}
                      className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Fim do fluxo. Use a IA para continuar:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="O que o cliente perguntou?"
                      onKeyDown={(e) => e.key === "Enter" && customPrompt && generateAIResponse(customPrompt)}
                    />
                    <Button
                      onClick={() => generateAIResponse(customPrompt || "Continue o atendimento")}
                      disabled={aiLoading}
                      size="icon"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Chat Preview */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Pré-visualização do Chat</h4>
            <Badge variant="outline" className="text-xs">WhatsApp Style</Badge>
          </div>

          <ScrollArea className="h-[500px] bg-card rounded-xl p-4 border border-border">
            <div className="space-y-3">
              {chatHistory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Inicie o fluxo para ver a pré-visualização
                </p>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      msg.role === "bot" ? "justify-start" : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 relative group",
                        msg.role === "bot"
                          ? "bg-muted text-foreground rounded-tl-none"
                          : "bg-success text-success-foreground rounded-tr-none"
                      )}
                    >
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
                        </span>
                      </div>
                      {/* Copy button */}
                      {msg.role === "bot" && (
                        <button
                          onClick={() => copyToClipboard(msg.content, `msg-${idx}`)}
                          className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-muted hover:bg-muted/80"
                          title="Copiar mensagem"
                        >
                          {copiedId === `msg-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-lg rounded-tl-none px-3 py-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bot className="w-4 h-4" />
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Digitando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}

