import React, { useState } from 'react';
import {
  MessageCircle, Search, Send, Phone, Video, MoreVertical,
  Star, Clock, CheckCircle, User, Plus, Filter, Tag,
  Paperclip, Smile, Mic, Image, ChevronRight, Circle,
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: 'lead' | 'negotiation' | 'client' | 'after_sales';
  avatar: string;
  online: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'contact';
  time: string;
  status: 'sent' | 'delivered' | 'read';
}

const CONTACTS: Contact[] = [
  { id: '1', name: 'Ricardo Almeida', phone: '(11) 98888-7777', lastMessage: 'Boa tarde! Gostaria de um orçamento para cozinha', time: '14:32', unread: 3, status: 'lead', avatar: '👨', online: true },
  { id: '2', name: 'Juliana Silva', phone: '(11) 97777-6666', lastMessage: 'O projeto ficou incrível! Quando começa a produção?', time: '13:15', unread: 0, status: 'negotiation', avatar: '👩', online: false },
  { id: '3', name: 'Marcos Oliveira', phone: '(11) 95555-4444', lastMessage: 'Preciso alterar a cor do acabamento', time: '11:45', unread: 1, status: 'client', avatar: '👨‍💼', online: true },
  { id: '4', name: 'Ana Paula Costa', phone: '(11) 94444-3333', lastMessage: 'A instalação ficou perfeita! Obrigada!', time: 'Ontem', unread: 0, status: 'after_sales', avatar: '👩‍💻', online: false },
  { id: '5', name: 'Carlos Eduardo', phone: '(11) 93333-2222', lastMessage: 'Vocês fazem home office planejado?', time: 'Ontem', unread: 2, status: 'lead', avatar: '🧑', online: false },
  { id: '6', name: 'Fernanda Lima', phone: '(11) 92222-1111', lastMessage: 'Quero agendar uma visita técnica', time: '2 dias', unread: 0, status: 'negotiation', avatar: '👩‍🦰', online: true },
];

const MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', text: 'Olá! Vi o trabalho de vocês no Instagram e adorei!', sender: 'contact', time: '14:20', status: 'read' },
    { id: 'm2', text: 'Boa tarde Ricardo! Obrigado pelo interesse! 😊', sender: 'user', time: '14:22', status: 'read' },
    { id: 'm3', text: 'Que tipo de projeto você está buscando?', sender: 'user', time: '14:22', status: 'read' },
    { id: 'm4', text: 'Estou reformando minha cozinha e gostaria de móveis planejados', sender: 'contact', time: '14:28', status: 'read' },
    { id: 'm5', text: 'Boa tarde! Gostaria de um orçamento para cozinha', sender: 'contact', time: '14:32', status: 'read' },
  ],
  '3': [
    { id: 'm1', text: 'Olá, como está a produção do meu projeto?', sender: 'contact', time: '11:30', status: 'read' },
    { id: 'm2', text: 'Bom dia Marcos! Está na fase de fitamento de bordas, 85% concluído!', sender: 'user', time: '11:35', status: 'read' },
    { id: 'm3', text: 'Preciso alterar a cor do acabamento', sender: 'contact', time: '11:45', status: 'read' },
  ],
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Lead' },
  negotiation: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Negociação' },
  client: { bg: 'bg-green-100', text: 'text-green-700', label: 'Cliente' },
  after_sales: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pós-Venda' },
};

interface CRMWhatsAppProps {
  isClient?: boolean;
}

const CRMWhatsApp: React.FC<CRMWhatsAppProps> = ({ isClient = false }) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(CONTACTS[0]);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>(MESSAGES);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredContacts = CONTACTS.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchFilter;
  });

  const sendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      text: messageInput,
      sender: 'user',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    };
    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), newMsg],
    }));
    setMessageInput('');
  };

  const contactMessages = selectedContact ? (messages[selectedContact.id] || []) : [];

  if (isClient) {
    return (
      <div className="h-full p-6 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <h1 className="text-3xl font-black text-gray-900 mb-6 flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-green-500" /> Chat com Projetista
        </h1>
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden h-[calc(100%-5rem)]">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center text-xl">👨‍🎨</div>
            <div className="flex-1">
              <p className="font-bold">Projetista SD Móveis</p>
              <p className="text-xs text-green-400 flex items-center gap-1"><Circle className="w-2 h-2 fill-green-400" /> Online</p>
            </div>
            <Phone className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" />
          </div>
          <div className="flex-1 p-6 space-y-4 overflow-auto" style={{ height: 'calc(100% - 8rem)' }}>
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[70%]">
                <p className="text-sm text-gray-800">Olá! Sou seu projetista na SD Móveis. Como posso ajudar?</p>
                <p className="text-[10px] text-gray-400 mt-1">10:00</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[70%]">
                <p className="text-sm">Gostaria de saber como está o andamento do meu projeto</p>
                <p className="text-[10px] text-green-200 mt-1">10:05</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[70%]">
                <p className="text-sm text-gray-800">Seu projeto está na fase de fitamento de bordas, 85% concluído! Previsão de conclusão da produção em 5 dias úteis. 🏭✨</p>
                <p className="text-[10px] text-gray-400 mt-1">10:08</p>
              </div>
            </div>
          </div>
          <div className="p-4 border-t flex items-center gap-3">
            <Paperclip className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600" />
            <input
              type="text"
              placeholder="Digite sua mensagem..."
              className="flex-1 h-12 bg-gray-100 rounded-xl px-4 outline-none text-sm"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white hover:bg-green-700 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Contact List */}
      <div className="w-96 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-500" /> CRM WhatsApp
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('https://api-whatsapp-sdmoveis.onrender.com/instance/connect/SD-Moveis', {
                      headers: { 'apikey': 'Mv06061991' }
                    });
                    const data = await res.json();
                    if (data.base64) {
                      const newWindow = window.open('', '_blank');
                      newWindow?.document.write(`
                        <html style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                          <div style="background:white;padding:40px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.1);text-align:center;">
                            <h1 style="color:#25D366;margin-bottom:20px;">Ligar SD Móveis ao WhatsApp</h1>
                            <img src="${data.base64}" style="width:300px;height:300px;border:2px solid #eee;border-radius:10px;padding:10px;" />
                            <p style="margin-top:20px;color:#666;">Abra seu WhatsApp > Dispositivos Vinculados > Escanear QR Code</p>
                          </div>
                        </html>
                      `);
                    } else if (data.instance?.state === 'open' || data.error === 'Instance already connected') {
                      alert('Seu WhatsApp já está conectado e pronto para uso!');
                    } else {
                      alert('API em carregamento, aguarde 30 segundos e tente de novo.');
                    }
                  } catch (err) {
                    alert('Erro ao conectar na API. Verifique se ela está Live no Render.');
                  }
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition"
              >
                Conectar Oficial
              </button>
              <button className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar contato..." className="w-full h-10 bg-gray-100 rounded-xl pl-10 pr-4 text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['all', 'lead', 'negotiation', 'client', 'after_sales'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? 'Todos' : statusColors[s]?.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredContacts.map(contact => (
            <button key={contact.id} onClick={() => setSelectedContact(contact)} className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b ${selectedContact?.id === contact.id ? 'bg-green-50' : ''}`}>
              <div className="relative">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl">{contact.avatar}</div>
                {contact.online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-gray-900 text-sm truncate">{contact.name}</p>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{contact.time}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{contact.lastMessage}</p>
                <p className="text-xs text-gray-500">Especialistas em Projetados</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[contact.status].bg} ${statusColors[contact.status].text}`}>
                  {statusColors[contact.status].label}
                </span>
              </div>
              {contact.unread > 0 && (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{contact.unread}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b p-4 flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{selectedContact.avatar}</div>
              {selectedContact.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{selectedContact.name}</p>
              <p className="text-xs text-gray-500">{selectedContact.online ? '🟢 Online' : `📱 ${selectedContact.phone}`}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[selectedContact.status].bg} ${statusColors[selectedContact.status].text}`}>
                {statusColors[selectedContact.status].label}
              </span>
              <button className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"><Phone className="w-4 h-4" /></button>
              <button className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Video className="w-4 h-4" /></button>
              <button className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"><MoreVertical className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmMGYwZjAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjLTIuMjEgMC00LTEuNzktNC00czEuNzktNCA0LTQgNCAxLjc5IDQgNC0xLjc5IDQtNCA0eiIvPjwvZz48L2c+PC9zdmc+')] bg-gray-50">
            {contactMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${msg.sender === 'user' ? 'bg-green-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'}`}>
                  <p className="text-sm">{msg.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    <p className={`text-[10px] ${msg.sender === 'user' ? 'text-green-200' : 'text-gray-400'}`}>{msg.time}</p>
                    {msg.sender === 'user' && <CheckCircle className={`w-3 h-3 ${msg.status === 'read' ? 'text-blue-300' : 'text-green-200'}`} />}
                  </div>
                </div>
              </div>
            ))}
            {contactMessages.length === 0 && (
              <div className="text-center text-gray-400 py-20">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda. Inicie a conversa!</p>
              </div>
            )}
          </div>

          <div className="bg-white border-t p-4 flex items-center gap-3">
            <button className="w-10 h-10 text-gray-400 hover:text-gray-600"><Smile className="w-5 h-5" /></button>
            <button className="w-10 h-10 text-gray-400 hover:text-gray-600"><Paperclip className="w-5 h-5" /></button>
            <input
              type="text"
              placeholder="Digite uma mensagem..."
              className="flex-1 h-12 bg-gray-100 rounded-xl px-4 outline-none text-sm"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white hover:bg-green-700 transition-colors shadow-lg">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Selecione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMWhatsApp;
