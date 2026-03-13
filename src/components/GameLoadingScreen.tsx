import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import logo from '@/assets/lucky-win-bd-logo.png';

interface GameLoadingScreenProps {
  show: boolean;
  gameName: string;
  onComplete: () => void;
  preloadImages?: string[];
}

const GameLoadingScreen = ({ show, gameName, onComplete, preloadImages = [] }: GameLoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const imagesLoadedRef = useRef(false);
  const progressReady = useRef(false);

  const stableOnComplete = useCallback(onComplete, []);

  // Preload all images
  useEffect(() => {
    if (!show || preloadImages.length === 0) {
      imagesLoadedRef.current = true;
      return;
    }

    imagesLoadedRef.current = false;
    let loaded = 0;
    const total = preloadImages.length;

    preloadImages.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= total) {
          imagesLoadedRef.current = true;
        }
      };
      img.src = src;
    });

    // Fallback: mark loaded after 800ms even if some fail
    const fallback = setTimeout(() => {
      imagesLoadedRef.current = true;
    }, 800);

    return () => clearTimeout(fallback);
  }, [show, preloadImages]);

  useEffect(() => {
    if (!show) {
      setProgress(0);
      progressReady.current = false;
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        // Hold at 90% until images are loaded
        if (prev >= 90 && !imagesLoadedRef.current) {
          return 90;
        }
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            stableOnComplete();
          }, 50);
          return 100;
        }
        const increment = prev < 50 ? 8 : prev < 80 ? 6 : prev < 90 ? 5 : 15;
        return Math.min(prev + increment, 100);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [show, stableOnComplete]);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(220 30% 8%) 50%, hsl(var(--background)) 100%)' }}
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, hsl(var(--primary) / 0.2) 0%, transparent 50%)',
              }}
            />
          </div>

          {/* Main Loading Container */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Circular Progress Ring */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="absolute w-48 h-48 -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100" cy="100" r={radius}
                  fill="none"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="6"
                  opacity="0.3"
                />
                <circle
                  cx="100" cy="100" r={radius}
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-100 ease-linear"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="50%" stopColor="hsl(45 100% 60%)" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" />
                  </linearGradient>
                </defs>
              </svg>

              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute w-40 h-40 rounded-full border border-primary/20"
              />

              <div className="relative z-10">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <img src={logo} alt="Lucky Win" className="w-20 h-20 object-contain drop-shadow-lg" />
                </motion.div>
              </div>

              <div className="absolute -bottom-1">
                <motion.div
                  key={Math.round(progress)}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="bg-card gold-border rounded-full px-3 py-1"
                >
                  <span className="font-heading font-extrabold text-sm gold-text">
                    {Math.round(progress)}%
                  </span>
                </motion.div>
              </div>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-heading font-extrabold text-xl gold-text text-center"
            >
              {gameName}
            </motion.h2>

            <div className="flex items-center gap-0.5 text-muted-foreground text-sm font-heading">
              Loading
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>.</motion.span>
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>.</motion.span>
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>.</motion.span>
            </div>

            <div className="w-48 h-1 bg-secondary/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full gold-gradient"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Floating particles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
              initial={{
                x: Math.random() * 300 - 150,
                y: Math.random() * 300 + 200,
                opacity: 0,
              }}
              animate={{
                y: -300,
                opacity: [0, 0.8, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GameLoadingScreen;
