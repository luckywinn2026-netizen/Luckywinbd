import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface LuckyAgent {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  telegram_link: string | null;
}

const DepositAgentPage = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<LuckyAgent[]>([]);
  const [selected, setSelected] = useState<LuckyAgent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await api.getLuckyAgentData();
        const list = (data.agents || []).filter((p) => p.telegram_link) as LuckyAgent[];
        setAgents(list);
        if (list.length > 0) setSelected(list[0]);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const handleOpenTelegram = () => {
    if (!selected?.telegram_link) {
      toast.error('Agent has no Telegram link');
      return;
    }
    const url = selected.telegram_link.startsWith('http') ? selected.telegram_link : `https://t.me/${selected.telegram_link.replace('@', '')}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center">
        <p className="text-muted-foreground">Loading agents...</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="min-h-screen navy-gradient">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/deposit')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
        </div>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">No Lucky Agents available at the moment.</p>
          <button onClick={() => navigate('/deposit')} className="mt-4 text-primary font-bold">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen navy-gradient">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/deposit')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">💰 Deposit via Lucky Agent</h1>
      </div>

      <div className="px-4 space-y-4">
        <p className="text-sm text-muted-foreground">Select an agent and contact them on Telegram to deposit:</p>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Select Agent</label>
          <select
            value={selected?.user_id || ''}
            onChange={e => setSelected(agents.find(a => a.user_id === e.target.value) || null)}
            className="w-full bg-card rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
          >
            {agents.map(a => (
              <option key={a.user_id} value={a.user_id}>
                {a.username || 'Agent'}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl p-4 gold-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-secondary overflow-hidden flex items-center justify-center gold-border">
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div>
                <p className="font-heading font-bold text-base">{selected.username || 'Agent'}</p>
                <p className="text-xs text-muted-foreground">Lucky Agent</p>
              </div>
            </div>
            <button
              onClick={handleOpenTelegram}
              className="w-full py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <ExternalLink size={18} />
              Open Telegram
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DepositAgentPage;
