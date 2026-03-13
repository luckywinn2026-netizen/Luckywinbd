import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Grip, TrendingUp, User, Trophy } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/lucky-win-bd-logo.png';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import VipCelebration from '@/components/VipCelebration';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { balance, upgradedTier, clearUpgradedTier } = useWallet();
  const { user, openAuth } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const navItems = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/sports', icon: Trophy, label: t('nav.sports') },
    { path: '/slots', icon: Grip, label: t('nav.slots') },
    { path: '/crash', icon: TrendingUp, label: t('nav.crash') },
    { path: '/account', icon: User, label: t('nav.account') },
  ];

  return (
    <div className="h-full min-h-[100dvh] flex flex-col overflow-hidden navy-gradient overflow-x-hidden w-full max-w-[100vw]">
      <VipCelebration tier={upgradedTier} onClose={clearUpgradedTier} />
      <PageTransition />
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pb-2 header-safe safe-x bg-navy-dark/90 backdrop-blur-md gold-border border-t-0 border-x-0 overflow-x-hidden max-w-[100vw]">
        <div className="flex items-center" onClick={() => navigate('/')}>
          <img src={logo} alt="Lucky Win" className="w-9 h-9 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="gold-border rounded-full px-3 py-1 flex items-center gap-1.5 animate-pulse-glow">
                <span className="text-sm text-primary">৳</span>
                <span className="text-sm font-heading font-bold text-foreground">{balance.toLocaleString()}</span>
              </div>
              <button
                onClick={() => navigate('/deposit')}
                className="px-3 py-1.5 rounded-lg gold-gradient font-heading font-bold text-xs text-primary-foreground active:scale-95 transition-transform"
              >
                {t('header.deposit')}
              </button>
            </>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => openAuth('login')}
                className="px-3 py-1.5 rounded-lg bg-secondary font-heading font-bold text-xs text-foreground active:scale-95 transition-transform"
              >
                {t('header.signIn')}
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="px-3 py-1.5 rounded-lg gold-gradient font-heading font-bold text-xs text-primary-foreground active:scale-95 transition-transform"
              >
                {t('header.signUp')}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content - min-h-0 allows flex child to shrink and scroll */}
      <main className="flex-1 min-h-0 pt-14 main-safe-bottom overflow-y-auto overflow-x-hidden safe-x min-w-0 -webkit-overflow-scrolling-touch">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0 overflow-x-hidden"
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-navy-dark/95 backdrop-blur-md gold-border border-b-0 border-x-0 safe-bottom safe-x overflow-x-hidden max-w-[100vw]">
        <div className="flex items-center justify-around py-1.5 min-h-44dp">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 min-w-56dp min-h-44dp justify-center transition-colors touch-target ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className={`text-[10px] font-heading font-semibold ${active ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 w-8 h-0.5 gold-gradient rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
