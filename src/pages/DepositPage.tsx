import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Copy, CheckCircle, AlertCircle, ChevronDown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatBonusRuleSummary } from '@/lib/bonusRuleUi';
import { useBonusRules } from '@/hooks/useBonusRules';
import { getRotatedAgentNumber, type AgentPaymentNumberEntry } from '@/lib/agentRotation';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  icon_url: string | null;
  number: string;
  color_from: string;
  color_to: string;
  bonus: string | null;
}

type Step = 'method' | 'type' | 'amount' | 'done';

interface TransactionType {
  id: string;
  type_id: string;
  label: string;
  icon: string;
  description: string;
}

interface MethodNumber {
  payment_method_id: string;
  transaction_type_id: string;
  number: string;
}

type AgentNumber = AgentPaymentNumberEntry;

// TrxID validation rules per payment method
const TRX_RULES: Record<string, { pattern: RegExp; minLen: number; maxLen: number; hint: string }> = {
  bKash: { pattern: /^[A-Za-z0-9]+$/, minLen: 8, maxLen: 20, hint: 'bKash TrxID must be 8-20 alphanumeric characters (e.g. ABC12345XY)' },
  Nagad: { pattern: /^[A-Za-z0-9]+$/, minLen: 8, maxLen: 20, hint: 'Nagad TrxID must be 8-20 alphanumeric characters' },
  Rocket: { pattern: /^[A-Za-z0-9]+$/, minLen: 6, maxLen: 20, hint: 'Rocket TrxID must be 6-20 alphanumeric characters' },
  UPay: { pattern: /^[A-Za-z0-9]+$/, minLen: 6, maxLen: 20, hint: 'UPay TrxID must be 6-20 alphanumeric characters' },
  TAP: { pattern: /^[A-Za-z0-9]+$/, minLen: 6, maxLen: 20, hint: 'TAP TrxID must be 6-20 alphanumeric characters' },
  OKWallet: { pattern: /^[A-Za-z0-9]+$/, minLen: 6, maxLen: 20, hint: 'OKWallet TrxID must be 6-20 alphanumeric characters' },
};

const DEFAULT_RULE = { pattern: /^[A-Za-z0-9]+$/, minLen: 6, maxLen: 30, hint: 'TrxID must be 6-30 alphanumeric characters' };

const DepositPage = () => {
  const navigate = useNavigate();
  const { deposit } = useWallet();
  const { rules: depositBonusRules } = useBonusRules({ triggerTypes: ['deposit_approved', 'first_deposit_approved'] });
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [txnTypes, setTxnTypes] = useState<TransactionType[]>([]);
  const [methodNumbers, setMethodNumbers] = useState<MethodNumber[]>([]);
  const [agentNumbers, setAgentNumbers] = useState<AgentNumber[]>([]);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [txnType, setTxnType] = useState<TransactionType | null>(null);
  const [step, setStep] = useState<Step>('method');
  const [amount, setAmount] = useState('');
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [senderNum, setSenderNum] = useState('');
  const [trxId, setTrxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trxError, setTrxError] = useState('');
  const [checkingDup, setCheckingDup] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getDepositFormData();
        if (data.paymentMethods?.length) setMethods(data.paymentMethods as PaymentMethod[]);
        if (data.transactionTypes?.length) setTxnTypes(data.transactionTypes as TransactionType[]);
        if (data.paymentMethodNumbers?.length) setMethodNumbers(data.paymentMethodNumbers as MethodNumber[]);
        if (data.agentPaymentNumbers?.length) setAgentNumbers(data.agentPaymentNumbers as AgentNumber[]);
      } catch {
        setMethods([]);
      }
    };
    fetchData();
  }, []);

  // Get the currently assigned agent for the selected method using configured rotation windows.
  const currentAgent = useMemo(() => {
    if (!method) return null;
    return getRotatedAgentNumber(agentNumbers, method.name);
  }, [method, agentNumbers]);

  // Check if any agent numbers exist for the selected method
  const hasAgentNumbers = useMemo(() => {
    if (!method) return false;
    return agentNumbers.some(a => a.payment_method === method.name);
  }, [method, agentNumbers]);

  // Get the correct number: agent number takes priority, old system is fallback only when no agents exist
  const getDisplayNumber = (): string => {
    if (!method) return '';
    
    // If agents are configured for this method, always use agent number
    if (hasAgentNumbers && currentAgent) {
      return currentAgent.number;
    }
    
    // Fallback to old payment_method_numbers ONLY when no agents exist for this method
    if (!hasAgentNumbers && txnType) {
      const found = methodNumbers.find(
        mn => mn.payment_method_id === method.id && mn.transaction_type_id === txnType.id
      );
      if (found) return found.number;
    }
    return method.number;
  };

  const handleCopy = () => {
    const num = getDisplayNumber();
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success('Number copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const validateTrxId = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Transaction ID is required';
    const rule = TRX_RULES[method?.name || ''] || DEFAULT_RULE;
    if (trimmed.length < rule.minLen || trimmed.length > rule.maxLen) return rule.hint;
    if (!rule.pattern.test(trimmed)) return rule.hint;
    return '';
  };

  const handleTrxChange = (value: string) => {
    setTrxId(value);
    const err = validateTrxId(value);
    setTrxError(err);
  };

  const checkDuplicate = async (trxValue: string): Promise<boolean> => {
    const trimmed = trxValue.trim();
    if (!trimmed) return false;
    setCheckingDup(true);
    try {
      const result = await api.checkDepositTrx(trimmed);
      return !!result?.duplicate;
    } catch {
      return false;
    } finally {
      setCheckingDup(false);
    }
  };

  const handleProceed = () => {
    const amt = Number(amount);
    if (amt < 200) { toast.error('Minimum deposit ৳200'); return; }
    setShowConfirmSheet(true);
  };

  const handleSubmit = async () => {
    if (!method) return;
    const amt = Number(amount);
    if (!senderNum || senderNum.length < 11) { toast.error('Enter valid sender number'); return; }

    const trxValidation = validateTrxId(trxId);
    if (trxValidation) { setTrxError(trxValidation); toast.error(trxValidation); return; }

    const isDuplicate = await checkDuplicate(trxId);
    if (isDuplicate) {
      setTrxError('This Transaction ID has already been used!');
      toast.error('Duplicate Transaction ID! This TrxID was already submitted.');
      return;
    }

    setSubmitting(true);
    const ok = await deposit(amt, method.name, trxId.trim(), senderNum.trim(), currentAgent?.agent_id);
    setSubmitting(false);
    if (ok) {
      setShowConfirmSheet(false);
      toast.success('Deposit submitted successfully!');
      navigate('/');
    } else {
      setTrxError('Deposit failed. TrxID may already exist.');
    }
  };

  const goBack = () => {
    if (showConfirmSheet) { setShowConfirmSheet(false); return; }
    if (step === 'amount') setStep('type');
    else if (step === 'type') setStep('method');
    else navigate('/deposit');
  };

  const txnTypeLabel = txnType?.label || '';
  const displayNumber = getDisplayNumber();
  const rotationHours = Number(currentAgent?.rotation_hours ?? 0);
  const activeBonusSummary = depositBonusRules
    .slice(0, 2)
    .map(rule => `${rule.name}: ${formatBonusRuleSummary(rule)}`)
    .filter(Boolean)
    .join(' | ');

  if (methods.length === 0) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center">
        <p className="text-muted-foreground">Loading payment methods...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen navy-gradient relative">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={goBack} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">💰 Deposit</h1>
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-1">
            {['method', 'type', 'amount'].map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`h-1 flex-1 rounded-full transition-colors ${
                  ['method', 'type', 'amount'].indexOf(step) >= i ? 'bg-primary' : 'bg-secondary'
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">Method</span>
            <span className="text-[9px] text-muted-foreground">Type</span>
            <span className="text-[9px] text-muted-foreground">Amount</span>
          </div>
        </div>
      )}

      <div className="px-4">
        {/* Step 1: Select Payment Method */}
        {step === 'method' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="bg-card rounded-xl p-3 gold-border flex items-center gap-2">
              <span className="text-primary text-lg">🎁</span>
              <p className="text-xs text-muted-foreground flex-1">
                <span className="text-primary font-heading font-bold">Active Deposit Bonus</span>
                {' '}
                — {activeBonusSummary || 'Approved deposits will use the currently active backend bonus rules.'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                Select Payment Method
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setMethod(m); setStep('type'); }}
                    className="relative flex flex-col items-center gap-1.5 bg-card rounded-xl p-3 gold-border active:scale-[0.95] transition-transform"
                  >
                    {m.bonus && (
                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-md">
                        {m.bonus}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${m.color_from}, ${m.color_to})` }}>
                      {m.icon_url ? <img src={m.icon_url} alt={m.name} className="w-full h-full object-cover" /> : m.icon}
                    </div>
                    <span className="font-heading font-bold text-xs text-foreground">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Select Transaction Type */}
        {step === 'type' && method && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${method.color_from}, ${method.color_to})` }}>
                {method.icon_url ? <img src={method.icon_url} alt={method.name} className="w-full h-full object-cover" /> : method.icon}
              </div>
              <div>
                <p className="font-heading font-bold text-sm">{method.name}</p>
                <p className="text-[10px] text-muted-foreground">Selected payment method</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                Select Transaction Type
              </p>
              <div className="space-y-2.5">
                {txnTypes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTxnType(t); setStep('amount'); }}
                    className={`w-full flex items-center gap-3 bg-card rounded-xl p-4 gold-border active:scale-[0.98] transition-transform text-left`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-sm">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.description}</p>
                    </div>
                    <ChevronDown size={16} className="text-muted-foreground -rotate-90" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Enter Amount */}
        {step === 'amount' && method && txnType && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Selected summary */}
            <div className="bg-card rounded-xl p-3 gold-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${method.color_from}, ${method.color_to})` }}>
                {method.icon_url ? <img src={method.icon_url} alt={method.name} className="w-full h-full object-cover" /> : method.icon}
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-xs">{method.name}</p>
                <p className="text-[10px] text-muted-foreground">{txnTypeLabel}</p>
              </div>
              <button onClick={() => setStep('method')} className="text-[10px] text-primary font-bold">Change</button>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                Enter Amount
              </p>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Min ৳200"
                className="w-full bg-card rounded-xl px-4 py-3.5 text-foreground font-heading text-lg outline-none gold-border focus:ring-2 focus:ring-primary text-center"
              />
              <div className="flex gap-2 mt-3">
                {[500, 1000, 2000, 5000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    className={`flex-1 py-2 text-xs font-heading font-bold rounded-lg transition-colors ${
                      amount === String(v) ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'
                    }`}>
                    ৳{v}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleProceed}
              disabled={!amount || Number(amount) < 200}
              className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 text-base"
            >
              Proceed →
            </button>
          </motion.div>
        )}

        {/* Step Done */}
        {step === 'done' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="font-heading font-bold text-xl gold-text mb-2">Deposit Submitted!</h2>
            <p className="text-muted-foreground text-sm mb-2">৳{Number(amount).toLocaleString()} via {method?.name}</p>
            <p className="text-muted-foreground text-xs mb-6">Your deposit is pending admin approval. Balance will be updated once approved.</p>
            <button
              onClick={() => navigate('/account')}
              className="px-8 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground"
            >
              Back to Account
            </button>
          </motion.div>
        )}
      </div>

      {/* Bottom Sheet Confirmation */}
      <AnimatePresence>
        {showConfirmSheet && method && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmSheet(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-5 pb-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-base">Confirm Deposit</h2>
                  <button onClick={() => setShowConfirmSheet(false)} className="p-1">
                    <X size={20} className="text-muted-foreground" />
                  </button>
                </div>

                {/* Payment Info Card */}
                <div className="bg-secondary rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${method.color_from}, ${method.color_to})` }}>
                      {method.icon_url ? <img src={method.icon_url} alt={method.name} className="w-full h-full object-cover" /> : method.icon}
                    </div>
                    <div>
                      <p className="font-heading font-bold text-sm">{method.name}</p>
                      <p className="text-[10px] text-muted-foreground">{txnTypeLabel}</p>
                    </div>
                  </div>

                  {/* Wallet number */}
                  <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{method.name} Number ({txnTypeLabel})</p>
                      <p className="font-heading font-bold text-primary text-lg">{displayNumber}</p>
                      {currentAgent && rotationHours > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          This number stays active for {rotationHours} hour{rotationHours > 1 ? 's' : ''} before the next agent rotates in.
                        </p>
                      )}
                    </div>
                    <button onClick={handleCopy} className="p-2 bg-primary/10 rounded-lg">
                      {copied ? <CheckCircle size={18} className="text-green-400" /> : <Copy size={18} className="text-primary" />}
                    </button>
                  </div>

                  {/* Amount display */}
                  <div className="bg-background/50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground">Deposit Amount</p>
                    <p className="font-heading font-bold text-lg text-foreground">৳{Number(amount).toLocaleString()}</p>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-400 font-heading font-bold mb-1">⚠ Important</p>
                  <p className="text-[10px] text-muted-foreground">
                    Send money from your {method.name} app to the number above via <span className="text-foreground font-bold">{txnTypeLabel}</span>, then enter the Transaction ID below.
                  </p>
                </div>

                {/* Sender Number */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Your {method.name} Number</label>
                  <input
                    type="tel"
                    value={senderNum}
                    onChange={e => setSenderNum(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    maxLength={11}
                    className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* TrxID */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Transaction ID (TrxID)
                  </label>
                  <input
                    type="text"
                    value={trxId}
                    onChange={e => handleTrxChange(e.target.value)}
                    placeholder={`e.g. ${method.name === 'bKash' ? 'ABC12345XY' : 'TRX123456'}`}
                    maxLength={30}
                    className={`w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 ${
                      trxError ? 'focus:ring-destructive border-destructive' : 'focus:ring-primary'
                    }`}
                  />
                  {trxError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {trxError}
                    </p>
                  )}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || checkingDup || !!trxError}
                  className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 text-base"
                >
                  {checkingDup ? 'Checking...' : submitting ? 'Submitting...' : '✅ CONFIRM Deposit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DepositPage;
