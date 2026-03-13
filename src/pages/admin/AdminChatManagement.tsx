import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, MessageCircle, Shield, Plus, Trash2, Edit2, Save, X, Send } from 'lucide-react';

interface AgentUser {
  user_id: string;
  username: string;
  max_chats: number;
  is_online: boolean;
  active_count: number;
}

interface FAQ { id: string; question_bn: string; question_en: string; answer_bn: string; answer_en: string; sort_order: number; is_active: boolean; }
interface CannedResp { id: string; title: string; message_bn: string; message_en: string; sort_order: number; is_active: boolean; }
interface ConvSummary { id: string; user_id: string; username: string; language: string; status: string; agent_name: string | null; created_at: string; message_count: number; }
interface ChatMessage { id: string; sender_type: string; message: string; created_at: string; }

type Tab = 'agents' | 'chats' | 'faq' | 'canned';

const AdminChatManagement = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [cannedResps, setCannedResps] = useState<CannedResp[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAgentPhone, setAddAgentPhone] = useState('');
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [editingCanned, setEditingCanned] = useState<CannedResp | null>(null);

  // Chat reply state
  const [selectedConv, setSelectedConv] = useState<ConvSummary | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgIdsRef = useRef<string>('');

  const fetchAgents = useCallback(async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'agent');
    if (!roles || roles.length === 0) { setAgents([]); return; }
    const ids = roles.map(r => r.user_id);
    const [profilesRes, settingsRes, convsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, username').in('user_id', ids),
      supabase.from('agent_settings').select('*').in('user_id', ids),
      supabase.from('chat_conversations').select('agent_id').in('agent_id', ids).eq('status', 'active'),
    ]);
    const profiles = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p.username || 'Agent']));
    const settings = Object.fromEntries((settingsRes.data || []).map(s => [s.user_id, s]));
    const counts: Record<string, number> = {};
    (convsRes.data || []).forEach(c => { if (c.agent_id) counts[c.agent_id] = (counts[c.agent_id] || 0) + 1; });
    setAgents(ids.map(id => ({
      user_id: id, username: profiles[id] || 'Agent',
      max_chats: (settings[id] as any)?.max_chats || 10,
      is_online: (settings[id] as any)?.is_online || false,
      active_count: counts[id] || 0,
    })));
  }, []);

  const fetchConversations = useCallback(async () => {
    const { data } = await supabase.from('chat_conversations').select('*').order('created_at', { ascending: false }).limit(50);
    if (!data) return;
    const userIds = [...new Set(data.map(c => c.user_id))];
    const agentIds = [...new Set(data.filter(c => c.agent_id).map(c => c.agent_id!))];
    const allIds = [...new Set([...userIds, ...agentIds])];
    const { data: profiles } = await supabase.from('profiles').select('user_id, username').in('user_id', allIds);
    const pMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.username || 'User']));
    const convIds = data.map(c => c.id);
    const { data: msgCounts } = await supabase.from('chat_messages').select('conversation_id').in('conversation_id', convIds);
    const mCounts: Record<string, number> = {};
    (msgCounts || []).forEach(m => { mCounts[m.conversation_id] = (mCounts[m.conversation_id] || 0) + 1; });
    setConversations(data.map(c => ({
      id: c.id, user_id: c.user_id, username: pMap[c.user_id] || 'User', language: c.language, status: c.status,
      agent_name: c.agent_id ? pMap[c.agent_id] || 'Agent' : null,
      created_at: c.created_at, message_count: mCounts[c.id] || 0,
    })));
  }, []);

  const fetchFaqs = useCallback(async () => {
    const { data } = await supabase.from('chat_faq').select('*').order('sort_order');
    if (data) setFaqs(data as FAQ[]);
  }, []);

  const fetchCanned = useCallback(async () => {
    const { data } = await supabase.from('chat_canned_responses').select('*').order('sort_order');
    if (data) setCannedResps(data as CannedResp[]);
  }, []);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchConversations(), fetchFaqs(), fetchCanned()]).then(() => setLoading(false));
  }, [fetchAgents, fetchConversations, fetchFaqs, fetchCanned]);

  // Fetch messages for selected conversation
  const fetchChatMessages = useCallback(async (convId: string) => {
    const isFirst = prevMsgIdsRef.current === '';
    if (isFirst) setLoadingMessages(true);
    const { data } = await supabase.from('chat_messages').select('*')
      .eq('conversation_id', convId).order('created_at', { ascending: true });
    if (data) {
      const newIdStr = data.map(m => m.id).join(',');
      if (newIdStr !== prevMsgIdsRef.current) {
        prevMsgIdsRef.current = newIdStr;
        setChatMessages(data as ChatMessage[]);
      }
    }
    if (isFirst) setLoadingMessages(false);
  }, []);

  // Poll messages when conversation selected
  useEffect(() => {
    if (!selectedConv) { prevMsgIdsRef.current = ''; return; }
    prevMsgIdsRef.current = '';
    fetchChatMessages(selectedConv.id);
    const interval = setInterval(() => fetchChatMessages(selectedConv.id), 3000);
    return () => clearInterval(interval);
  }, [selectedConv, fetchChatMessages]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendAdminReply = async () => {
    if (!replyInput.trim() || !selectedConv || !user) return;
    const text = replyInput.trim();
    setReplyInput('');
    // Optimistic update
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender_type: 'agent', message: text, created_at: new Date().toISOString() }]);
    
    // If conversation is waiting/closed, set it active with admin as agent
    if (selectedConv.status !== 'active') {
      await supabase.from('chat_conversations').update({ 
        agent_id: user.id, status: 'active', updated_at: new Date().toISOString() 
      }).eq('id', selectedConv.id);
      setSelectedConv({ ...selectedConv, status: 'active', agent_name: 'Admin' });
    }
    
    await supabase.from('chat_messages').insert({
      conversation_id: selectedConv.id, sender_id: user.id, sender_type: 'agent', message: text,
    });
  };

  const addAgent = async () => {
    if (!addAgentPhone.trim()) return;
    const { data: profile } = await supabase.from('profiles').select('user_id').eq('phone', addAgentPhone.trim()).single();
    if (!profile) { toast.error('User not found with this phone'); return; }
    const { error } = await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'agent' });
    if (error) { toast.error(error.message.includes('duplicate') ? 'Already an agent' : 'Failed to add'); return; }
    await supabase.from('agent_settings').insert({ user_id: profile.user_id, max_chats: 10, is_online: false });
    toast.success('Agent added!');
    setAddAgentPhone('');
    fetchAgents();
  };

  const removeAgent = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'agent');
    await supabase.from('agent_settings').delete().eq('user_id', userId);
    toast.success('Agent removed');
    fetchAgents();
  };

  const updateMaxChats = async (userId: string, max: number) => {
    await supabase.from('agent_settings').update({ max_chats: Math.max(1, Math.min(100, max)) }).eq('user_id', userId);
    fetchAgents();
  };

  const saveFaq = async (faq: FAQ) => {
    if (faq.id) {
      await supabase.from('chat_faq').update({
        question_bn: faq.question_bn, question_en: faq.question_en,
        answer_bn: faq.answer_bn, answer_en: faq.answer_en,
        sort_order: faq.sort_order, is_active: faq.is_active,
      }).eq('id', faq.id);
    } else {
      await supabase.from('chat_faq').insert(faq);
    }
    toast.success('FAQ saved');
    setEditingFaq(null);
    fetchFaqs();
  };

  const deleteFaq = async (id: string) => {
    await supabase.from('chat_faq').delete().eq('id', id);
    toast.success('FAQ deleted');
    fetchFaqs();
  };

  const saveCanned = async (cr: CannedResp) => {
    if (cr.id) {
      await supabase.from('chat_canned_responses').update({
        title: cr.title, message_bn: cr.message_bn, message_en: cr.message_en,
        sort_order: cr.sort_order, is_active: cr.is_active,
      }).eq('id', cr.id);
    } else {
      await supabase.from('chat_canned_responses').insert(cr);
    }
    toast.success('Saved');
    setEditingCanned(null);
    fetchCanned();
  };

  const deleteCanned = async (id: string) => {
    await supabase.from('chat_canned_responses').delete().eq('id', id);
    toast.success('Deleted');
    fetchCanned();
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground font-heading">Loading...</div>;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'agents', label: 'Agents', icon: Shield },
    { key: 'chats', label: 'Chats', icon: MessageCircle },
    { key: 'faq', label: 'FAQ', icon: Users },
    { key: 'canned', label: 'Quick Replies', icon: MessageCircle },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="font-heading font-bold text-xl">💬 Chat Management</h1>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedConv(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-heading font-bold whitespace-nowrap transition-all ${
              tab === t.key ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border text-muted-foreground'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Agents Tab */}
      {tab === 'agents' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={addAgentPhone} onChange={e => setAddAgentPhone(e.target.value)}
              placeholder="Phone number to add as agent..."
              className="flex-1 bg-card gold-border rounded-lg px-3 py-2 text-sm font-body outline-none" />
            <button onClick={addAgent} className="px-4 py-2 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground">
              <Plus size={16} />
            </button>
          </div>
          {agents.map(a => (
            <div key={a.user_id} className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${a.is_online ? 'bg-success' : 'bg-destructive'}`} />
              <div className="flex-1">
                <p className="font-heading font-bold text-sm">{a.username}</p>
                <p className="text-[10px] text-muted-foreground">Active: {a.active_count}/{a.max_chats}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={a.max_chats} min={1} max={100}
                  onChange={e => updateMaxChats(a.user_id, parseInt(e.target.value) || 10)}
                  className="w-16 bg-secondary rounded px-2 py-1 text-sm text-center outline-none" />
                <button onClick={() => removeAgent(a.user_id)} className="p-1.5 text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {agents.length === 0 && <p className="text-center text-muted-foreground py-6 font-heading">No agents yet</p>}
        </div>
      )}

      {/* Chats Tab */}
      {tab === 'chats' && (
        <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: '60vh' }}>
          {/* Conversation List */}
          <div className={`space-y-2 ${selectedConv ? 'hidden md:block' : ''} md:w-1/3 flex-shrink-0`}>
            {conversations.map(c => (
              <button key={c.id} onClick={() => setSelectedConv(c)}
                className={`w-full bg-card rounded-xl p-3 gold-border flex items-center gap-3 text-left transition-all ${selectedConv?.id === c.id ? 'ring-2 ring-primary' : ''}`}>
                <span className="text-lg">{c.status === 'active' ? '🟢' : c.status === 'waiting' ? '⏳' : '🔒'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-sm">{c.username} <span className="text-muted-foreground font-normal">({c.language === 'bn' ? '🇧🇩' : '🇬🇧'})</span></p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.agent_name ? `Agent: ${c.agent_name}` : 'No agent'} • {c.message_count} msgs
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    c.status === 'active' ? 'bg-success/20 text-success' : c.status === 'waiting' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>{c.status}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </button>
            ))}
            {conversations.length === 0 && <p className="text-center text-muted-foreground py-6 font-heading">No conversations yet</p>}
          </div>

          {/* Chat Panel */}
          {selectedConv && (
            <div className="flex-1 bg-card rounded-xl gold-border flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedConv(null)} className="md:hidden p-1 text-muted-foreground">
                    <X size={18} />
                  </button>
                  <MessageCircle size={18} className="text-primary" />
                  <div>
                    <p className="font-heading font-bold text-sm">{selectedConv.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedConv.language === 'bn' ? '🇧🇩 Bangla' : '🇬🇧 English'} • {selectedConv.status}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '50vh' }}>
                {loadingMessages && <p className="text-center text-muted-foreground text-xs">Loading...</p>}
                {chatMessages.map(msg => (
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
                <div ref={messagesEndRef} />
              </div>

              {selectedConv.status !== 'closed' && (
                <div className="p-3 flex gap-2 border-t border-border">
                  <input type="text" value={replyInput} onChange={e => setReplyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAdminReply()}
                    placeholder="Type admin reply..."
                    className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary font-body" />
                  <button onClick={sendAdminReply}
                    className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center active:scale-90 transition-transform">
                    <Send size={16} className="text-primary-foreground" />
                  </button>
                </div>
              )}
            </div>
          )}

          {!selectedConv && (
            <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-heading font-bold">Select a conversation to reply</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAQ Tab */}
      {tab === 'faq' && (
        <div className="space-y-3">
          <button onClick={() => setEditingFaq({ id: '', question_bn: '', question_en: '', answer_bn: '', answer_en: '', sort_order: faqs.length, is_active: true })}
            className="w-full p-3 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground flex items-center justify-center gap-2">
            <Plus size={16} /> Add FAQ
          </button>
          {editingFaq && (
            <div className="bg-card rounded-xl p-4 gold-border space-y-2">
              <input type="text" value={editingFaq.question_bn} onChange={e => setEditingFaq({ ...editingFaq, question_bn: e.target.value })}
                placeholder="Question (Bangla)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="text" value={editingFaq.question_en} onChange={e => setEditingFaq({ ...editingFaq, question_en: e.target.value })}
                placeholder="Question (English)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none" />
              <textarea value={editingFaq.answer_bn} onChange={e => setEditingFaq({ ...editingFaq, answer_bn: e.target.value })}
                placeholder="Answer (Bangla)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none min-h-[60px]" />
              <textarea value={editingFaq.answer_en} onChange={e => setEditingFaq({ ...editingFaq, answer_en: e.target.value })}
                placeholder="Answer (English)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none min-h-[60px]" />
              <div className="flex gap-2">
                <button onClick={() => saveFaq(editingFaq)} className="flex-1 py-2 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground">
                  <Save size={14} className="inline mr-1" /> Save
                </button>
                <button onClick={() => setEditingFaq(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
          {faqs.map(faq => (
            <div key={faq.id} className="bg-card rounded-xl p-3 gold-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm">{faq.question_bn}</p>
                  <p className="text-xs text-muted-foreground">{faq.question_en}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingFaq(faq)} className="p-1.5 text-primary"><Edit2 size={14} /></button>
                  <button onClick={() => deleteFaq(faq.id)} className="p-1.5 text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Canned Responses Tab */}
      {tab === 'canned' && (
        <div className="space-y-3">
          <button onClick={() => setEditingCanned({ id: '', title: '', message_bn: '', message_en: '', sort_order: cannedResps.length, is_active: true })}
            className="w-full p-3 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground flex items-center justify-center gap-2">
            <Plus size={16} /> Add Quick Reply
          </button>
          {editingCanned && (
            <div className="bg-card rounded-xl p-4 gold-border space-y-2">
              <input type="text" value={editingCanned.title} onChange={e => setEditingCanned({ ...editingCanned, title: e.target.value })}
                placeholder="Title" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none" />
              <textarea value={editingCanned.message_bn} onChange={e => setEditingCanned({ ...editingCanned, message_bn: e.target.value })}
                placeholder="Message (Bangla)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none min-h-[60px]" />
              <textarea value={editingCanned.message_en} onChange={e => setEditingCanned({ ...editingCanned, message_en: e.target.value })}
                placeholder="Message (English)" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none min-h-[60px]" />
              <div className="flex gap-2">
                <button onClick={() => saveCanned(editingCanned)} className="flex-1 py-2 rounded-lg gold-gradient font-heading font-bold text-sm text-primary-foreground">
                  <Save size={14} className="inline mr-1" /> Save
                </button>
                <button onClick={() => setEditingCanned(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
          {cannedResps.map(cr => (
            <div key={cr.id} className="bg-card rounded-xl p-3 gold-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm">{cr.title}</p>
                  <p className="text-xs text-muted-foreground">{cr.message_bn}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingCanned(cr)} className="p-1.5 text-primary"><Edit2 size={14} /></button>
                  <button onClick={() => deleteCanned(cr.id)} className="p-1.5 text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminChatManagement;
