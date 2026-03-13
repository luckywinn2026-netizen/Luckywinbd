import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { Shield, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = `${phone.replace(/[^0-9]/g, '')}@luckywin.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const [adminRes, modRes, agentRes] = await Promise.all([
      api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'admin' }).catch(() => false),
      api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'moderator' }).catch(() => false),
      api.rpc<boolean>('has_role', { _user_id: data.user.id, _role: 'payment_agent' }).catch(() => false),
    ]);
    if (adminRes || modRes) {
      toast.success('Welcome, Admin!');
      navigate('/admin/dashboard');
    } else if (agentRes) {
      toast.success('Welcome, Payment Agent!');
      navigate('/admin/agent-overview');
    } else {
      toast.error('Access denied. Admin/Agent privileges required.');
      await supabase.auth.signOut();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] navy-gradient flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-5 sm:p-8 gold-border card-glow max-w-md w-full"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="font-heading font-bold text-2xl gold-text">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Authorized access only</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="w-full bg-secondary rounded-lg px-3 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary min-h-[48px]"
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-secondary rounded-lg px-3 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary min-h-[48px]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={18} />
            {loading ? 'Verifying...' : 'Sign In as Admin'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
