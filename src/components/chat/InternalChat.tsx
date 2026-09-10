import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, MessageCircle, Shield, ChevronDown } from 'lucide-react';

interface InternalChatProps { userName: string; userRole: 'ADMIN' | 'CLIENT' | 'EMPLOYEE'; }

type RecipientMode = 'all' | 'clients' | 'employees' | string; // string = specific person JSON

const playMessageSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (time: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(freq, time);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + dur - 0.02);
      
      osc.start(time);
      osc.stop(time + dur);
    };
    
    // High-pitched notification chime: C6 (1046.5Hz) followed by E6 (1318.51Hz)
    playTone(ctx.currentTime, 1046.5, 0.12);
    playTone(ctx.currentTime + 0.08, 1318.5, 0.2);
  } catch (error) {
    console.error('Erro ao tocar som de mensagem:', error);
  }
};

export default function InternalChat({ userName, userRole }: InternalChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [individualRecipients, setIndividualRecipients] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchMessages = async () => {
    let query = (supabase as any).from('chat_messages').select('*');
    if (userRole !== 'ADMIN') {
      // Employees/clients see: their own msgs + admin broadcasts + msgs directed to their role + msgs directed to them
      query = query.or(
        `sender_name.eq.${userName},` +
        `recipient_name.eq.${userName},` +
        `and(sender_role.eq.ADMIN,recipient_name.is.null,recipient_role.is.null),` +
        `and(sender_role.eq.ADMIN,recipient_role.eq.${userRole},recipient_name.is.null)`
      );
    }
    const { data, error } = await query.order('created_at', { ascending: true }).limit(200);
    if (error) console.error('Chat fetch error:', error.message);
    if (data) setMessages(data);
    setLoading(false);
  };

  const fetchIndividualRecipients = async () => {
    if (userRole !== 'ADMIN') return;
    const { data } = await (supabase as any).from('chat_messages').select('sender_name, sender_role');
    if (data) {
      const unique = Array.from(
        new Set(
          data
            .filter((d: any) => d.sender_role !== 'ADMIN')
            .map((d: any) => JSON.stringify({ name: d.sender_name, role: d.sender_role }))
        )
      ).map((s: any) => JSON.parse(s));
      setIndividualRecipients(unique);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchIndividualRecipients();
    const channel = (supabase as any).channel('chat-internal')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const msg = payload.new;
        const isForMe =
          userRole === 'ADMIN' ||
          msg.sender_name === userName ||
          msg.recipient_name === userName ||
          (msg.sender_role === 'ADMIN' && !msg.recipient_name && !msg.recipient_role) ||
          (msg.sender_role === 'ADMIN' && msg.recipient_role === userRole && !msg.recipient_name);
        if (isForMe) {
          setMessages(prev => [...prev, msg]);
          if (msg.sender_name !== userName) {
            playMessageSound();
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userName, userRole]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const payload: any = {
      sender_name: userName,
      sender_role: userRole,
      message: text.trim(),
      created_at: new Date().toISOString(),
    };

    if (userRole === 'ADMIN') {
      if (recipientMode === 'clients') {
        payload.recipient_role = 'CLIENT';
      } else if (recipientMode === 'employees') {
        payload.recipient_role = 'EMPLOYEE';
      } else if (recipientMode !== 'all') {
        // Individual person
        try {
          const person = JSON.parse(recipientMode);
          payload.recipient_name = person.name;
          payload.recipient_role = person.role;
        } catch { /* broadcast */ }
      }
      // 'all' = no recipient set = broadcast
    } else {
      // Non-admin always sends to admin
      payload.recipient_name = 'Administrador';
      payload.recipient_role = 'ADMIN';
    }

    const { error } = await (supabase as any).from('chat_messages').insert([payload]);
    if (error) {
      console.error('Erro ao enviar:', error.message);
    } else {
      setText('');
    }
  };

  const roleColor = (role: string) => role === 'ADMIN' ? 'text-amber-500' : role === 'EMPLOYEE' ? 'text-blue-400' : 'text-green-400';
  const roleBadge = (role: string) => role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : role === 'EMPLOYEE' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400';
  const roleLabel = (role: string) => role === 'ADMIN' ? 'Admin' : role === 'EMPLOYEE' ? 'Func.' : 'Cliente';

  const getRecipientLabel = () => {
    if (recipientMode === 'all') return 'Falar com Todos';
    if (recipientMode === 'clients') return '👤 Clientes';
    if (recipientMode === 'employees') return '👷 Funcionários';
    try {
      const p = JSON.parse(recipientMode);
      return `${p.role === 'CLIENT' ? '👤' : '👷'} ${p.name}`;
    } catch { return 'Falar com Todos'; }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <header className="p-4 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/20">
            <MessageCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Chat SD</h2>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Privado & Seguro</p>
          </div>
        </div>

        {/* Admin recipient dropdown */}
        {userRole === 'ADMIN' && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10 rounded-xl px-3 py-2 outline-none font-bold transition-all"
            >
              {getRecipientLabel()}
              <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {/* Broadcast options */}
                <div className="p-2 border-b border-white/5">
                  <p className="text-white/30 text-[9px] uppercase font-black px-2 mb-1">Broadcast</p>
                  {[
                    { value: 'all', label: '📢 Falar com Todos' },
                    { value: 'clients', label: '👤 Todos os Clientes' },
                    { value: 'employees', label: '👷 Todos os Funcionários' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setRecipientMode(opt.value); setShowDropdown(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${recipientMode === opt.value ? 'bg-amber-500/20 text-amber-400' : 'text-white/70 hover:bg-white/5'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Individual recipients */}
                {individualRecipients.length > 0 && (
                  <div className="p-2">
                    <p className="text-white/30 text-[9px] uppercase font-black px-2 mb-1">Individual</p>
                    {individualRecipients.map(r => {
                      const val = JSON.stringify(r);
                      return (
                        <button
                          key={r.name}
                          onClick={() => { setRecipientMode(val); setShowDropdown(false); }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${recipientMode === val ? 'bg-amber-500/20 text-amber-400' : 'text-white/70 hover:bg-white/5'}`}
                        >
                          {r.role === 'CLIENT' ? '👤' : '👷'} {r.name}
                          <span className={`ml-2 text-[9px] px-1 py-0.5 rounded ${roleBadge(r.role)}`}>{roleLabel(r.role)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="text-center text-amber-500/50 py-8 text-xs font-bold uppercase tracking-widest animate-pulse">Conectando...</div>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
            <Shield className="w-12 h-12 text-amber-500 mb-4" />
            <p className="text-white text-sm">Nenhuma mensagem aqui.<br /><span className="text-xs">Este canal é 100% privado.</span></p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_name === userName;
          return (
            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
              <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isMe && (
                  <div className="flex items-center gap-2 px-1">
                    <span className={`text-[9px] font-black uppercase ${roleColor(msg.sender_role)}`}>{msg.sender_name}</span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-black uppercase ${roleBadge(msg.sender_role)}`}>{roleLabel(msg.sender_role)}</span>
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-amber-600 text-white rounded-tr-none' : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/5'}`}>
                  {msg.message}
                </div>
                <span className="text-[8px] text-white/20 font-bold px-1">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-black/40 border-t border-white/5">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={
              userRole === 'ADMIN'
                ? `Mensagem para: ${getRecipientLabel()}...`
                : 'Escreva sua mensagem...'
            }
            className="flex-1 bg-white/5 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm outline-none border border-white/5 focus:border-amber-500/30"
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim()}
            className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center disabled:opacity-20 hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/10"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
