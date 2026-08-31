import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare,
  Send,
  Search,
  Phone,
  MoreVertical,
  CheckCheck,
  Sparkles,
  Bot,
  Loader2,
  Wifi,
  WifiOff,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsApp, WhatsAppConversation, WhatsAppMessage } from "@/hooks/useWhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-warning/20 text-warning border-warning/30" },
  negociando: { label: "Negociando", className: "bg-accent/20 text-accent border-accent/30" },
  cliente: { label: "Cliente", className: "bg-success/20 text-success border-success/30" },
};

export function WhatsAppCRM() {
  const { conversations, messages, loading, sendingMessage, fetchConversations, fetchMessages, sendMessage, setActiveConversation } = useWhatsApp();
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [aiAutoReply, setAiAutoReply] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connectingQR, setConnectingQR] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const EVOLUTION_URL = 'https://api-whatsapp-sdmoveis.onrender.com';
  const EVOLUTION_KEY = 'Mv06061991';
  const INSTANCE = 'SD-Moveis';

  // Check Evolution API connection status
  const checkApiStatus = async () => {
    try {
      const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
        headers: { apikey: EVOLUTION_KEY },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const state = data?.instance?.state || data?.state || '';
        setApiStatus(state === 'open' ? 'connected' : 'disconnected');
      } else {
        setApiStatus('disconnected');
      }
    } catch {
      setApiStatus('disconnected');
    }
  };

  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleConnectQR = async () => {
    setConnectingQR(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "connect", instanceName: INSTANCE },
      });

      if (error) throw error;

      if (data.base64 || data.qrcode?.base64) {
        const qrBase64 = data.base64 || data.qrcode?.base64;
        const win = window.open('', '_blank', 'width=500,height=600');
        win?.document.write(`
          <html style="font-family:sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
            <div style="background:white;padding:40px;border-radius:20px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.15)">
              <h2 style="color:#25D366;margin-bottom:16px">📲 Conectar SD Móveis</h2>
              <img src="${qrBase64}" style="width:280px;height:280px;border:1px solid #eee;border-radius:10px" />
              <p style="color:#666;margin-top:16px;font-size:14px">Abra o WhatsApp → Dispositivos Vinculados → Escanear QR Code</p>
            </div>
          </html>
        `);
        toast({ title: 'QR Code gerado!', description: 'Escaneie com seu WhatsApp para conectar.' });
        setTimeout(checkApiStatus, 15000);
      } else if (data.instance?.state === 'open' || data.state === 'open') {
        toast({ title: '✅ Já conectado!', description: 'WhatsApp já está ativo.' });
        setApiStatus('connected');
      } else {
        toast({ title: '⏳ API iniciando', description: 'Aguarde 30s e tente novamente (Render cold start).', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      toast({ title: 'Erro de conexão', description: error.message || 'Verifique se a API está no ar no Render.', variant: 'destructive' });
    } finally {
      setConnectingQR(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversation) {
      setActiveConversation(selectedConversation.id);
      fetchMessages(selectedConversation.id);
    } else {
      setActiveConversation(null);
    }
  }, [selectedConversation, fetchMessages, setActiveConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredConversations = conversations.filter(
    (c) =>
      (c.contact_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone_number.includes(searchTerm)
  );

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;
    try {
      await sendMessage(selectedConversation.id, message);
      setMessage("");
    } catch (e) {
      // error handled in hook
    }
  };

  const generateAIResponse = async () => {
    if (!selectedConversation) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-ai", {
        body: {
          conversationId: selectedConversation.id,
          contactName: selectedConversation.contact_name,
          messageHistory: messages.map((m) => ({
            direction: m.direction,
            content: m.content,
          })),
        },
      });

      if (error) throw error;

      if (data?.content) {
        toast({ title: "IA respondeu", description: "Resposta gerada e enviada com sucesso!" });
        await fetchMessages(selectedConversation.id);
        await fetchConversations();
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
    }
  };

  // Auto-reply with AI when a new inbound message arrives
  useEffect(() => {
    if (!aiAutoReply || !selectedConversation || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.direction === "inbound" && lastMsg.message_type !== "ai") {
      generateAIResponse();
    }
  }, [messages.length, aiAutoReply]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="bg-card rounded-xl border border-border h-[700px] flex overflow-hidden">
      {/* Contacts sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-success" />
            <h3 className="font-semibold flex-1">CRM WhatsApp</h3>
            {/* API Status + Connect Button */}
            {apiStatus === 'connected' ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1 text-xs">
                  <Wifi className="w-3 h-3" /> Online
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-[10px] text-red-500 hover:bg-red-500/10"
                  onClick={async () => {
                    if (confirm('Deseja desconectar o WhatsApp atual?')) {
                      try {
                        await fetch(`${EVOLUTION_URL}/instance/logout/${INSTANCE}`, {
                          method: 'DELETE',
                          headers: { apikey: EVOLUTION_KEY }
                        });
                        checkApiStatus();
                        toast({ title: 'Desconectado', description: 'WhatsApp desconectado com sucesso.' });
                      } catch (e) {
                        toast({ title: 'Erro ao desconectar', variant: 'destructive' });
                      }
                    }
                  }}
                >
                  Sair
                </Button>
              </div>
            ) : apiStatus === 'checking' ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                onClick={handleConnectQR}
                disabled={connectingQR}
              >
                {connectingQR ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                {connectingQR ? 'Aguarde...' : 'Conectar'}
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma conversa encontrada
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    selectedConversation?.id === conv.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(conv.contact_name || conv.phone_number).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conv.contact_name || conv.phone_number}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage}
                        </p>
                        {(conv.unreadCount || 0) > 0 && (
                          <span className="w-5 h-5 rounded-full bg-success text-success-foreground text-xs flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-2 text-xs",
                          (statusConfig[conv.lead_status] || statusConfig.lead).className
                        )}
                      >
                        {(statusConfig[conv.lead_status] || statusConfig.lead).label}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(selectedConversation.contact_name || selectedConversation.phone_number).charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-medium">
                  {selectedConversation.contact_name || selectedConversation.phone_number}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedConversation.phone_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">IA Auto</span>
                <Switch checked={aiAutoReply} onCheckedChange={setAiAutoReply} />
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-muted/20" ref={scrollRef as any}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.direction === "outbound" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2",
                      msg.direction === "outbound"
                        ? msg.message_type === "ai"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-success text-success-foreground rounded-br-sm"
                        : "bg-card border border-border rounded-bl-sm"
                    )}
                  >
                    {msg.message_type === "ai" && (
                      <div className="flex items-center gap-1 mb-1 opacity-80">
                        <Bot className="w-3 h-3" />
                        <span className="text-xs font-medium">IA</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.direction === "outbound" && (
                        <CheckCheck
                          className={cn(
                            "w-4 h-4",
                            msg.status === "read" ? "text-accent" : "opacity-50"
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4" />
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Gerando resposta...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={generateAIResponse}
                className="shrink-0"
                title="Gerar resposta com IA"
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={sendingMessage}
              />
              <Button
                onClick={handleSendMessage}
                className="bg-success hover:bg-success/90"
                disabled={sendingMessage || !message.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Selecione um contato para iniciar</p>
          </div>
        </div>
      )}
    </div>
  );
}
