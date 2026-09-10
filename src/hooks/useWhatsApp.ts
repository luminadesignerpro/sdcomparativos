import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WhatsAppConversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: string;
  lead_status: string;
  last_message_at: string;
  lastMessage?: string;
  unreadCount?: number;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  status: string;
  created_at: string;
}

// Use `any` cast on supabase client for tables not yet in the generated types
const db = supabase as any;

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

export function useWhatsApp() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const { toast } = useToast();
  // Ref to track which conversation is currently open (for realtime updates)
  const activeConversationId = useRef<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db
        .from('whatsapp_conversations')
        .select(`
          *,
          whatsapp_messages (
            id,
            content,
            direction,
            status,
            created_at
          )
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const enrichedConversations = (data || []).map((conv: any) => {
        const msgs = conv.whatsapp_messages || [];
        const sortedMsgs = msgs.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastMessage = sortedMsgs[0];
        const unreadCount = msgs.filter((m: any) => 
          m.direction === 'inbound' && m.status !== 'read'
        ).length;

        return {
          id: conv.id,
          phone_number: conv.phone_number,
          contact_name: conv.contact_name,
          status: conv.status,
          lead_status: conv.lead_status,
          last_message_at: conv.last_message_at,
          lastMessage: lastMessage?.content || '',
          unreadCount,
        };
      });

      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as conversas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await db
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages((data || []) as WhatsAppMessage[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as mensagens.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const sendMessage = useCallback(async (conversationId: string, message: string, mediaUrl?: string, fileName?: string) => {
    setSendingMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { conversationId, message, mediaUrl, fileName },
      });

      if (error) throw error;

      const isReal = data?.mode === 'real';
      toast({
        title: isReal ? '✅ Mensagem Enviada' : '📋 Modo Simulação',
        description: isReal
          ? 'Mensagem enviada via WhatsApp com sucesso!'
          : 'Evolution API não configurada. Mensagem salva localmente.',
      });

      await fetchMessages(conversationId);
      await fetchConversations();

      return { success: true, message: data?.message, mode: data?.mode };
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSendingMessage(false);
    }
  }, [fetchMessages, fetchConversations, toast]);

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload: any) => {
          console.log('New message realtime:', payload);
          // Always refresh conversation list (unread count, last message)
          fetchConversations();
          // Also refresh messages if the incoming message belongs to the open conversation
          const newMsg = payload.new as WhatsAppMessage;
          
          if (newMsg?.direction === 'inbound') {
            playMessageSound();
          }

          if (newMsg?.conversation_id && newMsg.conversation_id === activeConversationId.current) {
            setMessages((prev) => {
              // Deduplicate by id
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  // Call this whenever the selected conversation changes so realtime knows where to append
  const setActiveConversation = useCallback((id: string | null) => {
    activeConversationId.current = id;
  }, []);

  return {
    conversations,
    messages,
    loading,
    sendingMessage,
    fetchConversations,
    fetchMessages,
    sendMessage,
    setActiveConversation,
  };
}
