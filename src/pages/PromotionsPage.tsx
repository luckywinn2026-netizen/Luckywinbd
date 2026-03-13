import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, CheckCircle, Bell, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getBonusRuleIcon, formatBonusRuleSummary } from '@/lib/bonusRuleUi';
import { BonusRule, useBonusRules } from '@/hooks/useBonusRules';

const PromotionsPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { rules, loading } = useBonusRules();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(() => {
    return localStorage.getItem('lw_notifs') === 'true';
  });

  const promos = useMemo(() => {
    return rules.map((rule: BonusRule) => {
      const Icon = getBonusRuleIcon(rule);
      const minDeposit = Number(rule.config?.min_deposit ?? 0);
      const expiry = rule.ends_at ? new Date(rule.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry';
      const code = rule.trigger_type === 'referral_deposit_approved'
        ? profile?.refer_code || 'SIGN IN'
        : rule.promo_code || 'AUTO';

      return {
        id: rule.id,
        rule,
        icon: <Icon size={24} />,
        title: rule.name,
        description: rule.description || 'Bonus campaign',
        code,
        summary: formatBonusRuleSummary(rule),
        color: `${rule.display_color_from} ${rule.display_color_to}`,
        expiry,
        minDeposit: minDeposit > 0 ? `৳${minDeposit.toLocaleString()}` : 'Any amount',
      };
    });
  }, [profile?.refer_code, rules]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success(`Code "${code}" copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleNotifications = () => {
    const next = !notificationsOn;
    setNotificationsOn(next);
    localStorage.setItem('lw_notifs', String(next));
    if (next) {
      toast.success('🔔 Notifications enabled! You\'ll get alerts for new promotions.');
      // Simulate a push notification after 5s
      setTimeout(() => {
        if (Notification.permission === 'granted') {
           new Notification('Lucky Win BD 🎰', {
            body: '🔥 New bonus available! Use code LUCKY100 for 100% welcome bonus!',
            icon: '/favicon.png',
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              new Notification('Lucky Win BD 🎰', {
                body: '🔥 New bonus available! Use code LUCKY100 for 100% welcome bonus!',
                icon: '/favicon.png',
              });
            }
          });
        }
      }, 3000);
      // Simulate periodic notifications
      simulateNotifications();
    } else {
      toast.info('🔕 Notifications disabled');
    }
  };

  const simulateNotifications = () => {
    const messages = promos.length > 0
      ? promos.slice(0, 4).map(promo => `🎁 ${promo.title} is active now! ${promo.code !== 'AUTO' ? `Code: ${promo.code}` : 'Auto-applied on approval.'}`)
      : ['🎁 Bonus campaigns will appear here once enabled by admin.'];
    let i = 0;
    const interval = setInterval(() => {
      if (!localStorage.getItem('lw_notifs') || localStorage.getItem('lw_notifs') !== 'true') {
        clearInterval(interval);
        return;
      }
      toast.info(messages[i % messages.length], { duration: 4000 });
      i++;
      if (i >= 4) clearInterval(interval);
    }, 15000);
  };

  const hasReferralPromo = (rule: BonusRule) => rule.trigger_type === 'referral_deposit_approved';

  return (
    <div className="min-h-screen navy-gradient">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="font-heading font-bold text-lg gold-text">🎁 Promotions</h1>
        </div>
        <button
          onClick={toggleNotifications}
          className={`p-2.5 rounded-xl transition-colors ${notificationsOn ? 'gold-gradient' : 'bg-secondary'}`}
        >
          {notificationsOn ? (
            <Bell size={20} className={notificationsOn ? 'text-primary-foreground' : 'text-muted-foreground'} />
          ) : (
            <BellOff size={20} className="text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Notification banner */}
      {!notificationsOn && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 bg-secondary rounded-xl p-3 gold-border flex items-center gap-3"
        >
          <Bell size={18} className="text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">Enable notifications to get alerts on new bonuses & promotions!</p>
          <button onClick={toggleNotifications} className="text-xs font-heading font-bold text-primary">
            Enable
          </button>
        </motion.div>
      )}

      {/* Promo Cards */}
      <div className="px-4 space-y-3 pb-6">
        {loading ? (
          <div className="bg-card rounded-2xl p-6 gold-border text-center text-muted-foreground">Loading promotions...</div>
        ) : promos.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 gold-border text-center text-muted-foreground">
            No active promotions right now.
          </div>
        ) : promos.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card rounded-2xl overflow-hidden gold-border card-glow"
          >
            <div className={`bg-gradient-to-r ${p.color} p-3 flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground">
                {p.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-sm text-primary-foreground">{p.title}</h3>
                <span className="text-xs text-primary-foreground/80 font-heading">{p.summary || 'Bonus campaign'}</span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-3">{p.description}</p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                <span>Min Deposit: {p.minDeposit}</span>
                <span>Expires: {p.expiry}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="font-heading font-bold text-sm text-primary tracking-wider">{p.code}</span>
                  <button onClick={() => handleCopy(p.code, p.id)}>
                    {copiedId === p.id ? (
                      <CheckCircle size={16} className="text-success" />
                    ) : (
                      <Copy size={16} className="text-muted-foreground" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => {
                    hasReferralPromo(p.rule) ? navigate('/referrals') : navigate('/deposit');
                  }}
                  className="px-4 py-2 rounded-lg gold-gradient font-heading font-bold text-xs text-primary-foreground active:scale-95 transition-transform"
                >
                  {hasReferralPromo(p.rule) ? 'View' : 'Claim'}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PromotionsPage;
