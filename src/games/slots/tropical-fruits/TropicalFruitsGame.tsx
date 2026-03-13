import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Minus, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getMultiplierSettings, pickSpecialIdxFromSettings } from '@/hooks/useMultiplierSettings';
import SlotControlPanel from '@/components/SlotControlPanel';
import { TropicalFruitsSound } from './TropicalFruitsSoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { TROPICAL_FRUITS_PAYTABLE } from '@/config/paytableConfigs';

// ─── Symbols: tropical fruit emoji reel ───
const SYMBOLS = ['🍉', '🍊', '🥭', '🍍', '🥝', '🍌', '🍇', '🍓', '🫐', '🌴'];

const SYMBOL_WEIGHTS: Record<number, number> = {
  0: 5,  // 🍉 jackpot
  1: 10, // 🍊
  2: 6,  // 🥭
  3: 7,  // 🍍
  4: 12, // 🥝
  5: 12, // 🍌
  6: 8,  // 🍇
  7: 8,  // 🍓
  8: 12, // 🫐
  9: 5,  // 🌴 wild
};
const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);

const pickSymbol = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOL_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 4;
};

const getTriplePayout = (idx: number): number => {
  if (idx === 0) return 100 + Math.floor(Math.random() * 401); // 🍉 Mega
  if (idx === 9) return 50 + Math.floor(Math.random() * 201);  // 🌴 Wild
  if (idx === 2) return 30 + Math.floor(Math.random() * 71);   // 🥭
  if (idx === 3) return 10 + Math.floor(Math.random() * 41);   // 🍍
  if (idx === 6) return 10 + Math.floor(Math.random() * 41);   // 🍇
  if (idx === 1) return 5 + Math.floor(Math.random() * 21);    // 🍊
  if (idx === 7) return 5 + Math.floor(Math.random() * 21);    // 🍓
  if (idx === 5) return 3 + Math.floor(Math.random() * 8);     // 🍌
  if (idx === 4) return 2 + Math.floor(Math.random() * 4);     // 🥝
  if (idx === 8) return 2;                                       // 🫐
  return 1;
};

// 4th Reel: ordered so 1x sits between 500x and scatter = near miss
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
const IDX_1000X = SPECIAL_SYMBOLS.findIndex((s) => s.id === 'x1000');

const getActiveReelCount = (bet: number): number => (bet >= 5 ? 3 : 2);

const getAllowedSpecialIndices = (bet: number): number[] => {
  if (bet <= 5) {
    return SPECIAL_SYMBOLS
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type !== 'multiplier' || s.value <= 50)
      .map(({ i }) => i);
  }
  return SPECIAL_SYMBOLS
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== IDX_1000X && (s.type !== 'multiplier' || s.value <= 500))
    .map(({ i }) => i);
};

type SpecialSym = typeof SPECIAL_SYMBOLS[0];
const getDisplaySymbolsForBet = (bet: number): SpecialSym[] => {
  if (bet >= 500) return [...SPECIAL_SYMBOLS];
  return getAllowedSpecialIndices(bet).map((i) => SPECIAL_SYMBOLS[i]);
};

const getDisplayIdxForBet = (bet: number, specialIdx: number): number => {
  const list = getDisplaySymbolsForBet(bet);
  const sym = SPECIAL_SYMBOLS[specialIdx];
  const idx = list.findIndex((s) => s === sym);
  return idx >= 0 ? idx : 0;
};

// ─── Fruit Particle ───
const FruitParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const emoji = ['🍉', '🍊', '🍍', '🥭', '🍇', '🍌'][Math.floor(Math.random() * 6)];

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60, fontSize: s * 0.8 }}
      initial={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 1, 0],
        y: [0, 150, 350, 550],
        x: [0, drift * 0.3, drift * 0.7, drift],
        rotate: [0, 180, 360],
        scale: [0.8, 1, 0.9, 0.6],
      }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}
    >
      {emoji}
    </motion.div>
  );
};

// ─── 3D Cylindrical Reel ───
const CELL_H = 56;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

const CylinderReel = ({
  finalIdx, spinning, reelIndex, onStop, soundEnabled, isWin, spinId, locked,
}: {
  finalIdx: number; spinning: boolean; reelIndex: number; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; locked?: boolean;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIdx * FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIdx * FACE_ANGLE));
  const SPIN_DURATION = 150 + reelIndex * 50;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  // Locked reels: immediately count as stopped
  useEffect(() => {
    if (locked && spinning) onStop();
  }, [locked, spinning]);

  useEffect(() => {
    if (!spinning || locked) return;
    landingTriggered.current = false;
    const speed = 8 + reelIndex * 1.5;
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
    const fullRotations = 1 + reelIndex;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.7) { eased = progress / 0.7 * 0.85; }
      else {
        const t = (progress - 0.7) / 0.3;
        const decel = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.015 * (1 - t);
        eased = 0.85 + 0.15 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.005);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);
      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / FACE_ANGLE);
        const curFace = Math.floor(Math.abs(currentAngle) / FACE_ANGLE);
        if (curFace !== prevFace) TropicalFruitsSound.tick();
      }
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        const finalAngle = -(finalIdx * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) TropicalFruitsSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 200;
  const faces = SYMBOLS.map((symbol, i) => {
    const isJackpot = i === 0;
    const faceRotation = i * FACE_ANGLE;
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{ height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`, left: 0,
          transform: `rotateX(${faceRotation}deg) translateZ(${CYLINDER_RADIUS}px)`, backfaceVisibility: 'hidden' }}>
        <span className="select-none" style={{ fontSize: 36,
          filter: isJackpot && !spinning && isWin ? 'drop-shadow(0 0 25px #ff6b00)' : 'none' }}>
          {symbol}
        </span>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 82, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '50% / 14%',
          background: 'linear-gradient(180deg, #2a1500 0%, #4d2800 6%, #805000 12%, #d8c8a8 16%, #f0e8d0 25%, #f8f4e0 40%, #fefce8 50%, #f8f4e0 60%, #f0e8d0 75%, #d8c8a8 84%, #805000 88%, #4d2800 94%, #2a1500 100%)',
          border: '3px solid #ff8c00',
          boxShadow: '0 0 0 2px #663800, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2), inset 0 4px 8px rgba(255,255,255,0.35)',
        }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #1a0a00, #3a1c00, #664400, rgba(102,68,0,0))', borderBottom: '2px solid #ff8c00', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #1a0a00, #3a1c00, #664400, rgba(102,68,0,0))', borderTop: '2px solid #ff8c00', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #664400, #ff8c00, #ffaa00, #ff8c00, #664400, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #664400, #ff8c00, #ffaa00, #ff8c00, #664400, transparent 95%)' }} />
      </div>
      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ borderRadius: '50% / 14%' }}>
          <div className="absolute inset-0" style={{ borderRadius: '50% / 14%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }} />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <span style={{ fontSize: 28 }}>🔒</span>
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,140,0,0.5)' }}>LOCKED</span>
          </div>
        </div>
      )}
      {isWin && !spinning && !locked && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(255,140,0,0.9), inset 0 0 30px rgba(255,140,0,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── 4th Reel: Special Cylinder ───
const SP_CELL_H = 54;

const SpecialCylinderReel = ({
  finalIdx, spinning, onStop, soundEnabled, isWin, spinId, displaySymbols = SPECIAL_SYMBOLS,
}: {
  finalIdx: number; spinning: boolean; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; displaySymbols?: typeof SPECIAL_SYMBOLS;
}) => {
  const specialFaces = displaySymbols.length;
  const spFaceAngle = 360 / specialFaces;
  const spRadius = (SP_CELL_H / 2) / Math.tan(Math.PI / specialFaces);
  const [rotationX, setRotationX] = useState(-(finalIdx * spFaceAngle));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIdx * spFaceAngle));
  const SPIN_DURATION = 200;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = 7;
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
    const fullRotations = 2;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * spFaceAngle) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.7) { eased = progress / 0.7 * 0.85; }
      else {
        const t = (progress - 0.7) / 0.3;
        const decel = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.02 * (1 - t);
        eased = 0.85 + 0.15 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.005);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        const finalAngle = -(finalIdx * spFaceAngle);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) {
          TropicalFruitsSound.reelStop(3);
          if (finalIdx === 0) setTimeout(() => TropicalFruitsSound.nearMiss(), 150);
        }
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId, finalIdx, spFaceAngle]);

  const containerH = 200;
  const getSymbolStyle = (sym: typeof SPECIAL_SYMBOLS[0]) => {
    if (sym.type === 'scatter') return { color: '#ff00ff', glow: 'drop-shadow(0 0 12px rgba(255,0,255,0.8))', fontSize: 18 };
    if (sym.type === 'wild') return { color: '#00ffcc', glow: 'drop-shadow(0 0 12px rgba(0,255,200,0.8))', fontSize: 18 };
    if (sym.value >= 100) return { color: '#ff4444', glow: 'drop-shadow(0 0 10px rgba(255,68,68,0.6))', fontSize: 16 };
    if (sym.value >= 20) return { color: '#ff8800', glow: 'drop-shadow(0 0 8px rgba(255,136,0,0.5))', fontSize: 15 };
    if (sym.value >= 5) return { color: '#ffd700', glow: 'drop-shadow(0 0 6px rgba(255,215,0,0.4))', fontSize: 14 };
    return { color: '#aaa', glow: 'none', fontSize: 13 };
  };

  const faces = displaySymbols.map((sym, i) => {
    const style = getSymbolStyle(sym);
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{ height: SP_CELL_H, top: `calc(50% - ${SP_CELL_H / 2}px)`,
          transform: `rotateX(${i * spFaceAngle}deg) translateZ(${spRadius}px)`, backfaceVisibility: 'hidden' }}>
        <div className="flex flex-col items-center gap-0 select-none">
          {sym.type === 'scatter' && <span style={{ fontSize: 22, filter: style.glow }}>💫</span>}
          {sym.type === 'wild' && <span style={{ fontSize: 22, filter: style.glow }}>🃏</span>}
          {sym.type === 'multiplier' && (
            <span className="font-black" style={{ fontSize: style.fontSize, color: style.color, filter: style.glow, textShadow: `0 0 8px ${style.color}40` }}>
              {sym.emoji}
            </span>
          )}
          {sym.type !== 'multiplier' && (
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: style.color }}>{sym.label}</span>
          )}
        </div>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 72, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #1a002a 0%, #2a0040 6%, #3d0060 12%, #1a1a2e 16%, #22223a 25%, #2a2a45 40%, #30304d 50%, #2a2a45 60%, #22223a 75%, #1a1a2e 84%, #3d0060 88%, #2a0040 94%, #1a002a 100%)',
        border: '3px solid #ff00ff',
        boxShadow: '0 0 0 2px #660066, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,0,255,0.05), 0 0 15px rgba(255,0,255,0.15)',
      }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ff66ff, #990099)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ff66ff, #990099)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #0d0015, #1a002a, #3d0060, rgba(61,0,96,0))', borderBottom: '2px solid #ff00ff', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #0d0015, #1a002a, #3d0060, rgba(61,0,96,0))', borderTop: '2px solid #ff00ff', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
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
          style={{ background: 'linear-gradient(90deg, transparent 5%, #990099, #ff00ff, #ff66ff, #ff00ff, #990099, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #990099, #ff00ff, #ff66ff, #ff00ff, #990099, transparent 95%)' }} />
      </div>
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

// ─── Main Game ───
const TropicalFruitsGame = () => {
  const navigate = useNavigate();
  const { balance, addWin, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelIdxs, setReelIdxs] = useState<number[]>([0, 0, 0]);
  const [specialIdx, setSpecialIdx] = useState(0);
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [showMultiplierAnim, setShowMultiplierAnim] = useState(false);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [inFreeSpinMode, setInFreeSpinMode] = useState(false);
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number; newBalance: number | null }>({ outcome: 'loss', maxWinAmount: 0, newBalance: null });
  const wildMultRef = useRef(1);

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('tropical-fruits', 'Lucky Tropical Fruits', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const adjustBet = (dir: number) => {
    if (spinning || inFreeSpinMode) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setBetAmount(steps[newIdx]);
    if (soundEnabled) TropicalFruitsSound.buttonClick();
  };

  // How many of the 3 reels are locked based on bet
  const activeReels = getActiveReelCount(betAmount);
  const lockedReels = 3 - activeReels;

  const handleReelStop = useCallback(() => { setStoppedReels(prev => prev + 1); }, []);

  // Evaluate win when all 4 reels stop
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    setSpinning(false);
    setStoppedReels(0);

    const oc = outcomeRef.current;

    // ─── LOSS CHECK FIRST — regardless of what reels show ───
    if (oc.outcome === 'loss') {
      setActiveMultiplier(1);
      setLastWin(0); setWinMultiplier(0); setIsWin(false);
      if (soundEnabled) TropicalFruitsSound.loss();
      if (!inFreeSpinMode && oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
      setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
    } else {
      // ─── WIN PATH ───
      const [d1, d2, d3] = reelIdxs;
      const special = SPECIAL_SYMBOLS[specialIdx];

      let mult = 1;
      if (special.type === 'multiplier') mult = special.value;
      else if (special.type === 'wild') mult = wildMultRef.current;
      if (inFreeSpinMode && mult < 5) mult = 5;

      setActiveMultiplier(mult);
      if (mult > 1) {
        setShowMultiplierAnim(true);
        if (soundEnabled) TropicalFruitsSound.multiplierActivate();
        setTimeout(() => setShowMultiplierAnim(false), 400);
      }

      if (special.type === 'scatter' && !inFreeSpinMode) {
        setFreeSpins(10); setInFreeSpinMode(true);
        if (soundEnabled) TropicalFruitsSound.freeSpinStart();
        gameToast.success('💫 SCATTER! 10 Free Spins! Min 5x multiplier!');
      }

      const threeDigitNum = d1 * 100 + d2 * 10 + d3;
      if (threeDigitNum > 0) {
        const effectiveMult = mult === 0 ? 1 : mult;
        const rawWin = threeDigitNum * effectiveMult;
        // Use backend amount as authoritative — avoids mismatch
        const authoritativeWin = Math.round(oc.maxWinAmount ?? (oc as { winAmount?: number }).winAmount ?? 0);
        const winAmt = authoritativeWin > 0 ? authoritativeWin : Math.min(rawWin, oc.maxWinAmount || rawWin);
        const displayMult = Math.round((winAmt / betAmount) * 10) / 10;
        setLastWin(winAmt); setWinMultiplier(displayMult); setIsWin(true);

        const serverOutcome = oc.outcome;
        if (serverOutcome === 'mega_win') {
          setShowJackpot(true); setShowConfetti(true);
          if (soundEnabled) TropicalFruitsSound.jackpot();
          setTimeout(() => { setShowJackpot(false); setShowConfetti(false); }, 800);
        } else if (serverOutcome === 'big_win') {
          setShowBigWin(true); setShowConfetti(true);
          if (soundEnabled) TropicalFruitsSound.bigWin();
          setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600);
        } else {
          setShowConfetti(true);
          if (soundEnabled) TropicalFruitsSound.win();
          setTimeout(() => { setShowConfetti(false); }, 500);
        }
        if (inFreeSpinMode) addWin(winAmt, 'T.Fruits', 'slot', displayMult, betAmount, 'tropical-fruits');
        else if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
        setSpinHistory(prev => [{ win: true, amount: winAmt }, ...prev.slice(0, 14)]);
      } else {
        setLastWin(0); setWinMultiplier(0); setIsWin(false);
        if (soundEnabled) TropicalFruitsSound.loss();
        if (!inFreeSpinMode && oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
        setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
      }
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
      setTimeout(() => { if (autoSpinRef.current || inFreeSpinMode) spinRef.current(); }, 200);
    }
  }, [stoppedReels]);

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!inFreeSpinMode && betAmount > balance) { gameToast.error('Insufficient balance'); return; }
    setLastWin(0); setWinMultiplier(0); setIsWin(false);
    setShowBigWin(false); setShowJackpot(false);
    setActiveMultiplier(1); setShowMultiplierAnim(false);
    if (soundEnabled) TropicalFruitsSound.spin();
    setStoppedReels(lockedReels); setSpinning(true);

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = inFreeSpinMode
        ? await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'tropical-fruits', is_free_spin: true })
        : await api.sharedSlotSpin({ bet: betAmount, game_id: 'tropical-fruits', game_name: 'Tropical Fruits' });
      if (data && data.outcome) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      return;
    }
    outcomeRef.current = outcome;

    const allowedSpecial = getAllowedSpecialIndices(betAmount);

    // Pick 4th reel FIRST so we know the multiplier
    let specialResult: number;
    if (outcome.outcome === 'mega_win') {
      const megaPool = allowedSpecial.filter((i) => {
        const s = SPECIAL_SYMBOLS[i];
        return s.type === 'multiplier' && s.value >= 25;
      });
      specialResult = megaPool.length ? megaPool[Math.floor(Math.random() * megaPool.length)] : allowedSpecial[0];
    } else if (outcome.outcome === 'big_win') {
      const bigPool = allowedSpecial.filter((i) => {
        const s = SPECIAL_SYMBOLS[i];
        return s.type === 'multiplier' && s.value >= 10 && s.value <= 50;
      });
      specialResult = bigPool.length ? bigPool[Math.floor(Math.random() * bigPool.length)] : allowedSpecial[0];
    } else if (outcome.outcome === 'medium_win') {
      const medPool = [2, 4, 6].filter((i) => allowedSpecial.includes(i));
      specialResult = medPool.length ? medPool[Math.floor(Math.random() * medPool.length)] : allowedSpecial[0];
    } else if (outcome.outcome === 'small_win') {
      const lowPool = [0, 2].filter((i) => allowedSpecial.includes(i));
      specialResult = lowPool.length ? lowPool[Math.floor(Math.random() * lowPool.length)] : allowedSpecial[0];
    } else if (inFreeSpinMode) {
      const fsPool = [0, 2, 4, 6].filter((i) => allowedSpecial.includes(i));
      specialResult = fsPool.length ? fsPool[Math.floor(Math.random() * fsPool.length)] : allowedSpecial[0];
    } else {
      const ms = await getMultiplierSettings();
      const raw = pickSpecialIdxFromSettings(ms);
      specialResult = allowedSpecial.includes(raw) ? raw : allowedSpecial[Math.floor(Math.random() * allowedSpecial.length)];
    }

    const hardCap = outcome.outcome !== 'loss' ? (outcome.maxWinAmount || (betAmount * 25)) : 0;

    // Downgrade 4th reel multiplier if it exceeds what hardCap can support
    if (outcome.outcome !== 'loss') {
      const getMultVal = (idx: number) => {
        const s = SPECIAL_SYMBOLS[idx];
        return s.type === 'multiplier' ? s.value : (s.type === 'wild' ? 10 : 1);
      };
      let currentMult = getMultVal(specialResult);
      if (inFreeSpinMode && currentMult < 5) currentMult = 5;
      if (currentMult > 1 && hardCap / currentMult < 1) {
        const sortedIndices = SPECIAL_SYMBOLS
          .map((s, i) => ({ i, v: s.type === 'multiplier' ? s.value : (s.type === 'wild' ? 10 : 1) }))
          .filter(x => allowedSpecial.includes(x.i) && x.v <= hardCap && x.v >= 1)
          .sort((a, b) => b.v - a.v);
        if (sortedIndices.length > 0) specialResult = sortedIndices[0].i;
        else specialResult = allowedSpecial.includes(0) ? 0 : allowedSpecial[0];
      }
    }

    const specialSym = SPECIAL_SYMBOLS[specialResult];
    let effectiveMult = 1;
    if (specialSym.type === 'multiplier') effectiveMult = specialSym.value;
    else if (specialSym.type === 'wild') effectiveMult = 10;
    if (inFreeSpinMode && effectiveMult < 5) effectiveMult = 5;
    wildMultRef.current = effectiveMult;

    const maxCombined = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 999;

    // Generate digits reverse-engineered from maxCombined
    let finalIdxs: number[];
    if (outcome.outcome === 'loss') {
      finalIdxs = [0, 0, 0];
    } else {
      let targetNumber: number;
      if (outcome.outcome === 'mega_win') {
        targetNumber = Math.min(700 + Math.floor(Math.random() * 299), maxCombined);
      } else if (outcome.outcome === 'big_win') {
        targetNumber = Math.min(200 + Math.floor(Math.random() * 500), maxCombined);
      } else if (outcome.outcome === 'medium_win') {
        targetNumber = Math.min(10 + Math.floor(Math.random() * 190), maxCombined);
      } else {
        targetNumber = Math.min(1 + Math.floor(Math.random() * 9), maxCombined);
      }
      if (targetNumber <= 0) targetNumber = 1;
      finalIdxs = [
        Math.floor(targetNumber / 100) % 10,
        Math.floor(targetNumber / 10) % 10,
        targetNumber % 10,
      ];
    }

    // Force locked reels to 0
    for (let i = 0; i < lockedReels; i++) {
      finalIdxs[i] = 0;
    }

    setReelIdxs(finalIdxs);
    setSpecialIdx(specialResult);
    setSpinId(prev => prev + 1);
  };

  useEffect(() => { spinRef.current = spin; });
  useEffect(() => { if (autoSpin && !spinning) spinRef.current(); }, [autoSpin]);

  const currentSpecial = SPECIAL_SYMBOLS[specialIdx];

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🍉 Lucky Tropical Fruits" onComplete={handleLoadingComplete} />
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0800 0%, #2a1500 40%, #1a0800 100%)' }}>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,140,0,0.06) 0%, rgba(200,100,0,0.03) 40%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="min-h-[44px] min-w-[44px] p-2 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>
          <div className="flex items-center gap-1">
            <span className="font-black text-lg" style={{
              background: 'linear-gradient(180deg, #ff8c00 0%, #cc5200 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
            }}>T.</span>
            <span className="font-black text-xl" style={{
              background: 'linear-gradient(180deg, #00cc44 0%, #008822 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 2px rgba(0,200,50,0.5))',
            }}>FRUITS</span>
          </div>
          {inFreeSpinMode && (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(255,0,255,0.2)', border: '1px solid rgba(255,0,255,0.4)', color: '#ff66ff' }}>
              FREE {freeSpins}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Tropical Fruits" betAmount={betAmount} {...TROPICAL_FRUITS_PAYTABLE} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {soundEnabled ? <Volume2 size={16} className="text-orange-400" /> : <VolumeX size={16} className="text-white/40" />}
            </button>
            <div className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(255,140,0,0.4)', background: 'rgba(255,140,0,0.08)' }}>
              <span className="text-sm font-bold text-orange-400">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>


        {/* 3D Slot Machine */}
        <div className="flex-1 flex items-center justify-center px-3 relative z-10">
          <div className="w-full max-w-[min(95vw,480px)] relative">
            <style>{`@keyframes tfLights { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
            <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff8c00', '#ffd700', '#00cc44', '#ff6600', '#ffaa00', '#33cc33'][i % 6],
                  boxShadow: `0 0 6px ${['#ff8c00', '#ffd700', '#00cc44', '#ff6600', '#ffaa00', '#33cc33'][i % 6]}`,
                  animation: `tfLights 1.5s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#ff8c00', '#33cc33', '#ffaa00', '#ff6600', '#00cc44'][i % 6],
                  boxShadow: `0 0 6px ${['#ffd700', '#ff8c00', '#33cc33', '#ffaa00', '#ff6600', '#00cc44'][i % 6]}`,
                  animation: `tfLights 1.5s ease-in-out ${i * 0.15 + 0.3}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff8c00', '#ffd700', '#00cc44', '#ffaa00'][i % 4],
                  boxShadow: `0 0 6px ${['#ff8c00', '#ffd700', '#00cc44', '#ffaa00'][i % 4]}`,
                  animation: `tfLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#ff8c00', '#ffaa00', '#00cc44'][i % 4],
                  boxShadow: `0 0 6px ${['#ffd700', '#ff8c00', '#ffaa00', '#00cc44'][i % 4]}`,
                  animation: `tfLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                }} />
              ))}
            </div>

            <div className="rounded-3xl p-2 relative"
              style={{
                background: 'linear-gradient(180deg, #1a0800, #3a1c00, #1a0800)',
                border: '3px solid #ff8c00',
                boxShadow: '0 0 50px rgba(255,140,0,0.1), 0 0 0 3px #663800, inset 0 2px 4px rgba(255,140,0,0.15)',
              }}>
              <div className="text-center py-2 relative">
                <span className="text-xs font-extrabold tracking-[0.3em] uppercase"
                  style={{ color: '#ff8c00', textShadow: '0 0 10px rgba(255,140,0,0.3)' }}>
                  🍉 T.FRUITS 🍉
                </span>
              </div>
              <div className="mx-4 h-[2px] mb-2"
                style={{ background: 'linear-gradient(90deg, transparent, #ff8c00, #ffaa00, #ff8c00, transparent)' }} />

              {/* Reels area — 3 fruit reels + 4th bonus reel */}
              <div className="flex justify-center items-center gap-1 py-3 px-1 mx-1 rounded-2xl relative"
                style={{ background: 'linear-gradient(180deg, #0a0815, #15122a, #0a0815)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,140,0,0.15)' }}>
                {/* Separators between fruit reels */}
                {[0, 1].map(i => (
                  <div key={`sep-${i}`} className="absolute z-10 w-[3px]" style={{
                    left: `${25 * (i + 1)}%`, top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #663800, #ffaa00, #ff8c00, #ffaa00, #663800)',
                    borderRadius: 2, boxShadow: '0 0 6px rgba(255,140,0,0.3)',
                  }} />
                ))}
                {/* Purple separator before 4th reel */}
                <div className="absolute z-10 w-[3px]" style={{
                  left: '75%', top: 8, bottom: 8,
                  background: 'linear-gradient(180deg, #660066, #ff66ff, #ff00ff, #ff66ff, #660066)',
                  borderRadius: 2, boxShadow: '0 0 6px rgba(255,0,255,0.3)',
                }} />
                {reelIdxs.map((idx, i) => {
                  const isLocked = i < lockedReels;
                  return (
                    <CylinderReel key={i} finalIdx={isLocked ? 0 : idx} spinning={isLocked ? false : spinning} reelIndex={i}
                      onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin} spinId={spinId} locked={isLocked} />
                  );
                })}
                <SpecialCylinderReel
                  finalIdx={getDisplayIdxForBet(betAmount, specialIdx)}
                  displaySymbols={getDisplaySymbolsForBet(betAmount)}
                  spinning={spinning}
                  onStop={handleReelStop}
                  soundEnabled={soundEnabled}
                  isWin={isWin && activeMultiplier > 1}
                  spinId={spinId}
                />
              </div>

              <div className="mx-4 h-[2px] mt-2"
                style={{ background: 'linear-gradient(90deg, transparent, #ff8c00, #ffaa00, #ff8c00, transparent)' }} />

              {/* Multiplier display */}
              {!spinning && activeMultiplier > 1 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center py-1">
                  <span className="text-xs font-bold" style={{ color: '#ff66ff' }}>
                    4th Reel: {currentSpecial.type === 'wild' ? '🃏 WILD' : `${activeMultiplier}x`}
                  </span>
                </motion.div>
              )}

              {/* Win/Loss */}
              <div className="h-14 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!spinning && lastWin > 0 && (
                    <motion.div key="win" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="text-center flex items-center gap-2">
                      <span className="text-orange-400 text-lg">✅</span>
                      <span className="font-extrabold text-2xl" style={{ color: '#ff8c00', textShadow: '0 0 20px rgba(255,140,0,0.6)' }}>
                        WIN ৳{lastWin.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'rgba(255,140,0,0.5)' }}>({winMultiplier}x)</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-between px-4 pb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'radial-gradient(circle at 35% 35%, #ffaa00, #663800)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                ))}
              </div>
            </div>

            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                {Array.from({ length: 40 }).map((_, i) => (
                  <FruitParticle key={i} delay={i * 0.05} size={i < 10 ? 'lg' : i < 25 ? 'md' : 'sm'} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Jackpot / Big Win overlay */}
        <AnimatePresence>
          {(showBigWin || showJackpot) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
              {Array.from({ length: 60 }).map((_, i) => (
                <FruitParticle key={`overlay-${i}`} delay={i * 0.04} size={i < 15 ? 'lg' : i < 35 ? 'md' : 'sm'} />
              ))}
              <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }} exit={{ scale: 0 }} className="text-center relative z-10">
                <motion.p animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                  className="font-extrabold text-5xl mb-3"
                  style={{
                    background: showJackpot ? 'linear-gradient(135deg, #ff8c00, #ffd700, #ff8c00)' : 'linear-gradient(135deg, #ffd700, #ff8c00)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 30px rgba(255,140,0,0.5))',
                  }}>
                  {showJackpot ? '🍉 JACKPOT! 🍉' : '🎉 BIG WIN!'}
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="font-bold text-4xl" style={{ color: '#ff8c00', textShadow: '0 0 25px rgba(255,140,0,0.5)' }}>
                  ৳{lastWin.toLocaleString()}
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <SlotControlPanel
          betAmount={betAmount}
          spinning={spinning}
          autoSpin={autoSpin}
          turboMode={turboMode}
          onSpin={spin}
          onAdjustBet={(d) => adjustBet(d)}
          onSetBet={(v) => { setBetAmount(v); if (soundEnabled) TropicalFruitsSound.buttonClick(); }}
          onToggleAuto={() => { setAutoSpin(!autoSpin); if (soundEnabled) TropicalFruitsSound.buttonClick(); }}
          onToggleTurbo={() => { setTurboMode(!turboMode); if (soundEnabled) TropicalFruitsSound.buttonClick(); }}
          accentColor="ff8800"
          spinEmoji="🍉"
          spinLabel={inFreeSpinMode ? `FREE SPIN (${freeSpins})` : 'SPIN'}
          betDisabled={inFreeSpinMode}
        />

        {/* Paytable */}
        <div className="px-3 pb-4 relative z-10">
          <details className="group">
            <summary className="text-center text-[11px] font-bold uppercase tracking-wider cursor-pointer py-1"
              style={{ color: 'rgba(255,140,0,0.4)' }}>▼ Paytable</summary>
            <div className="mt-2 space-y-1">
              {[
                { label: '🍉 🍉 🍉', payout: '100-500x', color: '#ff8c00', highlight: true },
                { label: '🌴 🌴 🌴', payout: '50-250x', color: '#ffd700' },
                { label: '🥭 🥭 🥭', payout: '30-100x', color: '#ffaa00' },
                { label: '🍍 / 🍇', payout: '10-50x', color: '#aaa' },
                { label: '🍊 / 🍓', payout: '5-25x', color: '#888' },
                { label: '🍌 / 🥝 / 🫐', payout: '2-10x', color: '#666' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                  style={{ background: row.highlight ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-bold text-sm" style={{ color: row.color }}>{row.label}</span>
                  <span className="font-bold text-xs text-orange-400">{row.payout}</span>
                </div>
              ))}
              <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,0,255,0.05)', border: '1px solid rgba(255,0,255,0.15)' }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: '#ff66ff' }}>✦ 4th BONUS REEL ✦</p>
                <p className="text-[9px]" style={{ color: '#aaa' }}>
                  90% = 1x | 5% = 2x-25x | 2% = 100x-500x<br/>
                  🃏 Wild (2%) = 5x-50x | 💫 Scatter (1%) = 10 Free Spins
                </p>
                <p className="text-[9px] mt-1" style={{ color: '#888' }}>
                  3 match × 4th reel multiplier = Total Win
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </AuthGate>
  );
};

export default TropicalFruitsGame;
