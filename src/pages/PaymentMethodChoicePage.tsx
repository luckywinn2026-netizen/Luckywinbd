import { ArrowLeft, Wallet, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const PaymentMethodChoicePage = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDeposit = pathname.includes('/deposit');

  const handleEwallet = () => {
    navigate(isDeposit ? '/deposit/ewallet' : '/withdraw/ewallet');
  };

  const handleLuckyAgent = () => {
    navigate(isDeposit ? '/deposit/agent' : '/withdraw/agent');
  };

  return (
    <div className="min-h-screen navy-gradient relative">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/account')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">
          {isDeposit ? '💰 Deposit' : '💸 Withdraw'}
        </h1>
      </div>

      <div className="px-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how you want to {isDeposit ? 'deposit' : 'withdraw'}:
        </p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleEwallet}
          className="w-full flex items-center gap-4 bg-card rounded-xl p-4 gold-border active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center">
            <Wallet size={24} className="text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-base">E-wallet</p>
            <p className="text-xs text-muted-foreground">
              {isDeposit
                ? 'bKash, Nagad, Rocket - send to assigned number'
                : 'Request via bKash, Nagad, Rocket'}
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={handleLuckyAgent}
          className="w-full flex items-center gap-4 bg-card rounded-xl p-4 gold-border active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center gold-border">
            <User size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-base">Lucky Agent</p>
            <p className="text-xs text-muted-foreground">
              {isDeposit
                ? 'Contact agent directly via Telegram'
                : 'Select agent, get instant payout'}
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
        </motion.button>
      </div>
    </div>
  );
};

export default PaymentMethodChoicePage;
