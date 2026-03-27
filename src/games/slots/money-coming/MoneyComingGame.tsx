import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, Volume2, VolumeX, RotateCcw, Zap } from 'lucide-react';
import BetAmountModal from '@/components/BetAmountModal';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getMultiplierSettings, pickSpecialIdxFromSettings } from '@/hooks/useMultiplierSettings';
import { MoneyComingSound } from './MoneyComingSoundEngine';
import PaytableModal from '@/components/PaytableModal';
import BigWinOverlay from '@/components/BigWinOverlay';
import { MONEY_COMING_PAYTABLE } from '@/config/paytableConfigs';
import { outcomeToTier, getTierDisplayLabel, shouldShowFinalWinOverlay } from '../slotTierUtils';

// ─── Constants ───
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// All reels: 90% chance = 0, 10% = random 1-9
const pickReel12 = (): number => {
  return Math.random() < 0.90 ? 0 : (1 + Math.floor(Math.random() * 9));
};

const pickReel3 = (): number => {
  return Math.random() < 0.90 ? 0 : (1 + Math.floor(Math.random() * 9));
};

// 4th Reel: Special symbols — ordered so 1x (idx 0) sits between 500x and scatter = near miss
const SPECIAL_SYMBOLS = [
  { id: 'x1', label: '1x', emoji: '1x', type: 'multiplier' as const, value: 1 },
  { id: 'x500', label: '500x', emoji: '500x', type: 'multiplier' as const, value: 500 },
  { id: 'x2', label: '2x', emoji: '2x', type: 'multiplier' as const, value: 2 },
  { id: 'x200', label: '200x', emoji: '200x', type: 'multiplier' as const, value: 200 },
  { id: 'x3', label: '3x', emoji: '3x', type: 'multiplier' as const, value: 3 },
  { id: 'x100', label: '100x', emoji: '100x', type: 'multiplier' as const, value: 100 },
  { id: 'x5', label: '5x', emoji: '5x', type: 'multiplier' as const, value: 5 },
  { id: 'x25', label: '25x', emoji: '25x', type: 'multiplier' as const, value: 25 },
  { id: 'x10', label: '10x', emoji: '10x', type: 'multiplier' as const, value: 10 },
  { id: 'wild', label: 'WILD', emoji: '🃏', type: 'wild' as const, value: 0 },
  { id: 'scatter', label: 'FREE', emoji: '💫', type: 'scatter' as const, value: 0 },
  { id: 'x1000', label: '1000x', emoji: '1000x', type: 'multiplier' as const, value: 1000 },
];

// pickSpecialIdx now uses DB settings via getMultiplierSettings()

const MONEY_COMING_BET_PRESETS = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000, 2000];
const JACKPOT_TYPES = ['MINI', 'MINOR', 'MAJOR'] as const;
const JACKPOT_THRESHOLDS = { MINI: 0.98, MINOR: 0.995, MAJOR: 0.999 };
const JACKPOT_MULTIPLIERS = { MINI: 50, MINOR: 200, MAJOR: 1000 };

// ─── Bet Tier System ───
// ৳1: 1 reel locked (2 digit reels active)
// ৳5+: no lock (all 3 digit reels active)
const getActiveReelCount = (bet: number): number => {
  if (bet >= 5) return 3;
  if (bet >= 1) return 2; // 1 reel locked
  return 2; // 0.5: same as 1 (1 reel locked)
};

// 4th reel: allowed indices by bet (what can land)
// 0.5–5: max 50x show/land → 1x,2x,3x,5x,10x,25x,wild,scatter (exclude 100x,200x,500x)
// 10–100: max 500x → all except 1000x
// 500–1000: show 1000x on reel but "uthbe na" → never pick 1000x (indices 0–10 only)
const IDX_1000X = 11;
const getAllowedSpecialIndices = (bet: number): number[] => {
  if (bet <= 5) {
    return [0, 2, 4, 6, 7, 8, 9, 10]; // 1x,2x,3x,5x,25x,10x,wild,scatter (value ≤ 50)
  }
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 10–100 and 500/1000: up to 500x, never 1000x
};

// 4th reel display: 0.5–5 → up to 50x; 10–100 → up to 500x; 500/1000 → up to 1000x (1000x never lands)
type SpecialSym = typeof SPECIAL_SYMBOLS[0];
const getDisplaySymbolsForBet = (bet: number): SpecialSym[] => {
  if (bet >= 500) return [...SPECIAL_SYMBOLS];
  if (bet >= 10) return SPECIAL_SYMBOLS.slice(0, 11);
  return getAllowedSpecialIndices(bet).map(i => SPECIAL_SYMBOLS[i]);
};
const getDisplayIdxForBet = (bet: number, specialIdx: number): number => {
  const list = getDisplaySymbolsForBet(bet);
  const sym = SPECIAL_SYMBOLS[specialIdx];
  const idx = list.findIndex(s => s === sym);
  return idx >= 0 ? idx : 0;
};

const getLowTierSpecialIdx = (allowed: number[]): number => {
  const low = allowed.filter(i => [0, 2, 4].includes(i));
  return low.length ? low[Math.floor(Math.random() * low.length)] : allowed[0];
};

const getMidTierSpecialIdx = (allowed: number[]): number => {
  const mid = allowed.filter(i => [0, 2, 4, 6, 8].includes(i));
  return mid.length ? mid[Math.floor(Math.random() * mid.length)] : allowed[0];
};

// ─── Coin Particle ───
const CoinParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const emoji = ['💰', '💵', '🪙', '💎', '💲'][Math.floor(Math.random() * 5)];
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

// ─── 3D Cylinder Reel (Digits 0-9) — responsive for mobile ───
const CELL_H = 56;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);
const REEL_W = 68;
const CONTAINER_H = 200;

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
  // সব ৩ রিল একসাথে ঘুরবে ও একসাথে থামবে — ০ ইচ্ছা করে আসছে বোঝা না যাক
  const SPIN_DURATION = turbo ? 400 : 550;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  // Locked reels: immediately count as stopped, don't animate
  useEffect(() => {
    if (locked && spinning) {
      onStop();
    }
  }, [locked, spinning]);

  useEffect(() => {
    if (!spinning || locked) return;
    landingTriggered.current = false;
    const speed = turbo ? 12 : 10;
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
    const fullRotations = turbo ? 2 : 3;
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
        if (curFace !== prevFace) MoneyComingSound.tick();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalDigit * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) MoneyComingSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const faces = DIGITS.map((digit, i) => (
    <div key={i} className="absolute w-full flex items-center justify-center"
      style={{
        height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`,
        transform: `rotateX(${i * FACE_ANGLE}deg) translateZ(${CYLINDER_RADIUS}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      <span className="select-none font-black" style={{
        fontSize: 40,
        background: 'linear-gradient(180deg, #ffd700 0%, #ffaa00 40%, #ff8800 80%, #cc6600 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: isWin && !spinning ? 'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
        textShadow: 'none',
      }}>{digit}</span>
    </div>
  ));

  return (
    <div className="relative flex-shrink-0" style={{ width: REEL_W, height: CONTAINER_H }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #002a00 0%, #004d00 6%, #00801a 12%, #1a1a2e 16%, #22223a 25%, #2a2a45 40%, #30304d 50%, #2a2a45 60%, #22223a 75%, #1a1a2e 84%, #00801a 88%, #004d00 94%, #002a00 100%)',
        border: '3px solid #ffd700',
        boxShadow: '0 0 0 2px #006622, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,215,0,0.05), 0 0 15px rgba(255,215,0,0.15)',
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

        {/* Green/gold bands */}
        <div className="absolute top-0 left-0 right-0 h-[24px] z-10"
          style={{ background: 'linear-gradient(180deg, #001a00, #003a00, #006622, rgba(0,102,34,0))', borderBottom: '2px solid #ffd700', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[24px] z-10"
          style={{ background: 'linear-gradient(0deg, #001a00, #003a00, #006622, rgba(0,102,34,0))', borderTop: '2px solid #ffd700', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />

        {/* 3D Cylinder viewport */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 24, bottom: 24 }}>
          <div className="relative w-full h-full" style={{ perspective: '220px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.04) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>

        {/* Gold ring trim */}
        <div className="absolute left-0 right-0 top-[23px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[23px] h-[2px] z-10"
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

// ─── 4th Reel: Special Cylinder (Scatter / Wild / Multipliers) ───
const SP_CELL_H = 56;
const SP_REEL_W = 78;

const SpecialCylinderReel = ({
  finalIdx, spinning, onStop, soundEnabled, isWin, spinId, turbo,
  displaySymbols = SPECIAL_SYMBOLS,
}: {
  finalIdx: number; spinning: boolean; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; turbo: boolean;
  displaySymbols?: typeof SPECIAL_SYMBOLS;
}) => {
  const numFaces = displaySymbols.length;
  const faceAngle = 360 / numFaces;
  const radius = (SP_CELL_H / 2) / Math.tan(Math.PI / numFaces);

  const [rotationX, setRotationX] = useState(-(finalIdx * faceAngle));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIdx * faceAngle));
  const SPIN_DURATION = turbo ? 400 : 550;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = turbo ? 12 : 10;
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
    const fullRotations = turbo ? 2 : 3;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * faceAngle) - startAngle) % 360 + 360) % 360);
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
        const finalAngle = -(finalIdx * faceAngle);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) {
          MoneyComingSound.reelStop(3);
          if (finalIdx === 0) {
            setTimeout(() => MoneyComingSound.nearMiss(), 150);
          }
        }
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId, finalIdx, faceAngle]);

  const getSymbolStyle = (sym: typeof SPECIAL_SYMBOLS[0]) => {
    if (sym.type === 'scatter') return { color: '#ff00ff', glow: 'drop-shadow(0 0 12px rgba(255,0,255,0.8))', fontSize: 20 };
    if (sym.type === 'wild') return { color: '#00ffcc', glow: 'drop-shadow(0 0 12px rgba(0,255,200,0.8))', fontSize: 20 };
    if (sym.value >= 100) return { color: '#ff4444', glow: 'drop-shadow(0 0 10px rgba(255,68,68,0.6))', fontSize: 18 };
    if (sym.value >= 20) return { color: '#ff8800', glow: 'drop-shadow(0 0 8px rgba(255,136,0,0.5))', fontSize: 16 };
    if (sym.value >= 5) return { color: '#ffd700', glow: 'drop-shadow(0 0 6px rgba(255,215,0,0.4))', fontSize: 14 };
    return { color: '#aaa', glow: 'none', fontSize: 12 };
  };

  const faces = displaySymbols.map((sym, i) => {
    const style = getSymbolStyle(sym);
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{
          height: SP_CELL_H, top: `calc(50% - ${SP_CELL_H / 2}px)`,
          transform: `rotateX(${i * faceAngle}deg) translateZ(${radius}px)`,
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="flex flex-col items-center gap-0 select-none">
          {sym.type === 'scatter' && <span style={{ fontSize: 22, filter: style.glow }}>💫</span>}
          {sym.type === 'wild' && <span style={{ fontSize: 22, filter: style.glow }}>🃏</span>}
          {sym.type === 'multiplier' && (
            <span className="font-black" style={{
              fontSize: style.fontSize,
              color: style.color,
              filter: style.glow,
              textShadow: `0 0 8px ${style.color}40`,
            }}>{sym.emoji}</span>
          )}
          {sym.type !== 'multiplier' && (
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: style.color }}>{sym.label}</span>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: SP_REEL_W, height: CONTAINER_H }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #1a002a 0%, #2a0040 6%, #3d0060 12%, #1a1a2e 16%, #22223a 25%, #2a2a45 40%, #30304d 50%, #2a2a45 60%, #22223a 75%, #1a1a2e 84%, #3d0060 88%, #2a0040 94%, #1a002a 100%)',
        border: '3px solid #ff00ff',
        boxShadow: '0 0 0 2px #660066, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,0,255,0.05), 0 0 15px rgba(255,0,255,0.15)',
      }}>
        {/* Rivets */}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ff66ff, #990099)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ff66ff, #990099)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}

        {/* Purple bands */}
        <div className="absolute top-0 left-0 right-0 h-[24px] z-10"
          style={{ background: 'linear-gradient(180deg, #0d0015, #1a002a, #3d0060, rgba(61,0,96,0))', borderBottom: '2px solid #ff00ff', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[24px] z-10"
          style={{ background: 'linear-gradient(0deg, #0d0015, #1a002a, #3d0060, rgba(61,0,96,0))', borderTop: '2px solid #ff00ff', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />

        {/* 3D Cylinder */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 24, bottom: 24 }}>
          <div className="relative w-full h-full" style={{ perspective: '220px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.04) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>

        {/* Ring trim */}
        <div className="absolute left-0 right-0 top-[23px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #990099, #ff00ff, #ff66ff, #ff00ff, #990099, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[23px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #990099, #ff00ff, #ff66ff, #ff00ff, #990099, transparent 95%)' }} />
      </div>

      {/* Label */}
      <div className="absolute -top-5 left-0 right-0 text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#ff66ff' }}>✦ BONUS ✦</span>
      </div>

      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(255,0,255,0.9), inset 0 0 30px rgba(255,0,255,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Jackpot Wheel Mini ───
const JackpotWheel = ({ spinning }: { spinning: boolean }) => {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setRotation(prev => prev + 3), 50);
    return () => clearInterval(id);
  }, [spinning]);

  return (
    <div className="relative w-10 h-10">
      <div className="w-full h-full rounded-full overflow-hidden"
        style={{
          background: 'conic-gradient(#ffd700 0deg, #00cc44 60deg, #ffd700 120deg, #00cc44 180deg, #ffd700 240deg, #00cc44 300deg, #ffd700 360deg)',
          transform: `rotate(${rotation}deg)`, border: '2px solid #ffd700',
          boxShadow: '0 0 10px rgba(255,215,0,0.4)',
        }}
      />
      <div className="absolute inset-[6px] rounded-full flex items-center justify-center"
        style={{ background: '#001a00', border: '1px solid #ffd700' }}>
        <span className="text-[8px] font-black text-yellow-400">JP</span>
      </div>
    </div>
  );
};

// ─── Scatter Indicator ───
const ScatterIndicator = ({ count, active }: { count: number; active: boolean }) => (
  <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
    style={{
      background: active ? 'rgba(255,0,255,0.15)' : 'rgba(255,255,255,0.03)',
      border: active ? '1px solid rgba(255,0,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
    }}>
    <span className="text-[10px] font-bold" style={{ color: active ? '#ff66ff' : '#666' }}>SCATTER</span>
    <div className="flex gap-0.5">
      {[0, 1].map(i => (
        <div key={i} className="w-2 h-2 rounded-full" style={{
          background: i < count ? '#ff00ff' : 'rgba(255,255,255,0.1)',
          boxShadow: i < count ? '0 0 6px rgba(255,0,255,0.5)' : 'none',
        }} />
      ))}
    </div>
  </div>
);

// ─── Main Game ───
const MoneyComingGame = () => {
  const navigate = useNavigate();
  const { balance, addWin, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelDigits, setReelDigits] = useState<number[]>([0, 0, 0]);
  const [specialIdx, setSpecialIdx] = useState(0); // 4th reel index
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [showMultiplierAnim, setShowMultiplierAnim] = useState(false);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);
  const [finalWinAmount, setFinalWinAmount] = useState(0);
  const [jackpotType, setJackpotType] = useState<typeof JACKPOT_TYPES[number]>('MINI');
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [scatterCount, setScatterCount] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [inFreeSpinMode, setInFreeSpinMode] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const autoSpinRef = useRef(false);
  const spinningRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number; newBalance: number | null }>({ outcome: 'loss', maxWinAmount: 0, newBalance: null });
  const wildMultRef = useRef(1); // Store wild mult to avoid mismatch between spin() and evaluation

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('money-coming', 'Lucky Money Coming', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const [showBetModal, setShowBetModal] = useState(false);
  const adjustBet = (dir: number) => {
    if (spinning || inFreeSpinMode) return;
    const idx = MONEY_COMING_BET_PRESETS.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(MONEY_COMING_BET_PRESETS.length - 1, idx + dir));
    setBetAmount(MONEY_COMING_BET_PRESETS[newIdx]);
    if (soundEnabled) MoneyComingSound.buttonClick();
  };

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => prev + 1);
  }, []);

  // Evaluate win when all 4 reels stop
  const activeReels = getActiveReelCount(betAmount);
  
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    spinningRef.current = false;
    setSpinning(false);
    setStoppedReels(0);

    const oc = outcomeRef.current;

    // ─── LOSS CHECK FIRST — regardless of what reels show ───
    if (oc.outcome === 'loss') {
      // Reels may show non-zero digits for visual tease, but payout is always 0
      setActiveMultiplier(1);
      handleLoss();

      // Free spin management
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

    // ─── WIN PATH: outcome is small_win / medium_win / big_win / mega_win ───
    const [d1, d2, d3] = reelDigits;
    const combinedNumber = d1 * 100 + d2 * 10 + d3;
    const special = SPECIAL_SYMBOLS[specialIdx];

    // Use stored wild mult to match what spin() calculated for digit capping
    let mult = 1;
    if (special.type === 'multiplier') mult = special.value;
    else if (special.type === 'wild') mult = wildMultRef.current;
    if (inFreeSpinMode && mult < 5) mult = 5;

    setActiveMultiplier(mult);
    if (mult > 1) {
      setShowMultiplierAnim(true);
      if (soundEnabled) MoneyComingSound.multiplierActivate();
      setTimeout(() => setShowMultiplierAnim(false), 400);
    }

    // Scatter check
    if (special.type === 'scatter' && !inFreeSpinMode) {
      setScatterCount(0); setFreeSpins(10); setInFreeSpinMode(true);
      if (soundEnabled) MoneyComingSound.freeSpinStart();
      gameToast.success('💫 SCATTER! 10 Free Spins! Min 5x multiplier!');
    }

    // Payout = 3-digit number × 4th reel multiplier; 000 = loss
    const effectiveMult = mult === 0 ? 1 : mult;
    const totalWin = combinedNumber * effectiveMult;
    if (totalWin > 0) {
      // Use backend amount as authoritative — avoids mismatch between displayed and settled
      const authoritativeWin = Math.round(oc.maxWinAmount ?? (oc as { winAmount?: number }).winAmount ?? 0);
      const cappedWin = authoritativeWin > 0 ? authoritativeWin : Math.min(totalWin, oc.maxWinAmount || totalWin);
      processWin(cappedWin);
    } else {
      handleLoss();
    }

    // Free spin management
    if (inFreeSpinMode) {
      const remaining = freeSpins - 1;
      setFreeSpins(remaining);
      if (remaining <= 0) {
        setInFreeSpinMode(false);
        gameToast.info('Free spins ended!');
      }
    }

    if (autoSpinRef.current || (inFreeSpinMode && freeSpins > 1)) {
      setTimeout(() => { spinRef.current(); }, 200);
    }
  }, [stoppedReels]);

  const processWin = (cappedWin: number) => {
    setLastWin(cappedWin);
    setWinMultiplier(Math.round(cappedWin / betAmount * 10) / 10);
    setIsWin(true);

    const serverOutcome = outcomeRef.current.outcome;

    // UI celebration based on server pool outcome tier
    if (serverOutcome === 'mega_win') {
      setShowJackpot(true); setShowConfetti(true); setScreenShake(true);
      if (soundEnabled) MoneyComingSound.jackpot();
    } else if (serverOutcome === 'big_win') {
      setShowBigWin(true); setShowConfetti(true);
      if (soundEnabled) MoneyComingSound.bigWin();
    } else if (serverOutcome === 'medium_win' || cappedWin >= betAmount) {
      if (shouldShowFinalWinOverlay(outcomeToTier(serverOutcome))) {
        setFinalWinAmount(cappedWin);
        // Final win overlay disabled
      }
      setShowConfetti(true);
      if (soundEnabled) MoneyComingSound.win();
      setTimeout(() => { setShowConfetti(false); }, 500);
    } else {
      if (shouldShowFinalWinOverlay(outcomeToTier(serverOutcome))) {
        setFinalWinAmount(cappedWin);
        // Final win overlay disabled
      }
      if (soundEnabled) MoneyComingSound.win();
    }

    if (inFreeSpinMode) addWin(cappedWin, 'Money Coming', 'slot', cappedWin / betAmount, betAmount, 'money-coming');
    else if (outcomeRef.current?.newBalance != null) applyAuthoritativeBalance(outcomeRef.current.newBalance);
    setSpinHistory(prev => [{ win: true, amount: cappedWin }, ...prev.slice(0, 14)]);
  };

  const handleLoss = () => {
    setLastWin(0);
    setWinMultiplier(0);
    setIsWin(false);
    if (soundEnabled) MoneyComingSound.loss();
    const oc = outcomeRef.current;
    if (!inFreeSpinMode && oc?.newBalance != null) applyAuthoritativeBalance(oc.newBalance);
    setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
  };

  const spin = async () => {
    if (spinningRef.current || spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!inFreeSpinMode && betAmount > balance) { gameToast.error('Insufficient balance'); return; }

    spinningRef.current = true;
    setLastWin(0);
    setWinMultiplier(0);
    setIsWin(false);
    setShowBigWin(false);
    setShowJackpot(false);
    setActiveMultiplier(1);
    setShowMultiplierAnim(false);

    if (soundEnabled) MoneyComingSound.spin();
    setStoppedReels(0);
    setSpinning(true);

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = inFreeSpinMode
        ? await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'money-coming', is_free_spin: true })
        : await api.sharedSlotSpin({ bet: betAmount, game_id: 'money-coming', game_name: 'Money Coming' });
      if (data && data.outcome) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      spinningRef.current = false;
      setSpinning(false);
      return;
    }
    outcomeRef.current = outcome;

    const activeCount = getActiveReelCount(betAmount);
    const allowedSpecial = getAllowedSpecialIndices(betAmount);

    // Pick 4th reel FIRST so we know the multiplier (only from allowed indices for this bet)
    let specialResult: number;
    if (outcome.outcome === 'mega_win') {
      specialResult = 6 + Math.floor(Math.random() * 3);
    } else if (outcome.outcome === 'big_win') {
      specialResult = 4 + Math.floor(Math.random() * 2);
    } else if (inFreeSpinMode) {
      const fsOptions = [3, 4, 5, 6, 9].filter(i => allowedSpecial.includes(i));
      specialResult = fsOptions.length ? fsOptions[Math.floor(Math.random() * fsOptions.length)] : allowedSpecial[0];
    } else if (activeCount === 2) {
      specialResult = getLowTierSpecialIdx(allowedSpecial);
    } else {
      const ms = await getMultiplierSettings();
      let raw = pickSpecialIdxFromSettings(ms);
      specialResult = allowedSpecial.includes(raw) ? raw : allowedSpecial[Math.floor(Math.random() * allowedSpecial.length)];
    }
    if (outcome.outcome === 'mega_win' || outcome.outcome === 'big_win') {
      if (!allowedSpecial.includes(specialResult)) {
        specialResult = allowedSpecial[Math.min(allowedSpecial.length - 1, allowedSpecial.length - 1)] ?? allowedSpecial[0];
      }
    }

    // Tease: show high multiplier on loss (must be in allowed for bet)
    if (outcome.outcome === 'loss' && Math.random() < 0.3) {
      const teaseOptions = allowedSpecial.filter(i => {
        const s = SPECIAL_SYMBOLS[i];
        return s.type === 'multiplier' && s.value >= 10;
      });
      if (teaseOptions.length) specialResult = teaseOptions[Math.floor(Math.random() * teaseOptions.length)];
    }

    // Calculate effective multiplier for digit capping
    const hardCap = outcome.outcome !== 'loss' ? (outcome.maxWinAmount || (betAmount * 25)) : 0;

    // Determine wild multiplier ONCE and store it for evaluation to use
    const getWildMult = (ac: number) => {
      if (ac === 1) return [2, 3, 5][Math.floor(Math.random() * 3)];
      if (ac === 2) return [3, 5, 10][Math.floor(Math.random() * 3)];
      return [5, 10, 20, 25, 50][Math.floor(Math.random() * 5)];
    };

    // Downgrade 4th reel multiplier so that digits × multiplier fits within hardCap
    // This ensures what the player SEES matches what they actually WIN
    if (outcome.outcome !== 'loss') {
      const getMultVal = (idx: number) => {
        const s = SPECIAL_SYMBOLS[idx];
        if (s.type === 'multiplier') return s.value;
        if (s.type === 'wild') return activeCount === 1 ? 5 : activeCount === 2 ? 10 : 50;
        return 1;
      };
      let currentMult = getMultVal(specialResult);
      if (inFreeSpinMode && currentMult < 5) currentMult = 5;

      // Check: can at least digit=1 × multiplier fit in hardCap? (only use allowed indices for this bet)
      if (currentMult > hardCap) {
        const sortedIndices = SPECIAL_SYMBOLS
          .map((s, i) => ({ i, v: getMultVal(i) }))
          .filter(x => allowedSpecial.includes(x.i) && x.v >= 1 && x.v <= hardCap)
          .sort((a, b) => b.v - a.v);
        if (sortedIndices.length > 0) {
          specialResult = sortedIndices[0].i;
        } else {
          specialResult = allowedSpecial.includes(0) ? 0 : allowedSpecial[0];
        }
      }
    }

    const specialSym = SPECIAL_SYMBOLS[specialResult];
    let effectiveMult = 1;
    if (specialSym.type === 'multiplier') effectiveMult = specialSym.value;
    else if (specialSym.type === 'wild') {
      // Pick wild mult once and store for evaluation
      effectiveMult = getWildMult(activeCount);
    }
    if (inFreeSpinMode && effectiveMult < 5) effectiveMult = 5;

    // If multiplier is too high, digits would be 0 — downgrade to 1x so display matches payout
    let exactTarget = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 0;
    if (exactTarget < 1 && hardCap > 0) {
      specialResult = 0;
      effectiveMult = 1;
    }
    wildMultRef.current = effectiveMult; // Store for evaluation to use

    const maxCombined = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 999;

    // Generate digits so that digit × multiplier = maxWinAmount (display must match payout)
    let finalDigits: number[];
    if (outcome.outcome === 'loss') {
      // Loss: show 000 to match payout (no visual tease with non-zero digits)
      finalDigits = [0, 0, 0];
    } else {
      // CRITICAL: targetNumber × effectiveMult must equal hardCap so display matches payout
      exactTarget = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 0;
      let targetNumber: number;
      if (exactTarget >= 1 && exactTarget <= 999) {
        targetNumber = exactTarget;
      } else {
        // Fallback: pick within tier range but capped (should not happen if multiplier fits)
        if (outcome.outcome === 'mega_win') {
          targetNumber = Math.min(700 + Math.floor(Math.random() * 299), maxCombined);
        } else if (outcome.outcome === 'big_win') {
          targetNumber = Math.min(200 + Math.floor(Math.random() * 500), maxCombined);
        } else if (outcome.outcome === 'medium_win') {
          targetNumber = Math.min(10 + Math.floor(Math.random() * 190), maxCombined);
        } else {
          targetNumber = Math.min(1 + Math.floor(Math.random() * 9), maxCombined);
        }
      }
      if (targetNumber <= 0) targetNumber = 1;
      finalDigits = [
        Math.floor(targetNumber / 100) % 10,
        Math.floor(targetNumber / 10) % 10,
        targetNumber % 10,
      ];
    }

    // Lock lower reels for low/mid tiers
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
      <GameLoadingScreen show={showSplash} gameName="💰 Lucky Money Coming" onComplete={handleLoadingComplete} />

      <motion.div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #001a0a 0%, #002a15 40%, #001a0a 100%)' }}
        animate={screenShake ? { x: [0, -5, 5, -3, 3, 0], y: [0, -3, 3, -2, 2, 0] } : {}}
        transition={{ duration: 0.5, repeat: screenShake ? 3 : 0 }}
      >
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.04) 0%, rgba(0,200,80,0.03) 40%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center gap-2 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="min-h-[44px] min-w-[44px] p-2 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>

          <JackpotWheel spinning={spinning} />

          <div className="flex-1 flex items-center justify-center">
            <div className="relative" style={{ perspective: '200px' }}>
              <div className="flex items-baseline gap-1" style={{ transform: 'rotateY(-5deg)', transformStyle: 'preserve-3d' }}>
                <span className="font-black text-lg tracking-tight" style={{
                  background: 'linear-gradient(180deg, #00ff88 0%, #00cc44 30%, #009933 60%, #006622 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
                }}>MONEY</span>
                <span className="font-black text-xl" style={{
                  background: 'linear-gradient(180deg, #ffd700 0%, #ffaa00 50%, #cc8800 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 2px rgba(255,200,0,0.5))',
                }}>COMING</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PaytableModal gameName="Lucky Money Coming" betAmount={betAmount} {...MONEY_COMING_PAYTABLE} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {soundEnabled ? <Volume2 size={14} className="text-green-400" /> : <VolumeX size={14} className="text-white/40" />}
            </button>
            <div className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.08)' }}>
              <span className="text-sm font-bold text-yellow-400">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Feature hints + Free Spin counter */}
        <div className="flex items-center justify-between px-3 mb-1 relative z-10">
          <ScatterIndicator count={scatterCount} active={true} />
          {inFreeSpinMode && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #ff00ff, #ff8800)', color: '#fff' }}>
              🎰 FREE SPINS: {freeSpins}
            </motion.div>
          )}
          {/* Active multiplier display */}
          {!spinning && activeMultiplier > 1 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-2 py-0.5 rounded-md text-xs font-black"
              style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' }}>
              {activeMultiplier}x ACTIVE
            </motion.div>
          )}
        </div>


        <div className="flex-1 pointer-events-none" aria-hidden="true" />
        {/* Decorative Half Wheel — always slowly spinning with multiplier segments */}
        {(() => {
          const WHEEL_SEGMENTS = ['10x', '15x', '20x', '50x', '100x', '200x', '300x', '500x', '1000x'];
          const segCount = WHEEL_SEGMENTS.length;
          const segAngle = 360 / segCount;
          const segColors = ['#006622', '#008833', '#006622', '#008833', '#006622', '#008833', '#006622', '#008833', '#006622'];
          return (
            <div className="relative z-10 flex justify-center pointer-events-none -mb-8" style={{ height: 'min(45vw, 180px)' }}>
              <div className="absolute w-[min(70vw,280px)] h-[min(70vw,280px)] top-0">
                <div className="w-full h-full rounded-full relative" style={{
                  background: `conic-gradient(${WHEEL_SEGMENTS.map((_, i) => {
                    const start = i * segAngle;
                    const borderEnd = start + 1.5;
                    const segEnd = (i + 1) * segAngle;
                    return `#b8860b ${start}deg, #b8860b ${borderEnd}deg, ${segColors[i]} ${borderEnd}deg, ${segColors[i]} ${segEnd}deg`;
                  }).join(', ')})`,
                  animation: 'mc-wheel-spin 6s linear infinite',
                  boxShadow: '0 0 40px rgba(255,215,0,0.25), inset 0 0 50px rgba(0,0,0,0.5)',
                  border: '5px solid #b8860b',
                }}>
                  {/* Segment labels */}
                  {WHEEL_SEGMENTS.map((label, i) => {
                    const angle = (i * segAngle + segAngle / 2) * (Math.PI / 180);
                    const r = 95;
                    const x = Math.cos(angle - Math.PI / 2) * r;
                    const y = Math.sin(angle - Math.PI / 2) * r;
                    const rotDeg = i * segAngle + segAngle / 2;
                    const isHigh = ['500x', '1000x', '300x'].includes(label);
                    return (
                      <div key={i} className="absolute font-black text-center"
                        style={{
                          left: `calc(50% + ${x}px)`,
                          top: `calc(50% + ${y}px)`,
                          transform: `translate(-50%, -50%) rotate(${rotDeg}deg)`,
                          fontSize: isHigh ? 14 : 12,
                          color: isHigh ? '#ff4444' : '#ffd700',
                          textShadow: `0 0 6px ${isHigh ? 'rgba(255,68,68,0.7)' : 'rgba(255,215,0,0.5)'}`,
                          letterSpacing: '0.5px',
                        }}>
                        {label}
                      </div>
                    );
                  })}
                  {/* Center hub */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full z-10"
                    style={{
                      background: 'radial-gradient(circle at 35% 35%, #ffd700, #b8860b, #8B6914)',
                      border: '3px solid #ffd700',
                      boxShadow: '0 0 20px rgba(255,215,0,0.5), inset 0 2px 4px rgba(255,255,255,0.3)',
                    }}>
                    <div className="w-full h-full flex items-center justify-center">
                      <span style={{ fontSize: 22 }}>💰</span>
                    </div>
                  </div>
                  {/* Edge dots */}
                  {Array.from({ length: 24 }).map((_, i) => {
                    const a = (i * 360 / 24) * (Math.PI / 180);
                    const r2 = 128;
                    return (
                      <div key={i} className="absolute w-2 h-2 rounded-full"
                        style={{
                          left: `calc(50% + ${Math.cos(a) * r2}px - 4px)`,
                          top: `calc(50% + ${Math.sin(a) * r2}px - 4px)`,
                          background: i % 2 === 0 ? '#ffd700' : '#00ff88',
                          boxShadow: `0 0 6px ${i % 2 === 0 ? '#ffd700' : '#00ff88'}`,
                        }} />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3D Slot Machine — 4 Reels */}
        <div className="flex items-start justify-center px-2 relative z-10">
          <div className="w-full max-w-[min(92vw,380px)]">
            {/* Machine frame */}
            <div className="relative">
              {/* Casino frame lights */}
              <style>{`
                @keyframes mcLights {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 1; }
                }
                @keyframes mc-wheel-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#00ff66', '#ffd700', '#ff00ff', '#ffaa00', '#00cc44', '#ff66ff'][i % 6],
                    boxShadow: `0 0 6px ${['#00ff66', '#ffd700', '#ff00ff', '#ffaa00', '#00cc44', '#ff66ff'][i % 6]}`,
                    animation: `mcLights 1.5s ease-in-out ${i * 0.12}s infinite`,
                  }} />
                ))}
              </div>
              <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ffd700', '#00ff66', '#ff00ff', '#00cc44'][i % 4],
                    boxShadow: `0 0 6px ${['#ffd700', '#00ff66', '#ff00ff', '#00cc44'][i % 4]}`,
                    animation: `mcLights 1.5s ease-in-out ${i * 0.12 + 0.3}s infinite`,
                  }} />
                ))}
              </div>
              {/* Side lights */}
              <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#00ff66', '#ffd700'][i % 2],
                    boxShadow: `0 0 6px ${['#00ff66', '#ffd700'][i % 2]}`,
                    animation: `mcLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                    background: ['#ff00ff', '#ffd700'][i % 2],
                    boxShadow: `0 0 6px ${['#ff00ff', '#ffd700'][i % 2]}`,
                    animation: `mcLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                  }} />
                ))}
              </div>

              <div className="rounded-2xl p-1.5 relative"
                style={{
                  background: 'linear-gradient(180deg, #001a00, #003a10, #001a00)',
                  border: '2px solid #ffd700',
                  boxShadow: '0 0 50px rgba(255,215,0,0.1), 0 0 0 3px #006622, inset 0 2px 4px rgba(255,215,0,0.1)',
                }}
              >
                {/* Top label */}
                <div className="text-center py-1.5 relative">
                  <span className="text-[10px] font-extrabold tracking-[0.3em] uppercase"
                    style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                    💰 MONEY COMING 💰
                  </span>
                </div>

                <div className="mx-4 h-[2px] mb-1"
                  style={{ background: 'linear-gradient(90deg, transparent, #ffd700, #ffe066, #ffd700, transparent)' }} />

                {/* Reels area — 3 digit reels + 1 special reel */}
                <div className="flex justify-center items-center gap-0.5 py-1.5 px-1 mx-1 rounded-xl relative"
                  style={{
                    background: 'linear-gradient(180deg, #0a0815, #15122a, #0a0815)',
                    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,215,0,0.15)',
                  }}
                >
                  {/* Gold separators between digit reels */}
                  {[0, 1].map(i => (
                    <div key={`sep-${i}`} className="absolute z-10 w-[2px]" style={{
                      left: `${(i + 1) * 23.5}%`, top: 8, bottom: 8,
                      background: 'linear-gradient(180deg, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b)',
                      borderRadius: 2, boxShadow: '0 0 6px rgba(255,215,0,0.3)',
                    }} />
                  ))}

                  {/* Purple separator before 4th reel */}
                  <div className="absolute z-10 w-[3px]" style={{
                    left: '72%', top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #990099, #ff00ff, #ff66ff, #ff00ff, #990099)',
                    borderRadius: 2, boxShadow: '0 0 8px rgba(255,0,255,0.4)',
                  }} />

                  {reelDigits.map((digit, i) => {
                    const isLocked = (activeReels === 1 && i < 2) || (activeReels === 2 && i < 1);
                    return (
                      <CylinderReel key={i} finalDigit={digit} spinning={spinning} reelIndex={i}
                        onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin} spinId={spinId} turbo={turboMode} locked={isLocked} />
                    );
                  })}

                  {/* 4th Special Reel — display and land only up to bet tier max (50x / 500x / 1000x show but never land) */}
                  <SpecialCylinderReel
                    finalIdx={getDisplayIdxForBet(betAmount, specialIdx)}
                    displaySymbols={getDisplaySymbolsForBet(betAmount)}
                    spinning={spinning}
                    onStop={handleReelStop}
                    soundEnabled={soundEnabled}
                    isWin={isWin}
                    spinId={spinId}
                    turbo={turboMode}
                  />
                </div>

                {/* Combined number + special symbol display */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,215,0,0.4)' }}>
                    #{combinedDisplay}
                  </span>
                  {!spinning && currentSpecial && (
                    <span className="text-[10px] font-bold" style={{
                      color: currentSpecial.type === 'scatter' ? '#ff00ff'
                        : currentSpecial.type === 'wild' ? '#00ffcc'
                        : currentSpecial.value >= 50 ? '#ff4444' : '#ffd700',
                    }}>
                      {currentSpecial.type === 'multiplier' ? `×${currentSpecial.value}` : currentSpecial.label}
                    </span>
                  )}
                </div>

                <div className="mx-4 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, #ffd700, #ffe066, #ffd700, transparent)' }} />

                {/* Win/Loss display */}
                <div className="h-12 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {!spinning && lastWin > 0 && (
                      <motion.div key="win" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="text-center flex items-center gap-2">
                        <span className="font-extrabold text-2xl" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                          WIN ৳{lastWin.toLocaleString()}
                        </span>
                        {winMultiplier > 0 && (
                          <span className="text-xs font-bold" style={{ color: 'rgba(255,215,0,0.5)' }}>({winMultiplier.toFixed(1)}x)</span>
                        )}
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

        {/* Final win overlay (small/medium) — matches Super Ace / Boxing King */}
        <AnimatePresence>
          {showFinalWinOverlay && finalWinAmount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
              style={{ background: 'hsla(0, 0%, 0%, 0.7)', backdropFilter: 'blur(8px)' }}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center px-10 py-6 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, hsl(45, 70%, 42%), hsl(38, 65%, 32%))',
                  border: '2px solid hsl(45, 90%, 55%)',
                  boxShadow: '0 0 32px hsla(45, 90%, 50%, 0.4)',
                }}
              >
                <p className="font-heading font-bold text-lg mb-1" style={{ color: 'hsl(45, 100%, 80%)' }}>Win</p>
                <p className="font-heading font-extrabold text-5xl gold-text" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  ৳{finalWinAmount.toLocaleString()}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Big Win / Jackpot overlay with counting */}
        <BigWinOverlay
          active={showBigWin || showJackpot}
          amount={lastWin}
          type={showJackpot ? 'jackpot' : 'mega_win'}
          jackpotLabel={jackpotType}
          onComplete={() => { setShowBigWin(false); setShowJackpot(false); setShowConfetti(false); setScreenShake(false); }}
        />

        {/* Controls — Bet | Spin | Turbo | Auto */}
        <div className="relative z-10 p-3 pb-4 safe-bottom">
          <div className="flex items-center justify-between gap-2">
            {/* Bet — left: coin icon + amount, click to open modal */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => !(spinning || inFreeSpinMode) && setShowBetModal(true)}
                disabled={spinning || inFreeSpinMode}
                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg active:scale-95 disabled:opacity-30"
                style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)' }}
              >
                <Coins size={18} className="text-yellow-400" />
                <span className="font-extrabold text-xl text-yellow-400 shrink-0">৳{betAmount}</span>
              </button>
              <BetAmountModal
                open={showBetModal}
                onClose={() => setShowBetModal(false)}
                presets={MONEY_COMING_BET_PRESETS}
                current={betAmount}
                onSelect={(v) => { setBetAmount(v); if (soundEnabled) MoneyComingSound.buttonClick(); }}
                accentColor="#ffd700"
                disabled={spinning || inFreeSpinMode}
              />
            </div>
            {/* Spin — center */}
            <button type="button" onClick={spin} disabled={spinning}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-extrabold text-xs tracking-wide active:scale-[0.97] disabled:opacity-60 flex items-center justify-center shrink-0"
              style={{
                background: spinning ? 'linear-gradient(135deg, #333, #222)' : 'linear-gradient(135deg, #b8860b, #ffd700, #b8860b)',
                boxShadow: spinning ? 'none' : '0 4px 25px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 2px #8B6914',
                color: spinning ? '#888' : '#000', textShadow: spinning ? 'none' : '0 1px 0 rgba(255,255,255,0.3)',
                border: '2px solid rgba(255,215,0,0.5)',
              }}
            >
              {inFreeSpinMode ? `🎰 FREE (${freeSpins})` : '💰 SPIN'}
            </button>
            {/* Turbo | Auto — right */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { setTurboMode(!turboMode); if (soundEnabled) MoneyComingSound.buttonClick(); }}
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
                onClick={() => { setAutoSpin(!autoSpin); if (soundEnabled) MoneyComingSound.buttonClick(); }}
                className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                style={{
                  background: autoSpin ? 'linear-gradient(135deg, #00ff88, #00cc44)' : 'rgba(255,255,255,0.05)',
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
                { label: '9 9 9 × 500x', payout: '= ৳499,500', color: '#ff4444', highlight: true },
                { label: '1 2 4 × 1x', payout: '= ৳124', color: '#ffd700', highlight: true },
                { label: '0 0 3 × 10x', payout: '= ৳30', color: '#ffaa00', highlight: false },
                { label: '0 0 0 × 1x', payout: '= ৳0 (LOSS)', color: '#888', highlight: false },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                  style={{ background: row.highlight ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-bold text-sm" style={{ color: row.color }}>{row.label}</span>
                  <span className="font-bold text-xs text-yellow-400">{row.payout}</span>
                </div>
              ))}
              <div className="mt-2 space-y-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <p>• WIN = 3-Reel Number × 4th Reel Multiplier</p>
                <p>• Reel 1 & 2: 99.5% = 0 | Reel 3: 95% under 5</p>
                <p>• 4th Reel: 90% = 1x | 5% = 2x-25x | 2% = 100x-500x</p>
                <p>• 🃏 Wild (2%): Random 5x-50x multiplier</p>
                <p>• 💫 Scatter (1%): Instant 10 Free Spins (min 5x)</p>
              </div>
            </div>
          </details>
        </div>
      </motion.div>
    </AuthGate>
  );
};

export default MoneyComingGame;
