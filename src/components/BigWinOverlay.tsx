import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BigWinOverlayProps {
  active: boolean;
  amount: number;
  type: 'big_win' | 'mega_win' | 'jackpot';
  jackpotLabel?: string;
  onComplete?: () => void;
}

const COIN_EMOJIS = ['🪙', '💰', '💵', '💎', '✨', '⭐'];

const FallingCoin = ({ delay, index }: { delay: number; index: number }) => {
  const x = Math.random() * 100;
  const size = 16 + Math.random() * 20;
  const drift = (Math.random() - 0.5) * 80;
  const dur = 2 + Math.random() * 1.5;
  const emoji = COIN_EMOJIS[index % COIN_EMOJIS.length];
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -30, fontSize: size, zIndex: 60 }}
      initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 0 }}
      animate={{
        opacity: [1, 1, 1, 0],
        y: [0, 200, 500, 800],
        x: [0, drift * 0.4, drift * 0.8, drift],
        rotate: [0, 180, 360, 540],
        scale: [0, 1.2, 1, 0.6],
      }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}
    >
      {emoji}
    </motion.div>
  );
};

const CountingNumber = ({ target, duration = 2000 }: { target: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  const animRef = useRef<number>();
  const startRef = useRef(0);

  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target, duration]);

  return <>{display.toLocaleString()}</>;
};

export default function BigWinOverlay({ active, amount, type, jackpotLabel, onComplete }: BigWinOverlayProps) {
  useEffect(() => {
    if (!active) return;
    const dur = type === 'jackpot' ? 6000 : 5000;
    const t = setTimeout(() => onComplete?.(), dur);
    return () => clearTimeout(t);
  }, [active, type, onComplete]);

  const titleText = type === 'jackpot'
    ? `🏆 ${jackpotLabel || 'JACKPOT'}!`
    : type === 'mega_win'
      ? 'MEGA WIN'
      : 'BIG WIN';

  const coinCount = type === 'jackpot' ? 80 : 70;
  const countDuration = type === 'jackpot' ? 3000 : type === 'mega_win' ? 2500 : 2000;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
        >
          {/* Radial burst */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: [0, 2, 2.5], opacity: [0.8, 0.3, 0] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              background: type === 'jackpot'
                ? 'radial-gradient(circle, rgba(255,215,0,0.5), rgba(255,136,0,0.2), transparent)'
                : 'radial-gradient(circle, rgba(0,255,100,0.4), rgba(255,215,0,0.2), transparent)',
            }}
          />

          {/* Rotating light rays */}
          <motion.div
            className="absolute w-[500px] h-[500px]"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{
              background: `conic-gradient(
                transparent 0deg, rgba(255,215,0,0.08) 15deg, transparent 30deg,
                transparent 45deg, rgba(255,215,0,0.08) 60deg, transparent 75deg,
                transparent 90deg, rgba(255,215,0,0.08) 105deg, transparent 120deg,
                transparent 135deg, rgba(255,215,0,0.08) 150deg, transparent 165deg,
                transparent 180deg, rgba(255,215,0,0.08) 195deg, transparent 210deg,
                transparent 225deg, rgba(255,215,0,0.08) 240deg, transparent 255deg,
                transparent 270deg, rgba(255,215,0,0.08) 285deg, transparent 300deg,
                transparent 315deg, rgba(255,215,0,0.08) 330deg, transparent 345deg
              )`,
            }}
          />

          {/* Falling coins */}
          {Array.from({ length: coinCount }).map((_, i) => (
            <FallingCoin key={i} delay={i * 0.04} index={i} />
          ))}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Title text — BIG WIN style like reference image */}
            <motion.div
              initial={{ scale: 0, y: -50 }}
              animate={{ scale: [0, 1.3, 1], y: [-50, 10, 0] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative mb-4"
            >
              {/* Glow layer behind text */}
              <div className="absolute inset-0 blur-xl" style={{
                background: type === 'jackpot'
                  ? 'radial-gradient(ellipse, rgba(255,215,0,0.6), transparent)'
                  : 'radial-gradient(ellipse, rgba(0,200,100,0.5), transparent)',
              }} />

              <motion.h1
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="relative font-black text-center"
                style={{
                  fontSize: type === 'jackpot' ? 52 : 56,
                  lineHeight: 1.1,
                  background: type === 'jackpot'
                    ? 'linear-gradient(180deg, #ffd700 0%, #ff8800 50%, #ffd700 100%)'
                    : 'linear-gradient(180deg, #00ff88 0%, #00cc44 30%, #008833 60%, #00ff88 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                  WebkitTextStroke: type === 'jackpot' ? '2px #b8860b' : '2px #006622',
                  letterSpacing: '2px',
                }}
              >
                {titleText}
              </motion.h1>

              {/* Sparkle accents around title */}
              {[
                { x: -60, y: -20, delay: 0 },
                { x: 60, y: -15, delay: 0.2 },
                { x: -40, y: 25, delay: 0.4 },
                { x: 50, y: 30, delay: 0.3 },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{ left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)` }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.2, delay: s.delay, repeat: Infinity, repeatDelay: 0.5 }}
                >
                  ✨
                </motion.div>
              ))}
            </motion.div>

            {/* Win amount panel — gold bordered box like reference */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
              className="relative px-8 py-3 rounded-xl min-w-[260px]"
              style={{
                background: 'linear-gradient(180deg, #003a10 0%, #001a08 50%, #003a10 100%)',
                border: '3px solid #ffd700',
                boxShadow: '0 0 30px rgba(255,215,0,0.3), inset 0 0 20px rgba(255,215,0,0.05), 0 0 0 6px #8B6914',
              }}
            >
              {/* Ornate gold corner accents */}
              {['top-[-4px] left-[-4px]', 'top-[-4px] right-[-4px]', 'bottom-[-4px] left-[-4px]', 'bottom-[-4px] right-[-4px]'].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-4 h-4`} style={{
                  background: 'radial-gradient(circle at 50% 50%, #ffe066, #b8860b)',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(255,215,0,0.5)',
                }} />
              ))}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center font-black"
                style={{
                  fontSize: 42,
                  background: 'linear-gradient(180deg, #ffd700 0%, #ffaa00 40%, #ff8800 80%, #ffd700 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 6px rgba(255,215,0,0.4))',
                }}
              >
                ৳<CountingNumber target={amount} duration={countDuration} />
              </motion.p>
            </motion.div>

            {/* Multiplier badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
              className="mt-3 px-4 py-1 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,136,0,0.15))',
                border: '1px solid rgba(255,215,0,0.4)',
              }}
            >
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>
                {amount > 0 ? `${(amount).toLocaleString()}x WIN` : ''}
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
