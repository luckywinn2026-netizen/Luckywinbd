import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Minus, Volume2, VolumeX, RotateCcw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getMultiplierSettings, pickSpecialIdxFromSettings } from '@/hooks/useMultiplierSettings';
import { FortuneWheelSound } from './FortuneWheelSoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { FORTUNE_WHEEL_PAYTABLE } from '@/config/paytableConfigs';

// ─── Constants ───
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const pickReel = (): number => Math.random() < 0.90 ? 0 : (1 + Math.floor(Math.random() * 9));

// 4th Reel: Special symbols
const SPECIAL_SYMBOLS = [
  { id: 'x1', label: '1x', type: 'multiplier' as const, value: 1 },
  { id: 'x500', label: '500x', type: 'multiplier' as const, value: 500 },
  { id: 'x2', label: '2x', type: 'multiplier' as const, value: 2 },
  { id: 'x200', label: '200x', type: 'multiplier' as const, value: 200 },
  { id: 'x3', label: '3x', type: 'multiplier' as const, value: 3 },
  { id: 'x100', label: '100x', type: 'multiplier' as const, value: 100 },
  { id: 'x5', label: '5x', type: 'multiplier' as const, value: 5 },
  { id: 'x25', label: '25x', type: 'multiplier' as const, value: 25 },
  { id: 'x10', label: '10x', type: 'multiplier' as const, value: 10 },
  { id: 'x15', label: '15x', type: 'multiplier' as const, value: 15 },
  { id: 'wheel', label: 'WHEEL', type: 'wheel' as const, value: 0 },
  { id: 'free', label: 'FREE', type: 'scatter' as const, value: 0 },
];

const getActiveReelCount = (bet: number): number => {
  if (bet >= 20) return 3;
  if (bet >= 10) return 2;
  return 1;
};

const getLowTierSpecialIdx = (): number => {
  const options = [0, 2, 4]; // 1x, 2x, 3x
  return options[Math.floor(Math.random() * options.length)];
};

const getMidTierSpecialIdx = (): number => {
  const options = [0, 0, 2, 2, 4, 4, 6, 8]; // weighted toward low
  return options[Math.floor(Math.random() * options.length)];
};

// ─── Coin Particle ───
const CoinParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const emoji = ['🪙', '💰', '💎', '👑', '🏆'][Math.floor(Math.random() * 5)];
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60, fontSize: s * 0.8 }}
      initial={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      animate={{ opacity: [1, 1, 1, 0], y: [0, 150, 350, 550], x: [0, drift * 0.3, drift * 0.7, drift], rotate: [0, 180, 360], scale: [0.8, 1, 0.9, 0.6] }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}
    >{emoji}</motion.div>
  );
};

// ─── Fire Particle ───
const FireParticle = ({ delay }: { delay: number }) => {
  const x = 30 + Math.random() * 40;
  const drift = (Math.random() - 0.5) * 60;
  return (
    <motion.div
      className="absolute pointer-events-none text-xl"
      style={{ left: `${x}%`, bottom: 0, zIndex: 55 }}
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -80, -200, -350], x: [0, drift * 0.5, drift], scale: [0.5, 1.2, 0.8, 0.3] }}
      transition={{ duration: 1.5 + Math.random(), delay, ease: 'easeOut' }}
    >🔥</motion.div>
  );
};

// ─── 3D Cylinder Reel (Red-Gold Royal Theme) ───
const CELL_H = 60;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

const CylinderReel = ({
  finalDigit, spinning, reelIndex, onStop, soundEnabled, isWin, spinId, turbo, locked,
}: {
  finalDigit: number; spinning: boolean; reelIndex: number; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; turbo: boolean; locked?: boolean;
}) => {
  const [rotationX, setRotationX] = useState(-(finalDigit * FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalDigit * FACE_ANGLE));
  const SPIN_DURATION = turbo ? (100 + reelIndex * 30) : (150 + reelIndex * 50);
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (locked && spinning) onStop();
  }, [locked, spinning]);

  useEffect(() => {
    if (!spinning || locked) return;
    landingTriggered.current = false;
    const speed = turbo ? 14 : (8 + reelIndex * 1.5);
    const animate = () => {
      currentAngleRef.current -= speed;
      setRotationX(currentAngleRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning]);

  useEffect(() => {
    if (!spinning || landingTriggered.current || locked) return;
    if (spinId === lastSpinIdRef.current) return;
    lastSpinIdRef.current = spinId;
    landingTriggered.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startAngle = currentAngleRef.current;
    const fullRotations = turbo ? 1 : (2 + reelIndex);
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalDigit * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.7) {
        eased = progress / 0.7 * 0.85;
      } else {
        const t = (progress - 0.7) / 0.3;
        const decel = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.015 * (1 - t);
        eased = 0.85 + 0.15 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.005);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);
      if (soundEnabled && !turbo) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / FACE_ANGLE);
        const curFace = Math.floor(Math.abs(currentAngle) / FACE_ANGLE);
        if (curFace !== prevFace) FortuneWheelSound.tick();
      }
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalDigit * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) FortuneWheelSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 210;

  const faces = DIGITS.map((digit, i) => (
    <div key={i} className="absolute w-full flex items-center justify-center"
      style={{
        height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`,
        transform: `rotateX(${i * FACE_ANGLE}deg) translateZ(${CYLINDER_RADIUS}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      <span className="select-none font-black" style={{
        fontSize: 44,
        background: 'linear-gradient(180deg, #ffd700 0%, #ffaa00 40%, #ff6600 80%, #cc3300 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: isWin && !spinning ? 'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
      }}>{digit}</span>
    </div>
  ));

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #2a0000 0%, #4d0000 6%, #800000 12%, #1a0a0a 16%, #2a1515 25%, #351c1c 40%, #3d2020 50%, #351c1c 60%, #2a1515 75%, #1a0a0a 84%, #800000 88%, #4d0000 94%, #2a0000 100%)',
        border: '3px solid #ffd700',
        boxShadow: '0 0 0 2px #8B0000, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,215,0,0.05), 0 0 15px rgba(255,215,0,0.15)',
      }}>
        {/* Gold rivets */}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}

        {/* Red/gold bands */}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #1a0000, #3a0000, #800000, rgba(128,0,0,0))', borderBottom: '2px solid #ffd700', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #1a0000, #3a0000, #800000, rgba(128,0,0,0))', borderTop: '2px solid #ffd700', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />

        {/* 3D Cylinder viewport */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.04) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>

        {/* Gold ring trim */}
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b, transparent 95%)' }} />
      </div>

      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ borderRadius: '50% / 14%' }}>
          <div className="absolute inset-0" style={{ borderRadius: '50% / 14%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }} />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <span style={{ fontSize: 28 }}>🔒</span>
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,215,0,0.5)' }}>LOCKED</span>
          </div>
        </div>
      )}

      {isWin && !spinning && !locked && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(255,215,0,0.9), inset 0 0 30px rgba(255,215,0,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── 4th Reel: Lucky Reel (Multipliers + Wheel + Free) ───
const SP_FACES = SPECIAL_SYMBOLS.length;
const SP_FACE_ANGLE = 360 / SP_FACES;
const SP_CELL_H = 54;
const SP_RADIUS = (SP_CELL_H / 2) / Math.tan(Math.PI / SP_FACES);

const LuckyReel = ({
  finalIdx, spinning, onStop, soundEnabled, isWin, spinId, turbo,
}: {
  finalIdx: number; spinning: boolean; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; turbo: boolean;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIdx * SP_FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIdx * SP_FACE_ANGLE));
  const SPIN_DURATION = turbo ? 200 : 300;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = turbo ? 12 : 7;
    const animate = () => {
      currentAngleRef.current -= speed;
      setRotationX(currentAngleRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning]);

  useEffect(() => {
    if (!spinning || landingTriggered.current) return;
    if (spinId === lastSpinIdRef.current) return;
    lastSpinIdRef.current = spinId;
    landingTriggered.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startAngle = currentAngleRef.current;
    const fullRotations = turbo ? 2 : 4;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * SP_FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.7) {
        eased = progress / 0.7 * 0.85;
      } else {
        const t = (progress - 0.7) / 0.3;
        const decel = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.02 * (1 - t);
        eased = 0.85 + 0.15 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.005);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalIdx * SP_FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) {
          FortuneWheelSound.reelStop(3);
          if (finalIdx === 0) setTimeout(() => FortuneWheelSound.nearMiss(), 150);
        }
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 210;

  const getSymbolStyle = (sym: typeof SPECIAL_SYMBOLS[0]) => {
    if (sym.type === 'scatter') return { color: '#ff00ff', glow: 'drop-shadow(0 0 12px rgba(255,0,255,0.8))', fontSize: 18 };
    if (sym.type === 'wheel') return { color: '#00ffcc', glow: 'drop-shadow(0 0 12px rgba(0,255,200,0.8))', fontSize: 18 };
    if (sym.value >= 100) return { color: '#ff4444', glow: 'drop-shadow(0 0 10px rgba(255,68,68,0.6))', fontSize: 16 };
    if (sym.value >= 20) return { color: '#ff8800', glow: 'drop-shadow(0 0 8px rgba(255,136,0,0.5))', fontSize: 15 };
    if (sym.value >= 5) return { color: '#ffd700', glow: 'drop-shadow(0 0 6px rgba(255,215,0,0.4))', fontSize: 14 };
    return { color: '#aaa', glow: 'none', fontSize: 13 };
  };

  const faces = SPECIAL_SYMBOLS.map((sym, i) => {
    const style = getSymbolStyle(sym);
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{
          height: SP_CELL_H, top: `calc(50% - ${SP_CELL_H / 2}px)`,
          transform: `rotateX(${i * SP_FACE_ANGLE}deg) translateZ(${SP_RADIUS}px)`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="flex flex-col items-center gap-0 select-none">
          {sym.type === 'scatter' && <span style={{ fontSize: 22, filter: style.glow }}>💫</span>}
          {sym.type === 'wheel' && <span style={{ fontSize: 22, filter: style.glow }}>🎡</span>}
          {sym.type === 'multiplier' && (
            <span className="font-black" style={{
              fontSize: style.fontSize, color: style.color, filter: style.glow,
              textShadow: `0 0 8px ${style.color}40`,
            }}>{sym.label}</span>
          )}
          {sym.type !== 'multiplier' && (
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: style.color }}>{sym.label}</span>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 76, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #2a1500 0%, #4d2600 6%, #804000 12%, #1a100a 16%, #2a1a10 25%, #352215 40%, #3d2a1a 50%, #352215 60%, #2a1a10 75%, #1a100a 84%, #804000 88%, #4d2600 94%, #2a1500 100%)',
        border: '3px solid #ff8800',
        boxShadow: '0 0 0 2px #663300, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,136,0,0.05), 0 0 15px rgba(255,136,0,0.15)',
      }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ff9944, #cc6600)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ff9944, #cc6600)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #1a0800, #3a1500, #804000, rgba(128,64,0,0))', borderBottom: '2px solid #ff8800', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #1a0800, #3a1500, #804000, rgba(128,64,0,0))', borderTop: '2px solid #ff8800', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.04) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #cc6600, #ff8800, #ffaa44, #ff8800, #cc6600, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #cc6600, #ff8800, #ffaa44, #ff8800, #cc6600, transparent 95%)' }} />
      </div>

      <div className="absolute -top-5 left-0 right-0 text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#ff8800' }}>✦ LUCKY ✦</span>
      </div>

      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(255,136,0,0.9), inset 0 0 30px rgba(255,136,0,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Bonus Wheel Modal ───
const WHEEL_PRIZES = [
  { label: '2x', value: 2, color: '#cc0000' },
  { label: '5x', value: 5, color: '#ffd700' },
  { label: '10x', value: 10, color: '#cc0000' },
  { label: '20x', value: 20, color: '#ffd700' },
  { label: '50x', value: 50, color: '#cc0000' },
  { label: '3x', value: 3, color: '#ffd700' },
  { label: '15x', value: 15, color: '#cc0000' },
  { label: '100x', value: 100, color: '#ffd700' },
];

const BonusWheel = ({ onResult, betAmount, soundEnabled, predeterminedMult }: {
  onResult: (mult: number) => void; betAmount: number; soundEnabled: boolean; predeterminedMult: number;

}) => {
  const [rotation, setRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const segAngle = 360 / WHEEL_PRIZES.length;

  useEffect(() => {
    // Auto-start wheel spin
    setTimeout(() => startWheelSpin(), 200);
  }, []);

  const startWheelSpin = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    if (soundEnabled) FortuneWheelSound.wheelSpin();

    // Use the predetermined multiplier - find its index
    let prizeIdx = WHEEL_PRIZES.findIndex(p => p.value === predeterminedMult);
    if (prizeIdx < 0) prizeIdx = 0;

    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle = fullSpins * 360 + (360 - prizeIdx * segAngle - segAngle / 2);
    
    setRotation(targetAngle);
    
    setTimeout(() => {
      setWheelSpinning(false);
      setResult(WHEEL_PRIZES[prizeIdx].value);
      if (soundEnabled) FortuneWheelSound.wheelStop();
      setTimeout(() => onResult(WHEEL_PRIZES[prizeIdx].value), 200);
    }, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
    >
      {/* Fire particles */}
      {Array.from({ length: 15 }).map((_, i) => (
        <FireParticle key={i} delay={i * 0.15} />
      ))}

      <div className="relative">
        <motion.p initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-center font-extrabold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg, #ffd700, #ff6600)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🎡 BONUS WHEEL! 🎡
        </motion.p>

        {/* Wheel */}
        <div className="relative w-72 h-72 mx-auto">
          {/* Arrow pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-2xl">▼</div>
          
          <div className="w-full h-full rounded-full overflow-hidden relative"
            style={{
              border: '4px solid #ffd700',
              boxShadow: '0 0 40px rgba(255,215,0,0.4), 0 0 80px rgba(255,100,0,0.2)',
              transform: `rotate(${rotation}deg)`,
              transition: wheelSpinning ? 'transform 1s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {WHEEL_PRIZES.map((prize, i) => {
              const startAngle = i * segAngle;
              const midAngle = startAngle + segAngle / 2;
              return (
                <div key={i} className="absolute inset-0" style={{
                  background: `conic-gradient(from ${startAngle}deg, ${prize.color} 0deg, ${prize.color} ${segAngle}deg, transparent ${segAngle}deg)`,
                  clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segAngle - 90) * Math.PI / 180)}%)`,
                }}>
                  <div className="absolute" style={{
                    top: `${50 - 35 * Math.cos(midAngle * Math.PI / 180)}%`,
                    left: `${50 + 35 * Math.sin(midAngle * Math.PI / 180)}%`,
                    transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                  }}>
                    <span className="font-black text-sm text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{prize.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center */}
          <div className="absolute inset-[35%] rounded-full flex items-center justify-center z-10"
            style={{ background: 'radial-gradient(circle, #ffd700, #b8860b)', border: '3px solid #fff', boxShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
            <span className="font-black text-sm text-black">SPIN</span>
          </div>
        </div>

        {/* Result display */}
        <AnimatePresence>
          {result !== null && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="text-center mt-4">
              <p className="font-extrabold text-3xl" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                {result}x MULTIPLIER!
              </p>
              <p className="text-sm mt-1 animate-pulse" style={{ color: 'rgba(255,215,0,0.6)' }}>
                Applying multiplier...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Coin confetti */}
      {result !== null && Array.from({ length: 30 }).map((_, i) => (
        <CoinParticle key={`wc-${i}`} delay={i * 0.04} size={i < 10 ? 'lg' : 'md'} />
      ))}
    </motion.div>
  );
};

// ─── Main Game ───
const FortuneWheelGame = () => {
  const navigate = useNavigate();
  const { balance, addWin, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelDigits, setReelDigits] = useState<number[]>([7, 7, 7]);
  const [specialIdx, setSpecialIdx] = useState(9); // 15x
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [showMultiplierAnim, setShowMultiplierAnim] = useState(false);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showMegaWin, setShowMegaWin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [inFreeSpinMode, setInFreeSpinMode] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [showBonusWheel, setShowBonusWheel] = useState(false);
  const bonusWheelMultRef = useRef(2);
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number; winAmount?: number; newBalance: number | null }>({ outcome: 'loss', maxWinAmount: 0, newBalance: null });

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('fortune-wheel', 'Lucky Fortune Wheel', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const adjustBet = (dir: number) => {
    if (spinning || inFreeSpinMode) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setBetAmount(steps[newIdx]);
    if (soundEnabled) FortuneWheelSound.buttonClick();
  };

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => prev + 1);
  }, []);

  const activeReels = getActiveReelCount(betAmount);

  // Evaluate win when all 4 reels stop
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    setSpinning(false);
    setStoppedReels(0);

    const oc = outcomeRef.current;

    // ─── LOSS CHECK FIRST ───
    if (oc.outcome === 'loss') {
      setActiveMultiplier(1);
      handleLoss();
      if (inFreeSpinMode) {
        const remaining = freeSpins - 1;
        setFreeSpins(remaining);
        if (remaining <= 0) { setInFreeSpinMode(false); gameToast.info('Free spins ended!'); }
      }
      if (autoSpinRef.current || (inFreeSpinMode && freeSpins > 1)) {
        setTimeout(() => { spinRef.current(); }, 200);
      }
      return;
    }

    const [d1, d2, d3] = reelDigits;
    const combinedNumber = d1 * 100 + d2 * 10 + d3;
    const special = SPECIAL_SYMBOLS[specialIdx];

    // Bonus wheel trigger
    if (special.type === 'wheel' && combinedNumber > 0) {
      setShowBonusWheel(true);
      return;
    }

    let mult = 1;
    if (special.type === 'multiplier') mult = special.value;
    if (inFreeSpinMode && mult < 5) mult = 5;

    setActiveMultiplier(mult);
    if (mult > 1) {
      setShowMultiplierAnim(true);
      if (soundEnabled) FortuneWheelSound.multiplierActivate();
      setTimeout(() => setShowMultiplierAnim(false), 400);
    }

    if (special.type === 'scatter' && !inFreeSpinMode) {
      setFreeSpins(10); setInFreeSpinMode(true);
      if (soundEnabled) FortuneWheelSound.freeSpinStart();
      gameToast.success('💫 SCATTER! 10 Free Spins! Min 5x multiplier!');
    }

    const effectiveMult = mult === 0 ? 1 : mult;
    const totalWin = combinedNumber * effectiveMult;
    if (totalWin > 0) {
      let cappedWin = totalWin;
      const hardCap = oc.maxWinAmount || 0;
      if (hardCap > 0 && cappedWin > hardCap) cappedWin = hardCap;
      // Use backend amount as authoritative — avoids mismatch (both regular and free spin)
      const backendWin = Math.round(oc.maxWinAmount ?? oc.winAmount ?? 0);
      const actualWin = backendWin > 0 ? backendWin : cappedWin;
      processWin(actualWin);
    } else {
      handleLoss();
    }

    if (inFreeSpinMode) {
      const remaining = freeSpins - 1;
      setFreeSpins(remaining);
      if (remaining <= 0) { setInFreeSpinMode(false); gameToast.info('Free spins ended!'); }
    }

    if (autoSpinRef.current || (inFreeSpinMode && freeSpins > 1)) {
      setTimeout(() => { spinRef.current(); }, 200);
    }
  }, [stoppedReels]);

  const handleBonusWheelResult = (mult: number) => {
    setShowBonusWheel(false);
    const [d1, d2, d3] = reelDigits;
    const combinedNumber = d1 * 100 + d2 * 10 + d3;
    const totalWin = combinedNumber * mult;
    const oc = outcomeRef.current;
    let cappedWin = totalWin;
    const hardCap = oc.maxWinAmount || 0;
    if (hardCap > 0 && cappedWin > hardCap) cappedWin = hardCap;
    const backendWin = Math.round(oc.maxWinAmount ?? oc.winAmount ?? 0);
    const actualWin = backendWin > 0 ? backendWin : cappedWin;
    if (actualWin > 0) processWin(actualWin);
    else handleLoss();
  };

  const processWin = (cappedWin: number) => {
    setLastWin(cappedWin);
    setWinMultiplier(Math.round(cappedWin / betAmount * 10) / 10);
    setIsWin(true);

    const serverOutcome = outcomeRef.current.outcome;
    if (serverOutcome === 'mega_win') {
      setShowMegaWin(true); setShowConfetti(true); setScreenShake(true);
      if (soundEnabled) FortuneWheelSound.megaWin();
      setTimeout(() => { setShowMegaWin(false); setShowConfetti(false); setScreenShake(false); }, 800);
    } else if (serverOutcome === 'big_win') {
      setShowBigWin(true); setShowConfetti(true);
      if (soundEnabled) FortuneWheelSound.bigWin();
      setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600);
    } else if (serverOutcome === 'medium_win' || cappedWin >= betAmount) {
      setShowConfetti(true);
      if (soundEnabled) FortuneWheelSound.win();
      setTimeout(() => { setShowConfetti(false); }, 500);
    } else {
      if (soundEnabled) FortuneWheelSound.win();
    }

    if (inFreeSpinMode) addWin(cappedWin, 'Fortune Wheel', 'slot', cappedWin / betAmount, betAmount, 'fortune-wheel');
    else if (outcomeRef.current.newBalance !== null) applyAuthoritativeBalance(outcomeRef.current.newBalance);
  };

  const handleLoss = () => {
    setLastWin(0);
    setWinMultiplier(0);
    setIsWin(false);
    if (soundEnabled) FortuneWheelSound.loss();
    if (!inFreeSpinMode && outcomeRef.current.newBalance !== null) applyAuthoritativeBalance(outcomeRef.current.newBalance);
  };

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!inFreeSpinMode && betAmount > balance) { gameToast.error('Insufficient balance'); return; }

    setLastWin(0); setWinMultiplier(0); setIsWin(false);
    setShowBigWin(false); setShowMegaWin(false);
    setActiveMultiplier(1); setShowMultiplierAnim(false);

    if (soundEnabled) FortuneWheelSound.spin();
    setStoppedReels(0);
    setSpinning(true);

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = inFreeSpinMode
        ? await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'fortune-wheel', is_free_spin: true })
        : await api.sharedSlotSpin({ bet: betAmount, game_id: 'fortune-wheel', game_name: 'Fortune Wheel' });
      if (data && data.outcome) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      return;
    }
    outcomeRef.current = outcome;

    const activeCount = getActiveReelCount(betAmount);

    // Pick 4th reel FIRST so we know the multiplier
    let specialResult: number;
    if (outcome.outcome === 'mega_win') {
      specialResult = [3, 5, 7].at(Math.floor(Math.random() * 3))!; // 200x, 100x, 25x
    } else if (outcome.outcome === 'big_win') {
      specialResult = [6, 8, 9].at(Math.floor(Math.random() * 3))!; // 5x, 10x, 15x
    } else if (inFreeSpinMode) {
      specialResult = [4, 6, 8, 9].at(Math.floor(Math.random() * 4))!;
    } else if (activeCount === 1) {
      specialResult = getLowTierSpecialIdx();
    } else if (activeCount === 2) {
      specialResult = getMidTierSpecialIdx();
    } else {
      const ms = await getMultiplierSettings();
      specialResult = pickSpecialIdxFromSettings(ms);
    }

    // Tease: show high multiplier on loss
    if (outcome.outcome === 'loss' && Math.random() < 0.25) {
      specialResult = 1; // 500x tease
    }

    // Determine maxWin
    const hardCap = Math.max(outcome.maxWinAmount || 0, 0) || (betAmount * 25);

    // Downgrade 4th reel multiplier if it exceeds what hardCap can support
    if (outcome.outcome !== 'loss') {
      const getMultVal = (idx: number) => {
        const s = SPECIAL_SYMBOLS[idx];
        return s.type === 'multiplier' ? s.value : 1;
      };
      let currentMult = getMultVal(specialResult);
      if (inFreeSpinMode && currentMult < 5) currentMult = 5;
      if (currentMult > 1 && hardCap / currentMult < 1) {
        const sortedIndices = SPECIAL_SYMBOLS
          .map((s, i) => ({ i, v: s.type === 'multiplier' ? s.value : 1 }))
          .filter(x => x.v <= hardCap && x.v >= 1)
          .sort((a, b) => b.v - a.v);
        if (sortedIndices.length > 0) {
          specialResult = sortedIndices[0].i;
        } else {
          specialResult = 0;
        }
      }
    }

    // Calculate the effective multiplier from 4th reel
    const specialSym = SPECIAL_SYMBOLS[specialResult];
    let effectiveMult = 1;
    if (specialSym.type === 'multiplier') effectiveMult = specialSym.value;
    if (inFreeSpinMode && effectiveMult < 5) effectiveMult = 5;

    // If bonus wheel, pre-determine wheel result and use it for digit capping
    if (specialSym.type === 'wheel') {
      const weights = [30, 25, 15, 10, 3, 28, 12, 2];
      const total = weights.reduce((a, b) => a + b, 0);
      let rr = Math.random() * total;
      let pIdx = 0;
      for (let i = 0; i < weights.length; i++) { rr -= weights[i]; if (rr <= 0) { pIdx = i; break; } }
      const preMultiplier = WHEEL_PRIZES[pIdx].value;
      bonusWheelMultRef.current = preMultiplier;
      effectiveMult = preMultiplier;
    }

    const maxCombined = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 999;

    let finalDigits: number[];

    if (outcome.outcome === 'loss') {
      const r = () => Math.floor(Math.random() * 10);
      finalDigits = [r(), r(), r()];
    } else {
      // Generate digits based on outcome tier, then cap to maxCombined
      let targetNumber: number;
      if (outcome.outcome === 'mega_win') {
        targetNumber = Math.min(700 + Math.floor(Math.random() * 299), maxCombined);
      } else if (outcome.outcome === 'big_win') {
        targetNumber = Math.min(200 + Math.floor(Math.random() * 500), maxCombined);
      } else if (outcome.outcome === 'medium_win') {
        targetNumber = Math.min(10 + Math.floor(Math.random() * 190), maxCombined);
      } else {
        // small_win
        targetNumber = Math.min(1 + Math.floor(Math.random() * 9), maxCombined);
      }
      if (targetNumber <= 0) targetNumber = 1;

      finalDigits = [
        Math.floor(targetNumber / 100) % 10,
        Math.floor(targetNumber / 10) % 10,
        targetNumber % 10,
      ];
    }

    if (activeCount === 2) finalDigits[0] = 0;
    else if (activeCount === 1) { finalDigits[0] = 0; finalDigits[1] = 0; }

    setReelDigits(finalDigits);

    setSpecialIdx(specialResult);
    setSpinId(prev => prev + 1);
  };

  useEffect(() => { spinRef.current = spin; });
  useEffect(() => { if (autoSpin && !spinning) spinRef.current(); }, [autoSpin]);

  const combinedDisplay = `${reelDigits[0]}${reelDigits[1]}${reelDigits[2]}`;
  const currentSpecial = SPECIAL_SYMBOLS[specialIdx];

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🎡 Lucky Fortune Wheel" onComplete={handleLoadingComplete} />

      <motion.div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0000 0%, #2a0505 30%, #1a0000 60%, #0d0000 100%)' }}
        animate={screenShake ? { x: [0, -5, 5, -3, 3, 0], y: [0, -3, 3, -2, 2, 0] } : {}}
        transition={{ duration: 0.5, repeat: screenShake ? 3 : 0 }}
      >
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[min(95vw,500px)] h-[min(95vw,500px)] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.06) 0%, rgba(200,0,0,0.04) 40%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center gap-2 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>

          <div className="flex-1 flex items-center justify-center">
            <div className="relative" style={{ perspective: '200px' }}>
              <div className="flex items-baseline gap-1" style={{ transform: 'rotateY(-5deg)', transformStyle: 'preserve-3d' }}>
                <span className="font-black text-lg tracking-tight" style={{
                  background: 'linear-gradient(180deg, #ffd700 0%, #ff8800 50%, #cc4400 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
                }}>FORTUNE</span>
                <span className="font-black text-xl" style={{
                  background: 'linear-gradient(180deg, #ff4444 0%, #cc0000 50%, #880000 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 2px rgba(255,0,0,0.3))',
                }}>WHEEL</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PaytableModal gameName="Lucky Fortune Wheel" betAmount={betAmount} {...FORTUNE_WHEEL_PAYTABLE} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {soundEnabled ? <Volume2 size={14} className="text-yellow-400" /> : <VolumeX size={14} className="text-white/40" />}
            </button>
            <div className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.08)' }}>
              <span className="text-sm font-bold text-yellow-400">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Free Spin counter */}
        <div className="flex items-center justify-center px-3 mb-1 relative z-10">
          {inFreeSpinMode && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #ff4444, #ffd700)', color: '#000' }}>
              🎰 FREE SPINS: {freeSpins}
            </motion.div>
          )}
          {!spinning && activeMultiplier > 1 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-2 py-0.5 rounded-md text-xs font-black"
              style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' }}>
              {activeMultiplier}x ACTIVE
            </motion.div>
          )}
        </div>

        {/* 3D Slot Machine */}
        <div className="flex-1 flex items-center justify-center px-2 relative z-10">
          <div className="w-full max-w-[min(95vw,480px)] mx-auto">
            <div className="relative">
              {/* Casino frame lights */}
              <style>{`
                @keyframes fwLights {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 1; }
                }
              `}</style>
              <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ff4444', '#ffd700', '#ff8800', '#ffcc00'][i % 4],
                    boxShadow: `0 0 6px ${['#ff4444', '#ffd700', '#ff8800', '#ffcc00'][i % 4]}`,
                    animation: `fwLights 1.5s ease-in-out ${i * 0.12}s infinite`,
                  }} />
                ))}
              </div>
              <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ffd700', '#ff4444', '#ff8800', '#ffcc00'][i % 4],
                    boxShadow: `0 0 6px ${['#ffd700', '#ff4444', '#ff8800', '#ffcc00'][i % 4]}`,
                    animation: `fwLights 1.5s ease-in-out ${i * 0.12 + 0.3}s infinite`,
                  }} />
                ))}
              </div>
              {/* Side lights */}
              <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ff4444', '#ffd700'][i % 2],
                    boxShadow: `0 0 6px ${['#ff4444', '#ffd700'][i % 2]}`,
                    animation: `fwLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ffd700', '#ff4444'][i % 2],
                    boxShadow: `0 0 6px ${['#ffd700', '#ff4444'][i % 2]}`,
                    animation: `fwLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                  }} />
                ))}
              </div>

              <div className="rounded-3xl p-2 relative"
                style={{
                  background: 'linear-gradient(180deg, #2a0000, #4d0a0a, #2a0000)',
                  border: '3px solid #ffd700',
                  boxShadow: '0 0 50px rgba(255,215,0,0.1), 0 0 0 3px #8B0000, inset 0 2px 4px rgba(255,215,0,0.1)',
                }}
              >
                {/* Top label */}
                <div className="text-center py-1.5 relative">
                  <span className="text-[10px] font-extrabold tracking-[0.3em] uppercase"
                    style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                    🎡 FORTUNE WHEEL 🎡
                  </span>
                </div>

                <div className="mx-4 h-[2px] mb-1"
                  style={{ background: 'linear-gradient(90deg, transparent, #ffd700, #ffe066, #ffd700, transparent)' }} />

                {/* Reels area */}
                <div className="flex justify-center items-center gap-0.5 py-2 px-1 mx-1 rounded-2xl relative"
                  style={{
                    background: 'linear-gradient(180deg, #0a0508, #150a10, #0a0508)',
                    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,215,0,0.15)',
                  }}
                >
                  {/* Gold separators */}
                  {[0, 1].map(i => (
                    <div key={`sep-${i}`} className="absolute z-10 w-[2px]" style={{
                      left: `${(i + 1) * 23.5}%`, top: 8, bottom: 8,
                      background: 'linear-gradient(180deg, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b)',
                      borderRadius: 2, boxShadow: '0 0 6px rgba(255,215,0,0.3)',
                    }} />
                  ))}

                  {/* Orange separator before 4th reel */}
                  <div className="absolute z-10 w-[3px]" style={{
                    left: '72%', top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #cc6600, #ff8800, #ffaa44, #ff8800, #cc6600)',
                    borderRadius: 2, boxShadow: '0 0 8px rgba(255,136,0,0.4)',
                  }} />

                  {reelDigits.map((digit, i) => {
                    const isLocked = (activeReels === 1 && i < 2) || (activeReels === 2 && i < 1);
                    return (
                      <CylinderReel key={i} finalDigit={digit} spinning={spinning} reelIndex={i}
                        onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin} spinId={spinId} turbo={turboMode} locked={isLocked} />
                    );
                  })}

                  <LuckyReel
                    finalIdx={specialIdx}
                    spinning={spinning}
                    onStop={handleReelStop}
                    soundEnabled={soundEnabled}
                    isWin={isWin}
                    spinId={spinId}
                    turbo={turboMode}
                  />
                </div>

                {/* Combined number + special display */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,215,0,0.4)' }}>
                    #{combinedDisplay}
                  </span>
                  {!spinning && currentSpecial && (
                    <span className="text-[10px] font-bold" style={{
                      color: currentSpecial.type === 'scatter' ? '#ff00ff'
                        : currentSpecial.type === 'wheel' ? '#00ffcc'
                        : currentSpecial.value >= 50 ? '#ff4444' : '#ffd700',
                    }}>
                      {currentSpecial.type === 'multiplier' ? `×${currentSpecial.value}` : currentSpecial.label}
                    </span>
                  )}
                </div>

                <div className="mx-4 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, #ffd700, #ffe066, #ffd700, transparent)' }} />

                {/* Win display */}
                <div className="h-12 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {!spinning && lastWin > 0 && (
                      <motion.div key="win" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="text-center flex items-center gap-2">
                        <span className="font-extrabold text-2xl" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                          WIN ৳{lastWin.toLocaleString()}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Confetti */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <CoinParticle key={i} delay={i * 0.05} size={i < 10 ? 'lg' : i < 25 ? 'md' : 'sm'} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mega Win / Big Win overlay */}
        <AnimatePresence>
          {(showBigWin || showMegaWin) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            >
              {Array.from({ length: 60 }).map((_, i) => (
                <CoinParticle key={`overlay-${i}`} delay={i * 0.04} size={i < 15 ? 'lg' : i < 35 ? 'md' : 'sm'} />
              ))}
              {showMegaWin && Array.from({ length: 20 }).map((_, i) => (
                <FireParticle key={`fire-${i}`} delay={i * 0.1} />
              ))}
              <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }} exit={{ scale: 0 }} className="text-center relative z-10">
                <motion.p animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                  className="font-extrabold text-5xl mb-3"
                  style={{
                    background: showMegaWin ? 'linear-gradient(135deg, #ffd700, #ff4444, #ffd700)' : 'linear-gradient(135deg, #ffd700, #ff8800)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.5))',
                  }}
                >
                  {showMegaWin ? '🏆 MEGA WIN! 🏆' : '🎉 BIG WIN!'}
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="font-bold text-4xl" style={{ color: '#ffd700', textShadow: '0 0 25px rgba(255,215,0,0.5)' }}>
                  ৳{lastWin.toLocaleString()}
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bonus Wheel Modal */}
        <AnimatePresence>
          {showBonusWheel && (
            <BonusWheel onResult={handleBonusWheelResult} betAmount={betAmount} soundEnabled={soundEnabled} predeterminedMult={bonusWheelMultRef.current} />
          )}
        </AnimatePresence>

        {/* Controls — Bet | Spin | Turbo | Auto */}
        <div className="relative z-10 p-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            {/* Bet — left */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,215,0,0.5)' }}>Bet</span>
              <button onClick={() => adjustBet(-1)} disabled={spinning || inFreeSpinMode}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)' }}>
                <Minus size={14} className="text-yellow-400" />
              </button>
              <span className="font-extrabold text-xl min-w-[70px] text-center text-yellow-400 shrink-0">৳{betAmount}</span>
              <button onClick={() => adjustBet(1)} disabled={spinning || inFreeSpinMode}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)' }}>
                <Plus size={14} className="text-yellow-400" />
              </button>
            </div>
            {/* Spin — center */}
            <button onClick={spin} disabled={spinning}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-extrabold text-xs tracking-wide active:scale-[0.97] disabled:opacity-60 flex items-center justify-center shrink-0"
              style={{
                background: spinning ? 'linear-gradient(135deg, #333, #222)' : 'linear-gradient(135deg, #cc0000, #ffd700, #cc0000)',
                boxShadow: spinning ? 'none' : '0 4px 25px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 2px #8B0000',
                color: spinning ? '#888' : '#fff', textShadow: spinning ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,215,0,0.5)',
              }}
            >
              {inFreeSpinMode ? `🎰 FREE (${freeSpins})` : '🎡 SPIN'}
            </button>
            {/* Turbo | Auto — right */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setTurboMode(!turboMode); if (soundEnabled) FortuneWheelSound.buttonClick(); }}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                style={{
                  background: turboMode ? 'linear-gradient(135deg, #ff8800, #ffd700)' : 'rgba(255,255,255,0.05)',
                  border: turboMode ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: turboMode ? '#000' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Zap size={9} className="inline mr-0.5" />Turbo
              </button>
              <button
                onClick={() => { setAutoSpin(!autoSpin); if (soundEnabled) FortuneWheelSound.buttonClick(); }}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                style={{
                  background: autoSpin ? 'linear-gradient(135deg, #ff4444, #ffd700)' : 'rgba(255,255,255,0.05)',
                  border: autoSpin ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: autoSpin ? '#000' : 'rgba(255,255,255,0.4)',
                }}
              >
                <RotateCcw size={9} className="inline mr-0.5" />Auto
              </button>
            </div>
          </div>
        </div>

        {/* Paytable */}
        <div className="px-3 pb-4 relative z-10">
          <details className="group">
            <summary className="text-center text-[11px] font-bold uppercase tracking-wider cursor-pointer py-1"
              style={{ color: 'rgba(255,215,0,0.4)' }}>
              ▼ Paytable & Rules
            </summary>
            <div className="mt-2 space-y-1">
              {[
                { label: '7 7 7 × 500x', payout: '= ৳3,499,500', color: '#ff4444', highlight: true },
                { label: '1 2 4 × 15x', payout: '= ৳1,860', color: '#ffd700', highlight: true },
                { label: '0 0 3 × 10x', payout: '= ৳30', color: '#ffaa00', highlight: false },
                { label: '0 0 0 × Any', payout: '= ৳0 (LOSS)', color: '#888', highlight: false },
                { label: '🎡 WHEEL', payout: 'Bonus Wheel!', color: '#00ffcc', highlight: true },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                  style={{ background: row.highlight ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-bold text-sm" style={{ color: row.color }}>{row.label}</span>
                  <span className="font-bold text-xs text-yellow-400">{row.payout}</span>
                </div>
              ))}
              <div className="mt-2 space-y-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <p>• WIN = 3-Reel Number × 4th Reel Multiplier</p>
                <p>• 🎡 Wheel: Triggers Bonus Wheel with big prizes!</p>
                <p>• 💫 Scatter: 10 Free Spins (min 5x multiplier)</p>
                <p>• ৳5: 1 reel | ৳10: 2 reels | ৳20+: all 3 reels</p>
              </div>
            </div>
          </details>
        </div>
      </motion.div>
    </AuthGate>
  );
};

export default FortuneWheelGame;
