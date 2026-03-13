import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, ArrowDownCircle, ArrowUpCircle, History, Crown, Gift, MessageCircle, LogOut, User, LogIn, Users, Dices, Copy, BellOff } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToastPreferences } from '@/contexts/ToastPreferencesContext';
import { toast } from 'sonner';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('ID copied!');
};

const AccountPage = () => {
  const navigate = useNavigate();
  const { balance, pendingWithdraw, vipPoints, currentTier } = useWallet();
  const { user, profile, signOut, openAuth } = useAuth();
  const { t } = useLanguage();
  const { hideGameToasts, setHideGameToasts } = useToastPreferences();

  if (!user) {
    return (
      <div className="px-4 pt-3">
        <div className="bg-card rounded-2xl p-6 gold-border card-glow text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <User size={36} className="text-muted-foreground" />
          </div>
          <h2 className="font-heading font-bold text-xl mb-2">{t('account.welcome')}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t('account.signInPrompt')}</p>
          <div className="flex gap-3">
            <button onClick={() => openAuth('login')} className="flex-1 py-3 rounded-xl font-heading font-bold bg-secondary text-foreground active:scale-95 transition-transform">
              {t('header.signIn')}
            </button>
            <button onClick={() => openAuth('signup')} className="flex-1 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform">
              {t('header.signUp')}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <motion.button onClick={() => navigate('/promotions')} className="w-full flex items-center gap-3 bg-card rounded-xl p-3.5 gold-border active:scale-[0.98] transition-transform text-left">
            <Gift size={22} className="text-primary" />
            <span className="font-heading font-semibold text-sm flex-1">{t('account.promotions')}</span>
            <span className="text-muted-foreground text-sm">→</span>
          </motion.button>
          <motion.button onClick={() => window.open('https://t.me/LuckyWinSupport', '_blank')} className="w-full flex items-center gap-3 bg-card rounded-xl p-3.5 gold-border active:scale-[0.98] transition-transform text-left">
            <MessageCircle size={22} className="text-[hsl(200,80%,55%)]" />
            <span className="font-heading font-semibold text-sm flex-1">{t('account.telegram')}</span>
            <span className="text-muted-foreground text-sm">→</span>
          </motion.button>
        </div>
      </div>
    );
  }

  const cards = [
    { icon: Crown, label: `${t('account.vipClub')} (${currentTier.icon} ${currentTier.name})`, color: 'text-primary', action: () => navigate('/vip') },
    { icon: Users, label: t('account.myReferrals'), color: 'text-primary', action: () => navigate('/referrals') },
    { icon: Gift, label: t('account.promotions'), color: 'text-primary', action: () => navigate('/promotions') },
    { icon: ArrowDownCircle, label: t('account.deposit'), color: 'text-success', action: () => navigate('/deposit') },
    { icon: ArrowUpCircle, label: t('account.withdraw'), color: 'text-primary', action: () => navigate('/withdraw') },
    { icon: History, label: t('account.history'), color: 'text-foreground', action: () => navigate('/history') },
    { icon: Dices, label: t('account.betHistory'), color: 'text-foreground', action: () => navigate('/bet-history') },
    { icon: MessageCircle, label: t('account.liveChat'), color: 'text-[hsl(200,80%,55%)]', action: () => window.dispatchEvent(new Event('open-support-chat')) },
    { icon: MessageCircle, label: t('account.telegram'), color: 'text-[hsl(200,80%,55%)]', action: () => window.open('https://t.me/LuckyWinSupport', '_blank') },
    { icon: LogOut, label: t('account.logout'), color: 'text-destructive', action: async () => { await signOut(); toast.success(t('account.loggedOut')); } },
  ];

  return (
    <div className="px-4 pt-3">
      <div className="bg-card rounded-2xl p-4 gold-border card-glow mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full gold-gradient flex items-center justify-center">
            <User size={28} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg">{profile?.username || t('account.player')}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">ID: <span className="text-primary font-bold">{profile?.user_code || '...'}</span></p>
              {profile?.user_code && (
                <button onClick={() => copyToClipboard(profile.user_code!)} className="p-0.5">
                  <Copy size={12} className="text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-secondary rounded-xl p-2.5 text-center">
            <Wallet size={18} className="text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t('account.balance')}</p>
            <p className="font-heading font-bold text-sm text-primary">৳{balance.toLocaleString()}</p>
          </div>
          <div className="bg-secondary rounded-xl p-2.5 text-center">
            <ArrowUpCircle size={18} className="text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t('account.pending')}</p>
            <p className="font-heading font-bold text-sm">৳{pendingWithdraw.toLocaleString()}</p>
          </div>
          <div className="bg-secondary rounded-xl p-2.5 text-center">
            <Crown size={18} className="text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t('account.vipPoints')}</p>
            <p className="font-heading font-bold text-sm text-primary">{vipPoints.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-2xl p-4 gold-border card-glow mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BellOff size={22} className="text-muted-foreground" />
            <div>
              <p className="font-heading font-semibold text-sm">{t('account.hideGameToasts')}</p>
              <p className="text-[10px] text-muted-foreground">{t('account.hideGameToastsDesc')}</p>
            </div>
          </div>
          <button
            onClick={() => setHideGameToasts(!hideGameToasts)}
            className={`relative w-12 h-7 rounded-full transition-colors ${hideGameToasts ? 'bg-primary' : 'bg-secondary'}`}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${hideGameToasts ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {cards.map((c, i) => (
          <motion.button
            key={c.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={c.action}
            className="w-full flex items-center gap-3 bg-card rounded-xl p-3.5 gold-border active:scale-[0.98] transition-transform text-left"
          >
            <c.icon size={22} className={c.color} />
            <span className="font-heading font-semibold text-sm flex-1">{c.label}</span>
            <span className="text-muted-foreground text-sm">→</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default AccountPage;
