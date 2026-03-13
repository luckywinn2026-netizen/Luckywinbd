import { useAuth } from '@/contexts/AuthContext';
import { Lock, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';

const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { user, openAuth } = useAuth();

  if (user) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl p-8 gold-border card-glow max-w-sm w-full"
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-primary" />
        </div>
        <h2 className="font-heading font-bold text-xl mb-2">Login Required</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Please sign in or create an account to play games.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => openAuth('login')}
            className="flex-1 py-3 rounded-xl font-heading font-bold bg-secondary text-foreground active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Sign In
          </button>
          <button
            onClick={() => openAuth('signup')}
            className="flex-1 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform"
          >
            Sign Up
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthGate;
