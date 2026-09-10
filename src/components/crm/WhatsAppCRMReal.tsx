import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Settings, 
  Send, 
  CheckCheck, 
  QrCode, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  LogOut,
  Zap,
  Bot
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { cn } from "@/lib/utils";

export function WhatsAppCRMReal({ setView }: { setView?: (view: any) => void }) {
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { 
    conversations, 
    messages, 
    loading: loadingData, 
    fetchConversations, 
    fetchMessages,
    sendMessage,
    setActiveConversation
  } = useWhatsApp();

  const checkApiStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'get-status' }
      });

      if (error) throw error;

      console.log('API Status:', data);
      
      const isConnected = data?.instance?.state === 'open' || data?.instance?.connectionStatus === 'connected';
      setApiStatus(isConnected ? "connected" : "disconnected");
      
      if (isConnected) {
        setQrCodeData(null);
        fetchConversations();
      }
    } catch (err) {
      console.error('Error checking API status:', err);
      setApiStatus("disconnected");
    }
  }, [fetchConversations]);

  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000);
    return () => clearInterval(interval);
  }, [checkApiStatus]);

  // Smart auto-scroll: only go to bottom if user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Always scroll to bottom when opening a new conversation
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const getQrCode = async () => {
    setLoading(true);
    setApiStatus("checking");
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'connect' }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          variant: "destructive",
          title: "Erro na API",
          description: data.error
        });
        setApiStatus("disconnected");
        return;
      }

      if (data.base64 || data.qrcode?.base64) {
        setQrCodeData(data.base64 || data.qrcode?.base64);
        setApiStatus("disconnected");
      } else if (data.instance?.state === 'open') {
        toast({ title: "Conectado!", description: "WhatsApp já está ativo." });
        setApiStatus("connected");
      } else {
        toast({
          title: "⏳ Aguarde",
          description: "O servidor está iniciando. Tente novamente em 20 segundos.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: err.message || "Não foi possível obter o QR Code."
      });
      setApiStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp?")) return;
    setLoading(true);
    try {
      await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'logout' }
      });
      toast({ title: "Desconectado", description: "Instância removida com sucesso." });
      setApiStatus("disconnected");
      setQrCodeData(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao desconectar." });
    } finally {
      setLoading(false);
    }
  };

  const syncWebhook = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'sync-webhook' }
      });
      if (error) throw error;
      if (data?.error) {
        toast({ 
          variant: "destructive",
          title: "❌ Falha no Webhook", 
          description: data.error 
        });
      } else {
        toast({ 
          title: "✅ Webhook Sincronizado!", 
          description: `URL registrada: ${data?.webhookUrl || 'OK'}` 
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err?.message || "Falha ao sincronizar webhook." });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const text = messageText;
    setMessageText("");

    try {
      const success = await sendMessage(selectedConversation.id, text);
      if (!success) throw new Error("Falha ao enviar");
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: "Verifique a conexão." });
      setMessageText(text); // Restore text on error
    }
  };

  const getStatusBadge = (status: string) => {
    const config: any = {
      lead: { label: "Lead", class: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
      negociando: { label: "Negociando", class: "bg-amber-500/20 text-amber-400 border-amber-500/20" },
      cliente: { label: "Cliente", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" },
    };
    const item = config[status] || { label: status, class: "bg-gray-500/20 text-gray-400" };
    return <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-tighter", item.class)}>{item.label}</Badge>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-full lg:h-[calc(100vh-220px)] min-h-[500px] pb-4 lg:pb-0">
      {/* Sidebar - Conversas */}
      <Card className={cn(
        "col-span-1 lg:col-span-4 bg-white/5 border-white/10 overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl transition-all duration-300 h-[70vh] lg:h-full",
        mobileView === "chat" && "hidden lg:flex"
      )}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm uppercase tracking-widest text-white/80">Conversas</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchConversations()} disabled={loadingData} className="hover:bg-amber-500/20">
            <RefreshCw className={cn("w-4 h-4", loadingData && "animate-spin")} />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-white/5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv);
                  setActiveConversation(conv.id);
                  fetchMessages(conv.id);
                  setMobileView("chat");
                  scrollToBottom();
                }}
                className={cn(
                  "w-full p-4 text-left transition-all duration-300 group hover:bg-white/5",
                  selectedConversation?.id === conv.id && "bg-amber-500/10 border-l-2 border-amber-500"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <span className="font-bold text-white/90 group-hover:text-amber-400 transition-colors block">
                      {conv.contact_name || conv.phone_number}
                    </span>
                    {conv.contact_name && (
                      <span className="text-[10px] text-amber-500/70 font-mono">
                        +{conv.phone_number}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/30 font-medium uppercase">
                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40 truncate flex-1 mr-2 italic">
                    {conv.lastMessage || 'Sem mensagens...'}
                  </p>
                  {getStatusBadge(conv.lead_status)}
                </div>
              </button>
            ))}
            {conversations.length === 0 && !loadingData && (
              <div className="p-8 text-center text-white/20 italic text-sm">Nenhuma conversa encontrada</div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className={cn(
        "col-span-1 lg:col-span-8 bg-white/5 border-white/10 overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl relative transition-all duration-300 h-[70vh] lg:h-full",
        mobileView === "list" && "hidden lg:flex"
      )}>
        {/* Header de Conexão */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Mobile Back Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden h-8 w-8 text-white/50" 
              onClick={() => setMobileView("list")}
            >
              <RefreshCw className="w-4 h-4 rotate-180" />
            </Button>

            <div className="flex flex-col">
              <h3 className="text-white font-bold text-sm">
                {selectedConversation?.contact_name || selectedConversation?.phone_number || 'Chat'}
              </h3>
              {selectedConversation?.contact_name && (
                <span className="text-[10px] text-amber-500 font-mono">
                  +{selectedConversation?.phone_number}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 border border-white/10">
              {apiStatus === "connected" ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-500">
                    Online (SD-Moveis)
                  </span>
                </>
              ) : apiStatus === "checking" ? (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-amber-500">Verificando</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-red-500">Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {apiStatus === "connected" ? (
              <>
                <Button variant="outline" size="sm" onClick={syncWebhook} className="h-8 gap-2 bg-black/50 border-white/10 hover:bg-amber-500/20 text-xs">
                  <Zap className="w-3 h-3 text-amber-500" /> Sincronizar Webhook
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={getQrCode} disabled={loading} className="h-8 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-[10px]">
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                Conectar WhatsApp
              </Button>
            )}
          </div>
        </div>

        {/* Mensagens ou QR Code */}
        <div className="flex-1 flex flex-col pt-16 min-h-0">
          {apiStatus === "connected" && selectedConversation ? (
            <>
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-6 min-h-0"
              >
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.direction === 'outbound' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-2xl shadow-xl",
                        msg.direction === 'outbound' 
                          ? "bg-amber-500 text-black rounded-tr-none" 
                          : "bg-white/10 text-white border border-white/5 rounded-tl-none"
                      )}>
                        <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1 opacity-50">
                          <span className="text-[9px] font-bold">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.direction === 'outbound' && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/20">
                <div className="flex gap-2">
                  <Input 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Escreva sua mensagem..." 
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
                  />
                  <Button onClick={handleSendMessage} className="bg-amber-500 hover:bg-amber-600 text-black h-10 w-10 p-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : qrCodeData && apiStatus === "disconnected" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/40">
              <div className="bg-white p-4 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] mb-6 animate-in zoom-in duration-500">
                <img src={qrCodeData} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
              <h2 className="text-2xl font-black text-amber-500 uppercase flex items-center gap-3">
                <QrCode className="w-6 h-6" /> Escaneie para Conectar
              </h2>
              <p className="text-white/40 mt-2 max-w-sm text-sm">
                Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código acima.
              </p>
              <Button variant="ghost" className="mt-6 text-white/30 hover:text-white hover:bg-white/5" onClick={checkApiStatus}>
                <RefreshCw className="w-4 h-4 mr-2" /> Já escaneei
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-20">
              <div className="relative mb-6">
                <Bot className="w-20 h-20 text-amber-500" />
                <Zap className="w-8 h-8 text-amber-500 absolute -top-2 -right-2 animate-pulse" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest text-white">CRM Inteligente SD</h3>
              <p className="text-sm mt-2 max-w-xs mx-auto font-medium">
                Selecione uma conversa ao lado ou conecte seu WhatsApp para começar a gerenciar seus leads.
              </p>
            </div>
          )}
        </div>
      </Card>
      
      {/* Botão Flutuante de IA - Inteligência SD */}
      <Button 
        onClick={() => setView && setView("AI_SALES")}
        title="Ver Vendedor IA"
        className="fixed bottom-24 right-8 h-14 w-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:scale-110 transition-transform flex items-center justify-center p-0 z-50 animate-bounce-slow"
      >
        <Bot className="w-7 h-7" />
      </Button>
    </div>
  );
}

function Input({ ...props }: any) {
  return <input {...props} className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", props.className)} />;
}
