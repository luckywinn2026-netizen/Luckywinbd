import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import logo from '@/assets/lucky-win-bd-logo.png';

interface SplashScreenProps {
  show: boolean;
}

const SplashScreen = ({ show }: SplashScreenProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!show) return;
    const start = Date.now();
    const duration = 400;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #0f2447 0%, #061125 60%, #020a18 100%)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated gold particle ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: '0 0 6px 2px rgba(255,215,0,0.4)',
                  transform: `translate(${Math.cos((angle * Math.PI) / 180) * 130}px, ${Math.sin((angle * Math.PI) / 180) * 130}px)`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0.6, 1], scale: [0, 1.2, 0.8, 1] }}
                transition={{ duration: 1, delay: i * 0.04, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Rotating outer ring */}
          <motion.div
            className="absolute"
            style={{
              width: 280,
              height: 280,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#FFD700',
              borderRightColor: 'rgba(255,215,0,0.3)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />

          {/* Rotating inner ring (opposite) */}
          <motion.div
            className="absolute"
            style={{
              width: 240,
              height: 240,
              borderRadius: '50%',
              border: '1.5px solid transparent',
              borderBottomColor: '#FFA500',
              borderLeftColor: 'rgba(255,165,0,0.3)',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          />

          {/* Pulsing glow behind logo */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Logo */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 150, damping: 12 }}
          >
            <motion.img
              src={logo}
              alt="Lucky Win"
              className="w-44 h-44 object-contain drop-shadow-[0_0_30px_rgba(255,215,0,0.5)]"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Progress bar */}
            <div className="mt-6 w-48 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            <motion.p
              className="mt-3 text-xs font-heading tracking-[0.3em] uppercase"
              style={{ color: 'rgba(255,215,0,0.7)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {progress < 100 ? `Loading ${progress}%` : 'PLAY & WIN BIG'}
            </motion.p>
          </motion.div>

          {/* Floating sparkles — fixed positions to avoid CLS */}
          {[
            { left: '12%', top: '20%', delay: 0.3 }, { left: '85%', top: '25%', delay: 0.6 },
            { left: '25%', top: '70%', delay: 0.9 }, { left: '75%', top: '65%', delay: 1.2 },
            { left: '50%', top: '15%', delay: 0.5 }, { left: '40%', top: '80%', delay: 0.8 },
          ].map((s, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute text-sm"
              style={{ left: s.left, top: s.top }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: [0, -30] }}
              transition={{ duration: 2, delay: s.delay, repeat: Infinity, repeatDelay: 2 }}
            >
              ✦
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
