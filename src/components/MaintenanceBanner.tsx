import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles } from 'lucide-react';
import logo from '@/assets/lucky-win-bd-logo.png';

interface Props {
  message: string;
  fullScreen?: boolean;
}

export default function MaintenanceBanner({ message, fullScreen }: Props) {
  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center navy-gradient overflow-hidden"
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(43_96%_56%),transparent_50%)]" />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-primary/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="relative w-full max-w-md mx-6"
        >
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl gold-border p-8 md:p-10 shadow-2xl shadow-black/40">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex justify-center mb-6"
            >
              <img src={logo} alt="Lucky Win" className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-lg" />
            </motion.div>

            {/* Trust badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex items-center justify-center gap-2 mb-4"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <ShieldCheck size={16} className="text-primary" />
                <span className="text-xs font-heading font-bold text-primary">Scheduled Maintenance</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-heading font-bold text-xl md:text-2xl text-center text-foreground mb-2"
            >
              We're Upgrading Your Experience
            </motion.h1>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-muted-foreground text-center text-sm md:text-base leading-relaxed mb-6"
            >
              {message}
            </motion.p>

            {/* Reassurance */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex items-center justify-center gap-2 text-primary/80"
            >
              <Sparkles size={18} className="flex-shrink-0" />
              <span className="text-sm font-heading font-semibold">We'll be back shortly. Thank you for your patience.</span>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500/95 backdrop-blur-sm text-amber-950 shadow-lg"
    >
      <div className="flex items-center justify-center gap-3 py-3 px-4">
        <Wrench size={22} className="flex-shrink-0" />
        <p className="font-heading font-bold text-sm md:text-base text-center">{message}</p>
      </div>
    </motion.div>
  );
}
