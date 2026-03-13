import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Lock, User, Phone, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import logo from '@/assets/lucky-win-bd-logo.png';

const AuthModal = () => {
  const { showAuthModal, setShowAuthModal, signIn, signUp, authTab, setAuthTab } = useAuth();
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referCode, setReferCode] = useState('');

  const tab = authTab;
  const setTab = (t: 'login' | 'signup') => setAuthTab(t);

  const reset = () => {
    setPhone(''); setPassword(''); setUsername(''); setConfirmPassword('');
    setShowPassword(false); setReferCode('');
  };

  useEffect(() => { if (showAuthModal) reset(); }, [showAuthModal, authTab]);

  const fakeEmail = (p: string) => `${p.replace(/[^0-9]/g, '')}@luckywin.app`;

  const handleLogin = async () => {
    if (!phone || !password) { toast.error(t('auth.fillAll')); return; }
    setLoading(true);
    const { error } = await signIn(fakeEmail(phone), password);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(t('auth.welcomeBack'));
    setShowAuthModal(false); reset();
  };

  const handleSignup = async () => {
    if (!phone || !password || !username) { toast.error(t('auth.fillRequired')); return; }
    if (password.length < 6) { toast.error(t('auth.passMin6')); return; }
    if (password !== confirmPassword) { toast.error(t('auth.passNoMatch')); return; }
    setLoading(true);
    const { error } = await signUp(fakeEmail(phone), password, username, referCode || undefined);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(t('auth.accountCreated'));
    setShowAuthModal(false); reset();
  };

  return (
    <AnimatePresence>
      {showAuthModal && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAuthModal(false)} />
          <motion.div className="fixed inset-x-3 top-[10%] z-[60] max-w-md mx-auto" initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} transition={{ type: 'spring', damping: 22 }}>
            <div className="bg-card rounded-2xl overflow-hidden gold-border card-glow">
              <div className="gold-gradient p-4 flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="Lucky Win" className="w-10 h-10 object-contain" />
                  <div>
                    <p className="font-heading font-bold text-base text-primary-foreground">Lucky Win BD</p>
                    <p className="text-[10px] text-primary-foreground/70">{t('auth.playAndWin')}</p>
                  </div>
                </div>
                <button onClick={() => setShowAuthModal(false)} className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <X size={16} className="text-primary-foreground" />
                </button>
              </div>
              <div className="flex border-b border-border">
                <button onClick={() => { setTab('login'); reset(); }} className={`flex-1 py-3 font-heading font-bold text-sm text-center transition-colors relative ${tab === 'login' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {t('auth.signIn')}
                  {tab === 'login' && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-[2px] gold-gradient" />}
                </button>
                <button onClick={() => { setTab('signup'); reset(); }} className={`flex-1 py-3 font-heading font-bold text-sm text-center transition-colors relative ${tab === 'signup' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {t('auth.signUp')}
                  {tab === 'signup' && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-[2px] gold-gradient" />}
                </button>
              </div>
              <div className="p-4 space-y-3">
                {tab === 'signup' && (
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('auth.username')} className="w-full bg-secondary rounded-xl pl-10 pr-3 py-3 text-sm text-foreground font-body outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('auth.phone')} className="w-full bg-secondary rounded-xl pl-10 pr-3 py-3 text-sm text-foreground font-body outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.password')} className="w-full bg-secondary rounded-xl pl-10 pr-10 py-3 text-sm text-foreground font-body outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff size={16} className="text-muted-foreground" /> : <Eye size={16} className="text-muted-foreground" />}
                  </button>
                </div>
                {tab === 'signup' && (
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('auth.confirmPassword')} className="w-full bg-secondary rounded-xl pl-10 pr-3 py-3 text-sm text-foreground font-body outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}
                {tab === 'signup' && (
                  <div className="relative">
                    <Gift size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={referCode} onChange={e => setReferCode(e.target.value)} placeholder={t('auth.referCode')} className="w-full bg-secondary rounded-xl pl-10 pr-3 py-3 text-sm text-foreground font-body outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}
                {tab === 'login' && (
                  <div className="text-right">
                    <button className="text-xs text-primary font-heading hover:underline">{t('auth.forgotPassword')}</button>
                  </div>
                )}
                <button onClick={tab === 'login' ? handleLogin : handleSignup} disabled={loading} className="w-full py-3.5 rounded-xl font-heading font-bold text-base gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {tab === 'login' ? t('auth.signingIn') : t('auth.creatingAccount')}
                    </span>
                  ) : (
                    tab === 'login' ? t('auth.signIn') : t('auth.createAccount')
                  )}
                </button>
                {tab === 'signup' && (
                  <p className="text-[10px] text-muted-foreground text-center">{t('auth.terms')}</p>
                )}
                <div className="text-center pt-1">
                  <p className="text-xs text-muted-foreground">
                    {tab === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
                    <button onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); reset(); }} className="text-primary font-heading font-bold hover:underline">
                      {tab === 'login' ? t('auth.signUp') : t('auth.signIn')}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
