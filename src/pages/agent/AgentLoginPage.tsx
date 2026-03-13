import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Phone, Lock, LogIn, Smartphone, DollarSign, Users, TrendingUp, ArrowRight } from 'lucide-react';
import luckyWinLogo from '@/assets/lucky-win-bd-logo.png';

const AgentLoginPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error('Enter phone number and password');
      return;
    }
    setLoading(true);

    const email = `${phone.replace(/[^0-9]/g, '')}@luckywin.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Invalid phone number or password');
      setLoading(false);
      return;
    }

    let isAgent: boolean, isAdmin: boolean, isMod: boolean;
    try {
      isAgent = await api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'payment_agent' });
    } catch { isAgent = false; }
    if (isAgent) {
      toast.success('Welcome, Agent!');
      navigate('/admin/agent-overview');
    } else {
      try {
        isAdmin = await api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'admin' });
        isMod = await api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'moderator' });
      } catch { isAdmin = false; isMod = false; }
      if (isAdmin || isMod) {
        toast.success('Logged in as Admin');
        navigate('/admin/dashboard');
      } else {
        toast.error('No agent access. Apply or contact admin.');
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(220,60%,8%)] via-[hsl(220,50%,12%)] to-[hsl(35,80%,10%)]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/3 rounded-full blur-[80px]" />

      <div className="relative z-10 min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Logo & Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <img src={luckyWinLogo} alt="Lucky Win" className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
          <h1 className="font-heading font-bold text-2xl gold-text">Agent Portal</h1>
          <p className="text-xs text-muted-foreground mt-1">Payment Agent Login</p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card/90 backdrop-blur-xl rounded-2xl p-6 sm:p-8 gold-border card-glow max-w-sm w-full"
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <Phone size={12} /> Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full bg-secondary/80 rounded-xl px-4 py-3 min-h-[48px] text-foreground font-heading outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <Lock size={12} /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-secondary/80 rounded-xl px-4 py-3 min-h-[48px] text-foreground font-heading outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-[0.97] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              <LogIn size={18} />
              {loading ? 'Logging in...' : 'Agent Login'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-[11px] text-muted-foreground mb-2">Don't have an agent account?</p>
            <button
              onClick={() => navigate('/become-agent')}
              className="text-xs font-heading font-bold text-primary hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              Apply as Agent <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-3 gap-3 mt-6 max-w-sm w-full"
        >
          {[
            { icon: DollarSign, label: 'Earn Commission', desc: 'Per transaction' },
            { icon: Smartphone, label: 'Mobile App', desc: 'Anytime' },
            { icon: TrendingUp, label: 'Real-Time', desc: 'Dashboard' },
          ].map(f => (
            <div key={f.label} className="bg-card/50 backdrop-blur rounded-xl p-3 text-center border border-border/50">
              <f.icon size={20} className="text-primary mx-auto mb-1" />
              <p className="text-[10px] font-heading font-bold text-foreground">{f.label}</p>
              <p className="text-[9px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default AgentLoginPage;
