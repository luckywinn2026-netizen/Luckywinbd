import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  type: 'confetti' | 'sparkle' | 'coin';
}

const COLORS = [
  'hsl(43 96% 56%)',   // gold
  'hsl(45 100% 70%)',  // gold-light
  'hsl(0 84% 60%)',    // red
  'hsl(142 76% 46%)',  // green
  'hsl(200 80% 55%)',  // blue
  'hsl(280 70% 60%)',  // purple
  'hsl(30 100% 55%)',  // orange
];

const COIN_EMOJIS = ['🪙', '💰', '✨', '⭐', '🎉'];

export default function WinCelebration({ active, multiplier = 1 }: { active: boolean; multiplier?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }

    const count = multiplier >= 5 ? 40 : multiplier >= 3 ? 28 : 18;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      size: 6 + Math.random() * 10,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      type: Math.random() > 0.7 ? 'sparkle' : Math.random() > 0.5 ? 'coin' : 'confetti',
    }));
    setParticles(newParticles);

    const t = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(t);
  }, [active, multiplier]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: `${p.y}%`, opacity: 1, rotate: 0, scale: 0 }}
              animate={{
                y: '120%',
                rotate: p.rotation + 360 * (Math.random() > 0.5 ? 1 : -1),
                x: `${p.x + (Math.random() - 0.5) * 30}vw`,
                scale: [0, 1.2, 1],
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8 + Math.random() * 1.2, ease: 'easeOut' }}
              className="absolute"
              style={{ fontSize: p.size }}
            >
              {p.type === 'coin' ? (
                <span>{COIN_EMOJIS[Math.floor(Math.random() * COIN_EMOJIS.length)]}</span>
              ) : p.type === 'sparkle' ? (
                <svg width={p.size} height={p.size} viewBox="0 0 20 20">
                  <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill={p.color} />
                </svg>
              ) : (
                <div
                  style={{
                    width: p.size,
                    height: p.size * 0.6,
                    background: p.color,
                    borderRadius: 2,
                  }}
                />
              )}
            </motion.div>
          ))}

          {/* Central burst glow */}
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(43 96% 56% / 0.6), transparent)' }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
