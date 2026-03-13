import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, ExternalLink, Globe, ArrowLeft, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: number;
}

interface FAQ {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
}

type ChatPhase = 'lang' | 'menu' | 'faq' | 'chat';

const TELEGRAM_LINK = 'https://t.me/LuckyWinSupport';

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

const SupportChat = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [phase, setPhase] = useState<ChatPhase>('lang');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentAssigned, setAgentAssigned] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgIdsRef = useRef<string>('');
  const lastAgentMsgTimeRef = useRef<number>(0);
  const realtimeChannelRef = useRef<any>(null);

  // Listen for global open event
  useEffect(() => {
    const handler = () => { setHidden(false); setMinimized(false); setOpen(true); };
    window.addEventListener('open-support-chat', handler);
    return () => window.removeEventListener('open-support-chat', handler);
  }, []);

  // Fetch FAQs
  useEffect(() => {
    supabase.from('chat_faq').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setFaqs(data as FAQ[]);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isAgentTyping]);

  // Fetch messages once and map them
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    const { data } = await supabase.from('chat_messages').select('*')
      .eq('conversation_id', conversationId).order('created_at', { ascending: true });

    if (data) {
      const newIdStr = data.map(m => m.id).join(',');
      if (newIdStr !== prevMsgIdsRef.current) {
        prevMsgIdsRef.current = newIdStr;
        const mapped = data.map((m: any) => ({
          id: m.id,
          text: m.message,
          sender: (m.sender_type === 'user' ? 'user' : m.sender_type === 'system' ? 'system' : 'agent') as 'user' | 'agent' | 'system',
          timestamp: new Date(m.created_at).getTime(),
        }));
        setMessages(mapped);
      }
    }
  }, [conversationId]);

  // Check conversation status + agent info
  const checkConversationStatus = useCallback(async () => {
    if (!conversationId) return;

    const { data: conv } = await supabase.from('chat_conversations').select('agent_id, status')
      .eq('id', conversationId).single();
    if (conv?.agent_id && conv.status === 'active') {
      if (!agentAssigned) {
        const { data: profile } = await supabase.from('profiles').select('username')
          .eq('user_id', conv.agent_id).single();
        setAgentName(profile?.username || 'Agent');
        const { data: settings } = await supabase.from('agent_settings').select('is_online')
          .eq('user_id', conv.agent_id).single();
        setAgentOnline(settings?.is_online || false);
      }
      setAgentAssigned(true);
      setWaiting(false);
      setQueuePosition(null);
    } else if (conv?.status === 'waiting') {
      const { data: waitingConvs } = await supabase.from('chat_conversations')
        .select('id, created_at').eq('status', 'waiting').order('created_at', { ascending: true });
      if (waitingConvs) {
        const pos = waitingConvs.findIndex(c => c.id === conversationId);
        setQueuePosition(pos >= 0 ? pos + 1 : null);
      }
    }
  }, [conversationId, agentAssigned]);

  // Realtime subscription for chat messages and conversation updates
  useEffect(() => {
    if (!conversationId || phase !== 'chat') return;

    // Initial fetch
    fetchMessages();
    checkConversationStatus();

    // Subscribe to new messages via Realtime
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
        () => { fetchMessages(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `id=eq.${conversationId}` },
        () => { checkConversationStatus(); }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [conversationId, phase, fetchMessages, checkConversationStatus]);

  const startConversation = async () => {
    if (!user) return;
    setWaiting(true);
    const { data: conv } = await supabase.from('chat_conversations').insert({
      user_id: user.id, language: lang, status: 'waiting',
    }).select().single();
    if (conv) {
      setConversationId(conv.id);
      await api.rpc('assign_agent_to_conversation', { p_conversation_id: conv.id });
      setPhase('chat');
      await supabase.from('chat_messages').insert({
        conversation_id: conv.id, sender_id: user.id, sender_type: 'system',
        message: 'Chat started. You will be notified when an agent connects.',
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || !user) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user', timestamp: Date.now() }]);
    // Simulate typing indicator from agent side after user sends
    setIsAgentTyping(true);
    setTimeout(() => setIsAgentTyping(false), 4000);
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId, sender_id: user.id, sender_type: 'user', message: text,
    });
  };

  const handleFaqClick = (faq: FAQ) => {
    const answer = lang === 'bn' ? faq.answer_bn : faq.answer_en;
    setMessages([{ id: Date.now().toString(), text: answer, sender: 'system', timestamp: Date.now() }]);
  };

  const resetChat = () => {
    setPhase('lang');
    setMessages([]);
    setConversationId(null);
    setAgentAssigned(false);
    setAgentName(null);
    setAgentOnline(false);
    setWaiting(false);
    setQueuePosition(null);
    setIsAgentTyping(false);
    prevMsgIdsRef.current = '';
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  };

  const t = {
    bn: {
      welcome: 'Select Language',
      menu: 'How can we help?',
      faq: '⚡ Quick Solutions',
      human: '👨‍💼 Human Agent',
      telegram: '📱 Telegram Support',
      waiting: 'Waiting for agent...',
      connected: '✅ Agent connected!',
      type: 'Type a message...',
      back: 'Back',
      faqTitle: 'Frequently Asked',
      queue: 'Your position in queue',
    },
    en: {
      welcome: 'Select Language',
      menu: 'How can we help?',
      faq: '⚡ Quick Solutions',
      human: '👨‍💼 Human Agent',
      telegram: '📱 Telegram Support',
      waiting: 'Waiting for agent...',
      connected: '✅ Agent connected!',
      type: 'Type a message...',
      back: 'Back',
      faqTitle: 'Frequently Asked',
      queue: 'Your position in queue',
    },
  };

  const txt = t[lang];

  // Header subtitle for chat phase
  const getChatSubtitle = () => {
    if (agentAssigned && agentName) {
      return (
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-green-400' : 'bg-muted-foreground/50'}`} />
          <span className="text-[10px] text-primary-foreground/70">{agentName} • {agentOnline ? 'Online' : 'Offline'}</span>
        </div>
      );
    }
    if (waiting) {
      return <p className="text-[10px] text-primary-foreground/70">{txt.waiting}</p>;
    }
    return <p className="text-[10px] text-primary-foreground/70">Online</p>;
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && !hidden && !minimized && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full gold-gradient flex items-center justify-center shadow-lg active:scale-95 transition-transform">
            <MessageCircle size={26} className="text-primary-foreground" />
            <span className="absolute w-full h-full rounded-full gold-gradient animate-ping opacity-30" />
            <button onClick={(e) => { e.stopPropagation(); setHidden(true); }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
              <X size={10} className="text-destructive-foreground" />
            </button>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Minimized */}
      <AnimatePresence>
        {minimized && !hidden && (
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={() => { setMinimized(false); setOpen(true); }}
            className="fixed bottom-24 right-4 z-50 flex items-center gap-2 gold-gradient rounded-full px-4 py-2.5 shadow-lg active:scale-95 transition-transform">
            <MessageCircle size={18} className="text-primary-foreground" />
            <span className="text-xs font-heading font-bold text-primary-foreground">Support</span>
            <button onClick={(e) => { e.stopPropagation(); setMinimized(false); setHidden(true); }}
              className="ml-1 w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <X size={10} className="text-primary-foreground" />
            </button>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 100, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }} transition={{ type: 'spring', damping: 20 }}
            className="fixed bottom-20 right-3 left-3 z-50 bg-card rounded-2xl gold-border overflow-hidden flex flex-col"
            style={{ maxHeight: '70vh', height: '500px' }}>

            {/* Header */}
            <div className="gold-gradient p-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {phase !== 'lang' && (
                  <button onClick={() => phase === 'chat' ? resetChat() : setPhase('menu')} className="p-1">
                    <ArrowLeft size={18} className="text-primary-foreground" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm">
                  {agentAssigned ? <User size={16} className="text-primary-foreground" /> : '💬'}
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-primary-foreground">
                    {agentAssigned && agentName ? agentName : 'Lucky Win BD Support'}
                  </p>
                  {getChatSubtitle()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setOpen(false); setMinimized(true); }} className="p-1.5" title="Minimize">
                  <span className="block w-4 h-0.5 bg-primary-foreground rounded" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5">
                  <X size={18} className="text-primary-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">

              {/* Phase: Language Selection */}
              {phase === 'lang' && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Globe size={40} className="text-primary" />
                  <p className="font-heading font-bold text-lg">{txt.welcome}</p>
                  <div className="flex gap-3">
                    <button onClick={() => { setLang('bn'); setPhase('menu'); }}
                      className="px-6 py-3 rounded-xl gold-gradient font-heading font-bold text-primary-foreground active:scale-95 transition-transform">
                      🇧🇩 Bangla
                    </button>
                    <button onClick={() => { setLang('en'); setPhase('menu'); }}
                      className="px-6 py-3 rounded-xl bg-secondary font-heading font-bold text-foreground active:scale-95 transition-transform">
                      🇬🇧 English
                    </button>
                  </div>
                </div>
              )}

              {/* Phase: Menu */}
              {phase === 'menu' && (
                <div className="flex flex-col gap-3 pt-4">
                  <p className="font-heading font-bold text-center text-lg mb-2">{txt.menu}</p>
                  <button onClick={() => setPhase('faq')}
                    className="w-full p-4 rounded-xl bg-secondary text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-heading font-bold text-sm">{txt.faq}</p>
                      <p className="text-xs text-muted-foreground">Quick answers to common questions</p>
                    </div>
                  </button>
                  <button onClick={startConversation} disabled={!user}
                    className="w-full p-4 rounded-xl bg-secondary text-left flex items-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50">
                    <span className="text-2xl">👨‍💼</span>
                    <div>
                      <p className="font-heading font-bold text-sm">{txt.human}</p>
                      <p className="text-xs text-muted-foreground">Talk to a live agent</p>
                    </div>
                  </button>
                  <a href={TELEGRAM_LINK} target="_blank" rel="noopener noreferrer"
                    className="w-full p-4 rounded-xl bg-secondary text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <span className="text-2xl">📱</span>
                    <div>
                      <p className="font-heading font-bold text-sm">{txt.telegram}</p>
                      <p className="text-xs text-muted-foreground">24/7</p>
                    </div>
                    <ExternalLink size={14} className="ml-auto text-muted-foreground" />
                  </a>
                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">Login required for agent chat</p>
                  )}
                </div>
              )}

              {/* Phase: FAQ */}
              {phase === 'faq' && (
                <div className="space-y-2 pt-2">
                  <p className="font-heading font-bold text-center mb-3">{txt.faqTitle}</p>
                  {faqs.map(faq => (
                    <button key={faq.id} onClick={() => handleFaqClick(faq)}
                      className="w-full text-left p-3 rounded-xl bg-secondary active:scale-[0.98] transition-transform">
                      <p className="font-heading font-semibold text-sm">{lang === 'bn' ? faq.question_bn : faq.question_en}</p>
                    </button>
                  ))}
                  {messages.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-sm">{messages[messages.length - 1].text}</p>
                    </div>
                  )}
                  <button onClick={startConversation} disabled={!user}
                    className="w-full mt-3 p-3 rounded-xl gold-gradient text-primary-foreground font-heading font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
                    {txt.human}
                  </button>
                </div>
              )}

              {/* Phase: Chat */}
              {phase === 'chat' && (
                <>
                  {waiting && !agentAssigned && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                        <MessageCircle size={24} className="text-primary" />
                      </div>
                      <p className="font-heading font-bold text-sm text-muted-foreground">{txt.waiting}</p>
                      {queuePosition !== null && (
                        <div className="bg-secondary rounded-xl px-4 py-2 text-center">
                          <p className="text-xs text-muted-foreground">{txt.queue}</p>
                          <p className="font-heading font-bold text-2xl text-primary">#{queuePosition}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                      {msg.sender === 'system' ? (
                        <div className="bg-secondary rounded-full px-3 py-1 text-[11px] text-muted-foreground">{msg.text}</div>
                      ) : (
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          msg.sender === 'user'
                            ? 'gold-gradient text-primary-foreground rounded-br-sm'
                            : 'bg-secondary text-foreground rounded-bl-sm'
                        }`}>
                          {msg.sender === 'agent' && agentName && (
                            <p className="text-[10px] font-bold text-primary mb-0.5">{agentName}</p>
                          )}
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ))}
                  {isAgentTyping && agentAssigned && <TypingIndicator />}
                </>
              )}
            </div>

            {/* Input (only in chat phase) */}
            {phase === 'chat' && (
              <div className="p-3 pt-1 flex gap-2 flex-shrink-0">
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={txt.type}
                  className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary font-body" />
                <button onClick={sendMessage}
                  className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center active:scale-90 transition-transform">
                  <Send size={16} className="text-primary-foreground" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupportChat;
