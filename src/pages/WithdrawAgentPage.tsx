import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface LuckyAgent {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  telegram_link: string | null;
}

interface AgentNumber {
  agent_id: string;
  payment_method: string;
  number: string;
}

const WithdrawAgentPage = () => {
  const navigate = useNavigate();
  const { balance, withdraw } = useWallet();
  const [agents, setAgents] = useState<LuckyAgent[]>([]);
  const [agentNumbers, setAgentNumbers] = useState<AgentNumber[]>([]);
  const [methods, setMethods] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<LuckyAgent | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getLuckyAgentData();
        const agentsList = data.agents || [];
        const methodsList = (data.paymentMethods || []).map((m) => ({ id: m.id, name: m.name }));
        const numbersList = (data.agentPaymentNumbers || []) as AgentNumber[];
        setAgents(agentsList as LuckyAgent[]);
        if (agentsList.length > 0) setSelectedAgent(agentsList[0] as LuckyAgent);
        setAgentNumbers(numbersList);
        setMethods(methodsList);
        if (methodsList.length > 0) setSelectedMethod(methodsList[0].name);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const availableMethods = useMemo(() => {
    if (!selectedAgent) return [];
    const agentNums = agentNumbers.filter(n => n.agent_id === selectedAgent.user_id);
    const methodNames = [...new Set(agentNums.map(n => n.payment_method))];
    return methods.filter(m => methodNames.includes(m.name));
  }, [selectedAgent, agentNumbers, methods]);


  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some(m => m.name === selectedMethod)) {
      setSelectedMethod(availableMethods[0].name);
    }
  }, [availableMethods, selectedMethod]);

  const handleSubmit = async () => {
    if (!selectedAgent) return;
    const amt = Number(amount);
    if (amt < 500) { toast.error('Minimum withdraw ৳500'); return; }
    if (!walletNumber || walletNumber.length < 11) { toast.error('Enter valid wallet number'); return; }
    if (!selectedMethod) { toast.error('Select payment method'); return; }
    setSubmitting(true);
    const ok = await withdraw(amt, selectedMethod, walletNumber, selectedAgent.user_id);
    setSubmitting(false);
    if (!ok) { toast.error('Insufficient balance'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen navy-gradient">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/account')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12 px-4">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="font-heading font-bold text-xl gold-text mb-2">Withdraw Requested!</h2>
          <p className="text-muted-foreground text-sm mb-2">৳{Number(amount).toLocaleString()} via {selectedAgent?.username || 'Agent'}</p>
          <p className="text-muted-foreground text-xs mb-6">Your request is pending agent approval. You will receive notification once approved.</p>
          <button onClick={() => navigate('/account')} className="px-8 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground">
            Back to Account
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="min-h-screen navy-gradient">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/withdraw')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
        </div>
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground">No Lucky Agents available.</p>
          <button onClick={() => navigate('/withdraw')} className="mt-4 text-primary font-bold">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen navy-gradient">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/withdraw')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">💸 Withdraw via Lucky Agent</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="font-heading font-bold text-2xl text-primary">৳{balance.toLocaleString()}</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Select Agent</label>
          <select
            value={selectedAgent?.user_id || ''}
            onChange={e => setSelectedAgent(agents.find(a => a.user_id === e.target.value) || null)}
            className="w-full bg-card rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
          >
            {agents.map(a => (
              <option key={a.user_id} value={a.user_id}>{a.username || 'Agent'}</option>
            ))}
          </select>
        </div>

        {selectedAgent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center gold-border">
              {selectedAgent.avatar_url ? (
                <img src={selectedAgent.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>
            <div>
              <p className="font-heading font-bold text-sm">{selectedAgent.username || 'Agent'}</p>
              <p className="text-[10px] text-muted-foreground">Lucky Agent</p>
            </div>
          </motion.div>
        )}

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Payment Method</label>
          <div className="flex gap-2 flex-wrap">
            {availableMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(m.name)}
                className={`flex-1 min-w-[80px] py-3 rounded-xl text-center font-heading font-bold text-sm transition-colors ${
                  selectedMethod === m.name ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Amount (৳)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Min ৳500"
            className="w-full bg-card rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2 mt-2">
            {[500, 1000, 2000, 5000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className="flex-1 py-1.5 text-xs font-heading font-bold bg-secondary rounded-md hover:bg-primary hover:text-primary-foreground transition-colors">
                ৳{v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Your {selectedMethod || 'Wallet'} Number</label>
          <input
            type="tel"
            value={walletNumber}
            onChange={e => setWalletNumber(e.target.value)}
            placeholder="01XXXXXXXXX"
            maxLength={11}
            className="w-full bg-card rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Enter the number where you want to receive the money</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Withdraw Request'}
        </button>
      </div>
    </div>
  );
};

export default WithdrawAgentPage;
