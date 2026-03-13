import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';

interface VipCelebrationProps {
  tier: { name: string; icon: string } | null;
  onClose: () => void;
}

const particles = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.8,
  duration: 1.5 + Math.random() * 1.5,
  size: 6 + Math.random() * 10,
  color: ['hsl(var(--primary))', '#FFD700', '#FFA500', '#FF6347', '#7B68EE', '#00CED1'][i % 6],
}));

const VipCelebration = ({ tier, onClose }: VipCelebrationProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (tier) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 500);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [tier, onClose]);

  return (
    <AnimatePresence>
      {visible && tier && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => { setVisible(false); setTimeout(onClose, 500); }} />

          {/* Confetti particles */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${p.x}%`,
                top: '-5%',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              initial={{ y: 0, opacity: 1, rotate: 0 }}
              animate={{
                y: '110vh',
                opacity: [1, 1, 0],
                rotate: 360 + Math.random() * 360,
                x: [0, (Math.random() - 0.5) * 120],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Center card */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-3 p-8 rounded-3xl bg-card gold-border shadow-2xl max-w-xs mx-4"
            initial={{ scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
          >
            {/* Glow ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl opacity-40"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)',
              }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Icon */}
            <motion.div
              className="text-6xl"
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              {tier.icon}
            </motion.div>

            {/* Crown */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
            >
              <Crown size={28} className="text-primary" />
            </motion.div>

            {/* Text */}
            <motion.p
              className="text-sm font-heading text-muted-foreground tracking-wide uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Tier Upgraded!
            </motion.p>
            <motion.h2
              className="text-2xl font-heading font-extrabold gold-text text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              {tier.name}
            </motion.h2>

            <motion.button
              className="mt-2 px-6 py-2 rounded-xl gold-gradient font-heading font-bold text-sm text-primary-foreground active:scale-95 transition-transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={() => { setVisible(false); setTimeout(onClose, 500); }}
            >
              Awesome! 🎉
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VipCelebration;
