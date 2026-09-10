import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  Send,
  Search,
  Phone,
  MoreVertical,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Agora';
  if (hours < 24) return `${hours}h atrás`;
  return date.toLocaleDateString('pt-BR');
};

interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
  status: "lead" | "negotiating" | "client";
}

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "contact";
  timestamp: Date;
  read: boolean;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Maria Silva",
    phone: "(11) 99999-1234",
    lastMessage: "Quando posso ver o projeto da cozinha?",
    lastMessageTime: new Date(),
    unread: 2,
    status: "negotiating",
  },
  {
    id: "2",
    name: "João Santos",
    phone: "(11) 98888-5678",
    lastMessage: "O orçamento ficou ótimo, vamos fechar!",
    lastMessageTime: new Date(Date.now() - 3600000),
    unread: 0,
    status: "client",
  },
  {
    id: "3",
    name: "Ana Costa",
    phone: "(11) 97777-9012",
    lastMessage: "Gostaria de um orçamento para quarto",
    lastMessageTime: new Date(Date.now() - 86400000),
    unread: 1,
    status: "lead",
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: "1",
    content: "Olá! Vi o anúncio de vocês e gostaria de um orçamento.",
    sender: "contact",
    timestamp: new Date(Date.now() - 7200000),
    read: true,
  },
  {
    id: "2",
    content:
      "Olá Maria! Claro, ficaremos felizes em ajudar. Qual ambiente você gostaria de mobiliar?",
    sender: "user",
    timestamp: new Date(Date.now() - 7000000),
    read: true,
  },
  {
    id: "3",
    content: "Preciso de uma cozinha projetada completa. O espaço tem 12m².",
    sender: "contact",
    timestamp: new Date(Date.now() - 3600000),
    read: true,
  },
  {
    id: "4",
    content: "Quando posso ver o projeto da cozinha?",
    sender: "contact",
    timestamp: new Date(),
    read: false,
  },
];

const statusConfig = {
  lead: { label: "Lead", className: "bg-warning/20 text-warning border-warning/30" },
  negotiating: { label: "Negociando", className: "bg-accent/20 text-accent border-accent/30" },
  client: { label: "Cliente", className: "bg-success/20 text-success border-success/30" },
};

export function WhatsAppCRM() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(
    mockContacts[0]
  );
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContacts = mockContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const handleSendMessage = () => {
    if (!message.trim()) return;
    // Would send message via WhatsApp API
    setMessage("");
  };

  const generateAIResponse = () => {
    // Would generate AI suggestion
    setMessage(
      "Olá! Acabamos de finalizar o projeto 3D da sua cozinha. Ficou incrível! 🎨 Posso agendar uma visita para apresentar? Temos disponibilidade amanhã às 14h ou 16h."
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border h-[700px] flex overflow-hidden">
      {/* Contacts sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-success" />
            <h3 className="font-semibold">CRM WhatsApp</h3>
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
          <div className="divide-y divide-border">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={cn(
                  "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                  selectedContact?.id === contact.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {contact.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {contact.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {contact.lastMessageTime.getHours()}:
                        {String(contact.lastMessageTime.getMinutes()).padStart(
                          2,
                          "0"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.lastMessage}
                      </p>
                      {contact.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-success text-success-foreground text-xs flex items-center justify-center">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("mt-2 text-xs", statusConfig[contact.status].className)}
                    >
                      {statusConfig[contact.status].label}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedContact.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-medium">{selectedContact.name}</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedContact.phone}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-muted/20">
            <div className="space-y-4">
              {mockMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2",
                      msg.sender === "user"
                        ? "bg-success text-success-foreground rounded-br-sm"
                        : "bg-card border border-border rounded-bl-sm"
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {msg.timestamp.getHours()}:
                        {String(msg.timestamp.getMinutes()).padStart(2, "0")}
                      </span>
                      {msg.sender === "user" && (
                        <CheckCheck
                          className={cn(
                            "w-4 h-4",
                            msg.read ? "text-accent" : "opacity-50"
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button onClick={handleSendMessage} className="bg-success hover:bg-success/90">
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
