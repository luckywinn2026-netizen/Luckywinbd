import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  LayoutDashboard, Users, Wallet, ArrowDownCircle, ArrowUpCircle,
  Gamepad2, Settings, LogOut, Shield, BarChart3, Plane, Radio, Menu, X, UserPlus, Paintbrush, Dices, TrendingUp, MessageCircle, ShieldPlus, Banknote, Activity, HandCoins, Trophy, ClipboardList, Star, Gift, Phone, ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';

const allNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/referrals', label: 'Referrals', icon: UserPlus },
  { to: '/admin/bonus-rules', label: 'Bonus Rules', icon: Gift },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownCircle },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
  { to: '/admin/wallets', label: 'Wallets', icon: Wallet },
  { to: '/admin/games', label: 'Games', icon: Gamepad2 },
  { to: '/admin/game-assets', label: 'Game Assets', icon: Paintbrush },
  { to: '/admin/promo-banners', label: 'Promo Banners', icon: ImageIcon },
  { to: '/admin/crash-control', label: 'Crash Control', icon: Plane },
  { to: '/admin/multiplier', label: '4th Reel Control', icon: Dices },
  { to: '/admin/profit-settings', label: 'Profit Control', icon: TrendingUp },
  { to: '/admin/chat-management', label: 'Chat Mgmt', icon: MessageCircle },
  { to: '/admin/live-monitor', label: 'Live Monitor', icon: Radio },
  { to: '/admin/cyber-matches', label: 'Cyber Matches', icon: Trophy },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/sub-admins', label: 'Sub-Admins', icon: ShieldPlus },
  { to: '/admin/agents', label: 'Payment Agents', icon: Banknote },
  { to: '/admin/agent-applications', label: 'Agent Applications', icon: ClipboardList },
  { to: '/admin/agent-performance', label: 'Agent Performance', icon: Activity },
  { to: '/admin/agent-settlements', label: 'Agent Settlements', icon: HandCoins },
  { to: '/admin/fake-wins', label: 'Fake Mega Wins', icon: Star },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const agentNavItems = [
  { to: '/admin/agent-overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/agent-numbers', label: 'My Numbers', icon: Phone },
  { to: '/admin/agent-deposits', label: 'Deposits', icon: ArrowDownCircle },
  { to: '/admin/agent-withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
];

const AdminLayout = () => {
  const { isAdmin, adminRole, allowedRoutes, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center">
        <div className="text-primary animate-pulse font-heading text-xl">Loading Admin...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  // Filter nav items based on role
  const navItems = adminRole === 'payment_agent'
    ? agentNavItems
    : adminRole === 'moderator'
    ? allNavItems.filter(item => allowedRoutes.includes(item.to))
    : allNavItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading font-medium transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
    }`;

  const roleLabel = adminRole === 'payment_agent' ? 'Agent Panel' : adminRole === 'moderator' ? 'Sub-Admin' : 'Admin Panel';

  return (
    <div className="h-screen min-h-[100dvh] overflow-hidden navy-gradient flex flex-col md:flex-row pt-[env(safe-area-inset-top)]">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-50 min-h-[52px]">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          <h1 className="font-heading font-bold text-base gold-text">{roleLabel}</h1>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-secondary">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-card border-r border-border flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={22} className="text-primary" />
                  <h1 className="font-heading font-bold text-base gold-text">{roleLabel}</h1>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:bg-secondary">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClasses}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-3 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Shield size={24} className="text-primary" />
          <h1 className="font-heading font-bold text-lg gold-text">{roleLabel}</h1>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={navLinkClasses}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content - min-h-0 allows flex child to shrink and scroll, touch-friendly on mobile */}
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-contain pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
