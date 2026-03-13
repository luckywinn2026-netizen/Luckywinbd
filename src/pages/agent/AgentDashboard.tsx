import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Send, LogOut, RefreshCw, Users, MessageCircle, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

// Notification sound engine using Web Audio API
const playNotificationSound = (() => {
  let audioCtx: AudioContext | null = null;
  return () => {
    try {
      if (!audioCtx) audioCtx = new AudioContext();
      const ctx = audioCtx;
      const now = ctx.currentTime;
      
      // Two-tone chime: ascending notes
      [440, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.4);
      });
    } catch (e) {
      console.warn('Notification sound failed:', e);
    }
  };
})();

interface Conversation {
  id: string;
  user_id: string;
  agent_id: string | null;
  language: string;
  status: string;
  created_at: string;
  username?: string;
}

interface Message {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

interface CannedResponse {
  id: string;
  title: string;
  message_bn: string;
  message_en: string;
}

const POLL_INTERVAL = 3000;

const AgentDashboard = () => {
  const { user, signOut } = useAuth();
  const [isAgent, setIsAgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevWaitingIdsRef = useRef<Set<string>>(new Set());
  // Check agent role
  useEffect(() => {
    if (!user) return;
    api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'agent' }).then((data) => {
      setIsAgent(!!data);
      setLoading(false);
      if (data) {
        // Get/create agent settings
        supabase.from('agent_settings').select('*').eq('user_id', user.id).single().then(({ data: settings }) => {
          if (settings) {
            setIsOnline(settings.is_online);
          } else {
            supabase.from('agent_settings').insert({ user_id: user.id, max_chats: 10, is_online: false }).then(() => {});
          }
        });
      }
    });
  }, [user]);

  // Fetch canned responses
  useEffect(() => {
    if (!isAgent) return;
    supabase.from('chat_canned_responses').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setCannedResponses(data as CannedResponse[]);
    });
  }, [isAgent]);

  // Poll conversations
  const fetchConversations = useCallback(async () => {
    if (!user || !isAgent) return;
    const { data } = await supabase.from('chat_conversations').select('*')
      .or(`agent_id.eq.${user.id},and(status.eq.waiting,agent_id.is.null)`)
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false });
    if (data) {
      // Fetch usernames
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, username').in('user_id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.username]));
      
      // Check for new waiting conversations and play notification
      const currentWaitingIds = new Set(data.filter(c => c.status === 'waiting').map(c => c.id));
      const prevIds = prevWaitingIdsRef.current;
      const hasNew = [...currentWaitingIds].some(id => !prevIds.has(id));
      if (hasNew && soundEnabled && prevIds.size > 0) {
        playNotificationSound();
      }
      prevWaitingIdsRef.current = currentWaitingIds;
      
      setConversations(data.map(c => ({ ...c, username: profileMap[c.user_id] || 'User' })) as Conversation[]);
    }
  }, [user, isAgent]);

  useEffect(() => {
    if (!isAgent) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isAgent, fetchConversations]);

  // Poll messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!selectedConv) return;
    const { data } = await supabase.from('chat_messages').select('*')
      .eq('conversation_id', selectedConv).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  }, [selectedConv]);

  useEffect(() => {
    if (!selectedConv) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedConv, fetchMessages]);

  const toggleOnline = async () => {
    if (!user) return;
    const newState = !isOnline;
    await supabase.from('agent_settings').update({ is_online: newState }).eq('user_id', user.id);
    setIsOnline(newState);
    toast.success(newState ? 'You are now online' : 'You are now offline');
  };

  const claimConversation = async (convId: string) => {
    if (!user) return;
    await supabase.from('chat_conversations').update({ agent_id: user.id, status: 'active' }).eq('id', convId);
    await supabase.from('chat_messages').insert({
      conversation_id: convId, sender_id: user.id, sender_type: 'system',
      message: '✅ Agent connected',
    });
    setSelectedConv(convId);
    fetchConversations();
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv || !user) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: 'agent', message: text, created_at: new Date().toISOString() }]);
    await supabase.from('chat_messages').insert({
      conversation_id: selectedConv, sender_id: user.id, sender_type: 'agent', message: text,
    });
  };

  const sendCanned = async (cr: CannedResponse) => {
    if (!selectedConv || !user) return;
    const conv = conversations.find(c => c.id === selectedConv);
    const text = conv?.language === 'bn' ? cr.message_bn : cr.message_en;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender_type: 'agent', message: text, created_at: new Date().toISOString() }]);
    await supabase.from('chat_messages').insert({
      conversation_id: selectedConv, sender_id: user.id, sender_type: 'agent', message: text,
    });
    setShowCanned(false);
  };

  const closeConversation = async (convId: string) => {
    if (!user) return;
    await supabase.from('chat_conversations').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', convId);
    await supabase.from('chat_messages').insert({
      conversation_id: convId, sender_id: user.id, sender_type: 'system',
      message: '🔒 Chat closed',
    });
    if (selectedConv === convId) { setSelectedConv(null); setMessages([]); }
    fetchConversations();
  };

  if (loading) return <div className="min-h-screen navy-gradient flex items-center justify-center"><p className="text-primary animate-pulse font-heading text-xl">Loading...</p></div>;
  if (!isAgent) return <div className="min-h-screen navy-gradient flex items-center justify-center"><p className="text-destructive font-heading text-xl">Access Denied</p></div>;

  const activeConvs = conversations.filter(c => c.agent_id === user?.id && c.status === 'active');
  const waitingConvs = conversations.filter(c => c.status === 'waiting');

  return (
    <div className="h-screen min-h-[100dvh] overflow-hidden navy-gradient flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 min-h-0 bg-card border-r border-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-heading font-bold text-lg">💬 Agent Panel</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => setSoundEnabled(!soundEnabled)} 
                className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}>
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button onClick={async () => { await signOut(); }} className="p-2 text-destructive">
                <LogOut size={18} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleOnline}
              className={`flex-1 py-2 rounded-lg font-heading font-bold text-xs transition-all ${isOnline ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </button>
            <button onClick={fetchConversations} className="p-2 rounded-lg bg-secondary">
              <RefreshCw size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {waitingConvs.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-heading font-bold text-primary px-2 py-1">⏳ WAITING ({waitingConvs.length})</p>
              {waitingConvs.map(c => (
                <button key={c.id} onClick={() => claimConversation(c.id)}
                  className="w-full p-3 rounded-lg bg-primary/10 border border-primary/20 mb-1 text-left active:scale-[0.98] transition-transform">
                  <p className="font-heading font-bold text-sm">{c.username}</p>
                  <p className="text-[10px] text-muted-foreground">{c.language === 'bn' ? '🇧🇩 Bangla' : '🇬🇧 English'} • Tap to claim</p>
                </button>
              ))}
            </div>
          )}
          {activeConvs.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-heading font-bold text-success px-2 py-1">✅ ACTIVE ({activeConvs.length})</p>
              {activeConvs.map(c => (
                <button key={c.id} onClick={() => setSelectedConv(c.id)}
                  className={`w-full p-3 rounded-lg mb-1 text-left active:scale-[0.98] transition-all ${selectedConv === c.id ? 'bg-secondary gold-border' : 'bg-card hover:bg-secondary'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-sm">{c.username}</p>
                    <button onClick={(e) => { e.stopPropagation(); closeConversation(c.id); }}
                      className="text-[10px] text-destructive font-bold">Close</button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{c.language === 'bn' ? '🇧🇩' : '🇬🇧'} • Active</p>
                </button>
              ))}
            </div>
          )}
          {waitingConvs.length === 0 && activeConvs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-heading">No conversations</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-3 bg-card border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                <p className="font-heading font-bold text-sm">
                  {conversations.find(c => c.id === selectedConv)?.username || 'User'}
                </p>
              </div>
              <button onClick={() => setShowCanned(!showCanned)}
                className="text-xs font-heading font-bold bg-secondary px-3 py-1.5 rounded-lg">
                ⚡ Quick Reply
              </button>
            </div>

            {/* Canned responses */}
            {showCanned && (
              <div className="p-2 bg-secondary/50 border-b border-border flex gap-1.5 overflow-x-auto no-scrollbar">
                {cannedResponses.map(cr => (
                  <button key={cr.id} onClick={() => sendCanned(cr)}
                    className="flex-shrink-0 bg-card rounded-full px-3 py-1.5 text-[11px] font-heading font-semibold gold-border active:scale-95 transition-transform">
                    {cr.title}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : msg.sender_type === 'system' ? 'justify-center' : 'justify-start'}`}>
                  {msg.sender_type === 'system' ? (
                    <div className="bg-secondary rounded-full px-3 py-1 text-[11px] text-muted-foreground">{msg.message}</div>
                  ) : (
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.sender_type === 'agent'
                        ? 'gold-gradient text-primary-foreground rounded-br-sm'
                        : 'bg-secondary text-foreground rounded-bl-sm'
                    }`}>
                      {msg.message}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 flex gap-2 border-t border-border">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type reply..."
                className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary font-body" />
              <button onClick={sendMessage}
                className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center active:scale-90 transition-transform">
                <Send size={16} className="text-primary-foreground" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle size={48} className="mb-3 opacity-30" />
            <p className="font-heading font-bold">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;
