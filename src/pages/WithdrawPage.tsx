import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getRotatedAgentNumber, type AgentPaymentNumberEntry } from '@/lib/agentRotation';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
}

type AgentNumber = AgentPaymentNumberEntry;

const WithdrawPage = () => {
  const navigate = useNavigate();
  const { balance, withdraw } = useWallet();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [agentNumbers, setAgentNumbers] = useState<AgentNumber[]>([]);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [recvNumber, setRecvNumber] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawable, setWithdrawable] = useState<number | null>(null);
  const [turnover, setTurnover] = useState<{
    required_turnover: number;
    completed_turnover: number;
    remaining_turnover: number;
    locked_amount: number;
    has_pending: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getWithdrawFormData();
        if (data.paymentMethods?.length) {
          setMethods(data.paymentMethods);
          setMethod(data.paymentMethods[0]);
        }
        if (data.agentPaymentNumbers?.length) setAgentNumbers(data.agentPaymentNumbers as AgentNumber[]);
      } catch {
        setMethods([]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    api.getWithdrawableBalance().then(setWithdrawable).catch(() => setWithdrawable(null));
    api.getBonusTurnover().then(setTurnover).catch(() => setTurnover(null));
  }, [balance]);

  // Get the active rotated agent for the selected method.
  const currentAgent = useMemo(() => {
    if (!method) return null;
    return getRotatedAgentNumber(agentNumbers, method.name);
  }, [method, agentNumbers]);

  const handleSubmit = async () => {
    if (!method) return;
    const amt = Number(amount);
    if (amt < 500) { toast.error('Minimum withdraw ৳500'); return; }
    if (!recvNumber || recvNumber.length < 11) { toast.error('Enter valid number'); return; }
    setSubmitting(true);
    const ok = await withdraw(amt, method.name, recvNumber, currentAgent?.agent_id);
    setSubmitting(false);
    if (!ok) { toast.error('Insufficient balance'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen navy-gradient">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/withdraw')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12 px-4">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="font-heading font-bold text-xl gold-text mb-2">Withdraw Requested!</h2>
          <p className="text-muted-foreground text-sm mb-2">৳{Number(amount).toLocaleString()} via {method?.name}</p>
          <p className="text-muted-foreground text-xs mb-6">Your request is pending agent approval.</p>
          <button onClick={() => navigate('/account')} className="px-8 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground">
            Back to Account
          </button>
        </motion.div>
      </div>
    );
  }

  if (!method) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen navy-gradient">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/withdraw')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">💸 Withdraw</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-xl p-4 gold-border text-center">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="font-heading font-bold text-2xl text-primary">৳{balance.toLocaleString()}</p>
          {withdrawable != null && withdrawable < balance && (
            <p className="text-xs text-amber-400 mt-1">
              Withdrawable: ৳{withdrawable.toLocaleString()} (complete bonus turnover to unlock more)
            </p>
          )}
          {turnover?.has_pending && turnover.required_turnover > 0 && (
            <div className="mt-3 pt-3 border-t border-border text-left">
              <p className="text-xs text-muted-foreground mb-1">Bonus Turnover Progress</p>
              <p className="text-sm font-heading font-bold">
                ৳{turnover.completed_turnover.toLocaleString()} / ৳{turnover.required_turnover.toLocaleString()} bet
              </p>
              <p className="text-[10px] text-amber-400 mt-0.5">
                ৳{turnover.remaining_turnover.toLocaleString()} more to unlock ৳{turnover.locked_amount.toLocaleString()} bonus
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Payment Method</label>
          <div className="flex gap-2 flex-wrap">
            {methods.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m)}
                className={`flex-1 min-w-[80px] py-3 rounded-xl text-center font-heading font-bold text-sm transition-colors ${
                  method.id === m.id ? 'gold-gradient text-primary-foreground' : 'bg-card gold-border'
                }`}
              >
                {m.icon} {m.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Amount (৳)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Min ৳500"
            className="w-full bg-card rounded-lg px-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
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
          <label className="text-xs text-muted-foreground block mb-1">{method.name} Number</label>
          <input
            type="tel"
            value={recvNumber}
            onChange={e => setRecvNumber(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="w-full bg-card rounded-lg px-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
          />
          {currentAgent && Number(currentAgent.rotation_hours ?? 0) > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              This withdrawal request will go to the currently active {method.name} agent for {Number(currentAgent.rotation_hours)} hour{Number(currentAgent.rotation_hours) > 1 ? 's' : ''}.
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Request Withdrawal'}
        </button>
      </div>
    </div>
  );
};

export default WithdrawPage;
