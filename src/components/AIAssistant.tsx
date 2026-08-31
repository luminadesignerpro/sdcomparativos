import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, User, Bot, Lightbulb, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestions = [
  "Como otimizar o espaço de uma cozinha pequena?",
  "Qual a melhor disposição para um guarda-roupa?",
  "Sugira cores para um escritório moderno",
  "Monte um orçamento para cozinha projetada",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Olá! Sou o assistente IA da SD Móveis. Posso ajudar com design de móveis, sugestões de layout, orçamentos e muito mais. Como posso ajudar?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id === "streaming") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev,
          { id: "streaming", role: "assistant" as const, content: assistantSoFar, timestamp: new Date() },
        ];
      });
    };

    try {
      const apiMessages = messages
        .filter((m) => m.id !== "1")
        .map((m) => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: "user", content: currentInput });

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao conectar com a IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Replace streaming id with final id
      setMessages((prev) =>
        prev.map((m) => (m.id === "streaming" ? { ...m, id: Date.now().toString() } : m))
      );
    } catch (error: any) {
      console.error("AI error:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível gerar resposta.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== "streaming"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border h-[600px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Assistente IA</h3>
          <p className="text-xs text-muted-foreground">Desenvolvido por SD Móveis</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground"
                  }`}
              >
                {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`rounded-xl p-3 max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-xl p-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Lightbulb className="w-4 h-4" />
            <span className="text-xs">Sugestões</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setInput(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
