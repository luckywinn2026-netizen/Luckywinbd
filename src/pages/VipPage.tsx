import { motion } from 'framer-motion';
import { ArrowLeft, Star, Gift, Zap, Shield, Crown, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet, VIP_TIERS } from '@/contexts/WalletContext';
import { toast } from 'sonner';

const tierGradients = [
  'from-[hsl(25,60%,40%)] to-[hsl(30,50%,30%)]',    // Bronze
  'from-[hsl(210,10%,60%)] to-[hsl(210,15%,45%)]',   // Silver
  'from-primary to-gold-dark',                         // Gold
  'from-[hsl(200,60%,50%)] to-[hsl(220,70%,40%)]',   // Platinum
  'from-[hsl(280,60%,50%)] to-[hsl(320,70%,40%)]',   // Diamond
];

const tierPerks = [
  { icon: Zap, label: 'Cashback Rate' },
  { icon: Gift, label: 'Bonus Multiplier' },
  { icon: Shield, label: 'Priority Withdraw' },
  { icon: Gamepad2, label: 'Exclusive Games' },
  { icon: Crown, label: 'Personal Manager' },
];

const VipPage = () => {
  const navigate = useNavigate();
  const { vipPoints, currentTier, nextTier, pointsToNext, totalBetAmount, claimCashback } = useWallet();

  const currentIdx = VIP_TIERS.findIndex(t => t.name === currentTier.name);
  const progressPercent = nextTier
    ? ((vipPoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100
    : 100;

  const handleCashback = async () => {
    const amount = await claimCashback();
    if (amount > 0) {
      toast.success(`🎉 Claimed ৳${amount.toLocaleString()} cashback!`);
    } else if (totalBetAmount === 0) {
      toast.info('No bets to claim cashback on. Place some bets first!');
    } else {
      toast.info('Cashback already claimed today. Come back tomorrow!');
    }
  };

  return (
    <div className="min-h-screen navy-gradient pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/account')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg gold-text">👑 VIP Club</h1>
      </div>

      {/* Current Tier Card */}
      <div className="mx-4 mb-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gradient-to-br ${tierGradients[currentIdx]} rounded-2xl p-5 relative overflow-hidden`}
        >
          <div className="absolute top-2 right-2 text-5xl opacity-20">{currentTier.icon}</div>
          <p className="text-sm text-foreground/70 font-heading">Current Tier</p>
          <p className="text-3xl font-heading font-extrabold text-foreground mt-1">
            {currentTier.icon} {currentTier.name}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Star size={16} className="text-primary" />
            <span className="font-heading font-bold text-lg text-primary">{vipPoints.toLocaleString()}</span>
            <span className="text-sm text-foreground/60">points</span>
          </div>

          {/* Progress bar */}
          {nextTier && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-foreground/60 mb-1">
                <span>{currentTier.name}</span>
                <span>{nextTier.name} ({pointsToNext.toLocaleString()} pts to go)</span>
              </div>
              <div className="h-2 bg-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full gold-gradient rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
          {!nextTier && (
            <p className="text-xs text-foreground/60 mt-2 font-heading">🎉 You've reached the highest tier!</p>
          )}
        </motion.div>
      </div>

      {/* Cashback Card */}
      <div className="mx-4 mb-4">
        <div className="bg-card rounded-xl p-4 gold-border card-glow">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-heading font-bold text-sm">Daily Cashback</p>
              <p className="text-xs text-muted-foreground">{currentTier.cashbackRate}% of total bets</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Eligible Amount</p>
              <p className="font-heading font-bold text-primary">
                ৳{Math.round(totalBetAmount * (currentTier.cashbackRate / 100)).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleCashback}
            className="w-full py-2.5 rounded-xl font-heading font-bold text-sm gold-gradient text-primary-foreground active:scale-95 transition-transform mt-2"
          >
            Claim Cashback
          </button>
        </div>
      </div>

      {/* How Points Work */}
      <div className="mx-4 mb-4">
        <div className="bg-card rounded-xl p-4 gold-border">
          <p className="font-heading font-bold text-sm mb-2">⭐ How to Earn Points</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Every <span className="text-foreground font-bold">৳100</span> bet = <span className="text-primary font-bold">1 VIP Point</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Points never expire</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Higher tiers = better rewards</span>
            </div>
          </div>
        </div>
      </div>

      {/* All Tiers */}
      <h2 className="font-heading font-bold text-base mx-4 mb-3 gold-text">🏆 All VIP Tiers</h2>
      <div className="px-4 space-y-2">
        {VIP_TIERS.map((tier, i) => {
          const isActive = tier.name === currentTier.name;
          const isLocked = vipPoints < tier.minPoints;
          return (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl overflow-hidden ${isActive ? 'gold-border ring-1 ring-primary' : 'gold-border opacity-80'}`}
            >
              <div className={`bg-gradient-to-r ${tierGradients[i]} p-3 flex items-center gap-3`}>
                <span className="text-2xl">{tier.icon}</span>
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm text-foreground">
                    {tier.name}
                    {isActive && <span className="ml-2 text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded-full">Current</span>}
                    {isLocked && <span className="ml-2 text-[10px] text-muted-foreground">🔒 {tier.minPoints.toLocaleString()} pts</span>}
                  </p>
                </div>
              </div>
              <div className="bg-card p-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-primary" />
                  <span className="text-muted-foreground">Cashback: <span className="text-foreground font-bold">{tier.cashbackRate}%</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Gift size={12} className="text-primary" />
                  <span className="text-muted-foreground">Bonus: <span className="text-foreground font-bold">{tier.bonusMultiplier}x</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className={tier.withdrawPriority ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-muted-foreground">Fast Withdraw: <span className={`font-bold ${tier.withdrawPriority ? 'text-success' : ''}`}>{tier.withdrawPriority ? '✓' : '✗'}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Gamepad2 size={12} className={tier.exclusiveGames ? 'text-success' : 'text-muted-foreground'} />
                  <span className="text-muted-foreground">VIP Games: <span className={`font-bold ${tier.exclusiveGames ? 'text-success' : ''}`}>{tier.exclusiveGames ? '✓' : '✗'}</span></span>
                </div>
                {tier.personalManager && (
                  <div className="col-span-2 flex items-center gap-1.5">
                    <Crown size={12} className="text-success" />
                    <span className="text-muted-foreground">Personal Account Manager: <span className="text-success font-bold">✓</span></span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default VipPage;
