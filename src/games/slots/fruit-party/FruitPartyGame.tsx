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
import { FruitPartySound } from './FruitPartySoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { FRUIT_PARTY_PAYTABLE } from '@/config/paytableConfigs';

// ─── Symbols: party fruit emoji reel ───
const SYMBOLS = ['🎉', '🍎', '🍐', '🍋', '🍒', '🍑', '🍇', '🍓', '🫧', '⭐'];

const SYMBOL_WEIGHTS: Record<number, number> = {
  0: 5,  // 🎉 jackpot/party
  1: 10, // 🍎
  2: 10, // 🍐
  3: 12, // 🍋
  4: 7,  // 🍒
  5: 8,  // 🍑
  6: 8,  // 🍇
  7: 12, // 🍓
  8: 12, // 🫧
  9: 5,  // ⭐ star
};
const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);

const pickSymbol = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOL_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 3;
};

const getTriplePayout = (idx: number): number => {
  if (idx === 0) return 100 + Math.floor(Math.random() * 401);
  if (idx === 9) return 50 + Math.floor(Math.random() * 201);
  if (idx === 4) return 30 + Math.floor(Math.random() * 71);
  if (idx === 5) return 10 + Math.floor(Math.random() * 41);
  if (idx === 6) return 10 + Math.floor(Math.random() * 41);
  if (idx === 1) return 5 + Math.floor(Math.random() * 21);
  if (idx === 2) return 5 + Math.floor(Math.random() * 21);
  if (idx === 3) return 3 + Math.floor(Math.random() * 8);
  if (idx === 7) return 2 + Math.floor(Math.random() * 4);
  if (idx === 8) return 2;
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
];

// pickSpecialIdx now uses DB settings via getMultiplierSettings()

// ─── Party Particle ───
const PartyParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const emoji = ['🎉', '🍒', '⭐', '🎊', '🍇', '🍎'][Math.floor(Math.random() * 6)];

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
    const fullRotations = 2 + reelIndex;
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
        if (curFace !== prevFace) FruitPartySound.tick();
      }
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        const finalAngle = -(finalIdx * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) FruitPartySound.reelStop(reelIndex);
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
          filter: isJackpot && !spinning && isWin ? 'drop-shadow(0 0 25px #e040fb)' : 'none' }}>
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
          background: 'linear-gradient(180deg, #1a002a 0%, #330055 6%, #660088 12%, #d0b8e0 16%, #e8daf0 25%, #f4eef8 40%, #faf6fe 50%, #f4eef8 60%, #e8daf0 75%, #d0b8e0 84%, #660088 88%, #330055 94%, #1a002a 100%)',
          border: '3px solid #cc44ff',
          boxShadow: '0 0 0 2px #660088, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2), inset 0 4px 8px rgba(255,255,255,0.35)',
        }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ff88ff, #880088)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ff88ff, #880088)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #0d0015, #220033, #440066, rgba(68,0,102,0))', borderBottom: '2px solid #cc44ff', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #0d0015, #220033, #440066, rgba(68,0,102,0))', borderTop: '2px solid #cc44ff', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
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
          style={{ background: 'linear-gradient(90deg, transparent 5%, #440066, #cc44ff, #ee66ff, #cc44ff, #440066, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #440066, #cc44ff, #ee66ff, #cc44ff, #440066, transparent 95%)' }} />
      </div>
      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ borderRadius: '50% / 14%' }}>
          <div className="absolute inset-0" style={{ borderRadius: '50% / 14%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }} />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <span style={{ fontSize: 28 }}>🔒</span>
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(204,68,255,0.5)' }}>LOCKED</span>
          </div>
        </div>
      )}
      {isWin && !spinning && !locked && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(204,68,255,0.9), inset 0 0 30px rgba(204,68,255,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── 4th Reel: Special Cylinder ───
const SPECIAL_FACES = SPECIAL_SYMBOLS.length;
const SP_FACE_ANGLE = 360 / SPECIAL_FACES;
const SP_CELL_H = 54;
const SP_RADIUS = (SP_CELL_H / 2) / Math.tan(Math.PI / SPECIAL_FACES);

const SpecialCylinderReel = ({
  finalIdx, spinning, onStop, soundEnabled, isWin, spinId,
}: {
  finalIdx: number; spinning: boolean; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIdx * SP_FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIdx * SP_FACE_ANGLE));
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
    const fullRotations = 4;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * SP_FACE_ANGLE) - startAngle) % 360 + 360) % 360);
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
        const finalAngle = -(finalIdx * SP_FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) {
          FruitPartySound.reelStop(3);
          if (finalIdx === 0) setTimeout(() => FruitPartySound.nearMiss(), 150);
        }
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 200;
  const getSymbolStyle = (sym: typeof SPECIAL_SYMBOLS[0]) => {
    if (sym.type === 'scatter') return { color: '#00ffcc', glow: 'drop-shadow(0 0 12px rgba(0,255,200,0.8))', fontSize: 18 };
    if (sym.type === 'wild') return { color: '#ff4444', glow: 'drop-shadow(0 0 12px rgba(255,68,68,0.8))', fontSize: 18 };
    if (sym.value >= 100) return { color: '#ff4444', glow: 'drop-shadow(0 0 10px rgba(255,68,68,0.6))', fontSize: 16 };
    if (sym.value >= 20) return { color: '#ff8800', glow: 'drop-shadow(0 0 8px rgba(255,136,0,0.5))', fontSize: 15 };
    if (sym.value >= 5) return { color: '#ffd700', glow: 'drop-shadow(0 0 6px rgba(255,215,0,0.4))', fontSize: 14 };
    return { color: '#aaa', glow: 'none', fontSize: 13 };
  };

  const faces = SPECIAL_SYMBOLS.map((sym, i) => {
    const style = getSymbolStyle(sym);
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{ height: SP_CELL_H, top: `calc(50% - ${SP_CELL_H / 2}px)`,
          transform: `rotateX(${i * SP_FACE_ANGLE}deg) translateZ(${SP_RADIUS}px)`, backfaceVisibility: 'hidden' }}>
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
        background: 'linear-gradient(180deg, #001a1a 0%, #003333 6%, #005555 12%, #1a2e2e 16%, #223a3a 25%, #2a4545 40%, #304d4d 50%, #2a4545 60%, #223a3a 75%, #1a2e2e 84%, #005555 88%, #003333 94%, #001a1a 100%)',
        border: '3px solid #00ccaa',
        boxShadow: '0 0 0 2px #006655, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,255,200,0.05), 0 0 15px rgba(0,204,170,0.15)',
      }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #66ffdd, #009977)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[4px] h-[4px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #66ffdd, #009977)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #000d0d, #002222, #004444, rgba(0,68,68,0))', borderBottom: '2px solid #00ccaa', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #000d0d, #002222, #004444, rgba(0,68,68,0))', borderTop: '2px solid #00ccaa', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
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
          style={{ background: 'linear-gradient(90deg, transparent 5%, #006655, #00ccaa, #66ffdd, #00ccaa, #006655, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #006655, #00ccaa, #66ffdd, #00ccaa, #006655, transparent 95%)' }} />
      </div>
      <div className="absolute -top-5 left-0 right-0 text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#66ffdd' }}>✦ BONUS ✦</span>
      </div>
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(0,204,170,0.9), inset 0 0 30px rgba(0,204,170,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game ───
const FruitPartyGame = () => {
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
  useActivePlayer('fruit-party', 'Lucky Fruit Party', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const adjustBet = (dir: number) => {
    if (spinning || inFreeSpinMode) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setBetAmount(steps[newIdx]);
    if (soundEnabled) FruitPartySound.buttonClick();
  };

  // How many of the 3 reels are locked based on bet
  // 0.5–1: 2 locks (last 2 reels), 2: 1 lock (last reel), 5+: no locks. 1st reel always spins.
  const lockedReels = betAmount <= 1 ? 2 : betAmount < 5 ? 1 : 0;

  const handleReelStop = useCallback(() => { setStoppedReels(prev => prev + 1); }, []);

  // Evaluate win when all 4 reels stop
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    setSpinning(false);
    setStoppedReels(0);

    const oc = outcomeRef.current;

    if (oc.outcome === 'loss') {
      setActiveMultiplier(1);
      setLastWin(0); setWinMultiplier(0); setIsWin(false);
      if (soundEnabled) FruitPartySound.loss();
      if (!inFreeSpinMode && oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
      setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
    } else {
      const [d1, d2, d3] = reelIdxs;
      const special = SPECIAL_SYMBOLS[specialIdx];

      let mult = 1;
      if (special.type === 'multiplier') mult = special.value;
      else if (special.type === 'wild') mult = wildMultRef.current;
      if (inFreeSpinMode && mult < 5) mult = 5;

      setActiveMultiplier(mult);
      if (mult > 1) {
        setShowMultiplierAnim(true);
        if (soundEnabled) FruitPartySound.multiplierActivate();
        setTimeout(() => setShowMultiplierAnim(false), 400);
      }

      if (special.type === 'scatter' && !inFreeSpinMode) {
        setFreeSpins(10); setInFreeSpinMode(true);
        if (soundEnabled) FruitPartySound.freeSpinStart();
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
          if (soundEnabled) FruitPartySound.jackpot();
          setTimeout(() => { setShowJackpot(false); setShowConfetti(false); }, 800);
        } else if (serverOutcome === 'big_win') {
          setShowBigWin(true); setShowConfetti(true);
          if (soundEnabled) FruitPartySound.bigWin();
          setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600);
        } else {
          setShowConfetti(true);
          if (soundEnabled) FruitPartySound.win();
          setTimeout(() => { setShowConfetti(false); }, 500);
        }
        if (inFreeSpinMode) addWin(winAmt, 'F.Party', 'slot', displayMult, betAmount, 'fruit-party');
        else if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
        setSpinHistory(prev => [{ win: true, amount: winAmt }, ...prev.slice(0, 14)]);
      } else {
        setLastWin(0); setWinMultiplier(0); setIsWin(false);
        if (soundEnabled) FruitPartySound.loss();
        if (!inFreeSpinMode && oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
        setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
      }
    }

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
    if (soundEnabled) FruitPartySound.spin();
    setStoppedReels(lockedReels); setSpinning(true);

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = inFreeSpinMode
        ? await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'fruit-party', is_free_spin: true })
        : await api.sharedSlotSpin({ bet: betAmount, game_id: 'fruit-party', game_name: 'Fruit Party' });
      if (data && data.outcome) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      return;
    }
    outcomeRef.current = outcome;

    // Pick 4th reel FIRST so we know the multiplier
    let specialResult: number;
    if (outcome.outcome === 'mega_win') {
      specialResult = 6 + Math.floor(Math.random() * 3);
    } else if (outcome.outcome === 'big_win') {
      specialResult = 4 + Math.floor(Math.random() * 2);
    } else if (outcome.outcome === 'medium_win') {
      specialResult = [2, 4, 6][Math.floor(Math.random() * 3)];
    } else if (outcome.outcome === 'small_win') {
      specialResult = [0, 0, 0, 2][Math.floor(Math.random() * 4)];
    } else if (inFreeSpinMode) {
      specialResult = [0, 2, 4][Math.floor(Math.random() * 3)];
    } else {
      const ms = await getMultiplierSettings();
      specialResult = pickSpecialIdxFromSettings(ms);
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
          .filter(x => x.v <= hardCap && x.v >= 1)
          .sort((a, b) => b.v - a.v);
        if (sortedIndices.length > 0) specialResult = sortedIndices[0].i;
        else specialResult = 0;
      }
    }

    const specialSym = SPECIAL_SYMBOLS[specialResult];
    let effectiveMult = 1;
    if (specialSym.type === 'multiplier') effectiveMult = specialSym.value;
    else if (specialSym.type === 'wild') effectiveMult = 10;
    if (inFreeSpinMode && effectiveMult < 5) effectiveMult = 5;
    wildMultRef.current = effectiveMult;

    const maxCombined = effectiveMult > 0 ? Math.floor(hardCap / effectiveMult) : 999;

    // Generate digits
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

    // Force locked reels (last N) to 0
    for (let i = 3 - lockedReels; i < 3 && i >= 0; i++) {
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
      <GameLoadingScreen show={showSplash} gameName="🎉 Lucky Fruit Party" onComplete={handleLoadingComplete} />
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0d0015 0%, #1a002a 40%, #0d0015 100%)' }}>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(204,68,255,0.06) 0%, rgba(150,50,200,0.03) 40%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>
          <div className="flex items-center gap-1">
            <span className="font-black text-lg" style={{
              background: 'linear-gradient(180deg, #ee66ff 0%, #aa22dd 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
            }}>F.</span>
            <span className="font-black text-xl" style={{
              background: 'linear-gradient(180deg, #ffd700 0%, #cc8800 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 2px rgba(255,200,0,0.5))',
            }}>PARTY</span>
          </div>
          {inFreeSpinMode && (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(0,204,170,0.2)', border: '1px solid rgba(0,204,170,0.4)', color: '#66ffdd' }}>
              FREE {freeSpins}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Fruit Party" betAmount={betAmount} {...FRUIT_PARTY_PAYTABLE} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {soundEnabled ? <Volume2 size={16} className="text-purple-400" /> : <VolumeX size={16} className="text-white/40" />}
            </button>
            <div className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(204,68,255,0.4)', background: 'rgba(204,68,255,0.08)' }}>
              <span className="text-sm font-bold text-purple-400">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>


        {/* 3D Slot Machine */}
        <div className="flex-1 flex items-center justify-center px-3 relative z-10">
          <div className="w-full max-w-[min(95vw,480px)] relative">
            <style>{`@keyframes fpLights { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
            <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#cc44ff', '#ffd700', '#ff44aa', '#ee66ff', '#ffaa00', '#ff66cc'][i % 6],
                  boxShadow: `0 0 6px ${['#cc44ff', '#ffd700', '#ff44aa', '#ee66ff', '#ffaa00', '#ff66cc'][i % 6]}`,
                  animation: `fpLights 1.5s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#cc44ff', '#ffaa00', '#ff44aa', '#ee66ff', '#ff66cc'][i % 6],
                  boxShadow: `0 0 6px ${['#ffd700', '#cc44ff', '#ffaa00', '#ff44aa', '#ee66ff', '#ff66cc'][i % 6]}`,
                  animation: `fpLights 1.5s ease-in-out ${i * 0.15 + 0.3}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#cc44ff', '#ffd700', '#ff44aa', '#ffaa00'][i % 4],
                  boxShadow: `0 0 6px ${['#cc44ff', '#ffd700', '#ff44aa', '#ffaa00'][i % 4]}`,
                  animation: `fpLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#cc44ff', '#ffaa00', '#ff44aa'][i % 4],
                  boxShadow: `0 0 6px ${['#ffd700', '#cc44ff', '#ffaa00', '#ff44aa'][i % 4]}`,
                  animation: `fpLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                }} />
              ))}
            </div>

            <div className="rounded-3xl p-2 relative"
              style={{
                background: 'linear-gradient(180deg, #0d0015, #220033, #0d0015)',
                border: '3px solid #cc44ff',
                boxShadow: '0 0 50px rgba(204,68,255,0.1), 0 0 0 3px #660088, inset 0 2px 4px rgba(204,68,255,0.15)',
              }}>
              <div className="text-center py-2 relative">
                <span className="text-xs font-extrabold tracking-[0.3em] uppercase"
                  style={{ color: '#cc44ff', textShadow: '0 0 10px rgba(204,68,255,0.3)' }}>
                  🎉 F.PARTY 🎉
                </span>
              </div>
              <div className="mx-4 h-[2px] mb-2"
                style={{ background: 'linear-gradient(90deg, transparent, #cc44ff, #ee66ff, #cc44ff, transparent)' }} />

              {/* Reels area — 3 fruit reels + 4th bonus reel */}
              <div className="flex justify-center items-center gap-1 py-3 px-1 mx-1 rounded-2xl relative"
                style={{ background: 'linear-gradient(180deg, #0a0815, #15122a, #0a0815)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(204,68,255,0.15)' }}>
                {[0, 1].map(i => (
                  <div key={`sep-${i}`} className="absolute z-10 w-[3px]" style={{
                    left: `${25 * (i + 1)}%`, top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #440066, #ee66ff, #cc44ff, #ee66ff, #440066)',
                    borderRadius: 2, boxShadow: '0 0 6px rgba(204,68,255,0.3)',
                  }} />
                ))}
                {/* Teal separator before 4th reel */}
                <div className="absolute z-10 w-[3px]" style={{
                  left: '75%', top: 8, bottom: 8,
                  background: 'linear-gradient(180deg, #006655, #66ffdd, #00ccaa, #66ffdd, #006655)',
                  borderRadius: 2, boxShadow: '0 0 6px rgba(0,204,170,0.3)',
                }} />
                {reelIdxs.map((idx, i) => {
                  // Lock last N reels so 1st reel always spins
                  const isLocked = lockedReels > 0 && i >= 3 - lockedReels;
                  return (
                    <CylinderReel key={i} finalIdx={isLocked ? 0 : idx} spinning={isLocked ? false : spinning} reelIndex={i}
                      onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin} spinId={spinId} locked={isLocked} />
                  );
                })}
                <SpecialCylinderReel finalIdx={specialIdx} spinning={spinning}
                  onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin && activeMultiplier > 1} spinId={spinId} />
              </div>

              <div className="mx-4 h-[2px] mt-2"
                style={{ background: 'linear-gradient(90deg, transparent, #cc44ff, #ee66ff, #cc44ff, transparent)' }} />

              {/* Multiplier display */}
              {!spinning && activeMultiplier > 1 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center py-1">
                  <span className="text-xs font-bold" style={{ color: '#66ffdd' }}>
                    4th Reel: {currentSpecial.type === 'wild' ? '🃏 WILD' : `${activeMultiplier}x`}
                  </span>
                </motion.div>
              )}

              <div className="h-14 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!spinning && lastWin > 0 && (
                    <motion.div key="win" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="text-center flex items-center gap-2">
                      <span className="text-purple-400 text-lg">✅</span>
                      <span className="font-extrabold text-2xl" style={{ color: '#cc44ff', textShadow: '0 0 20px rgba(204,68,255,0.6)' }}>
                        WIN ৳{lastWin.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'rgba(204,68,255,0.5)' }}>({winMultiplier}x)</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-between px-4 pb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'radial-gradient(circle at 35% 35%, #ee66ff, #660088)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                ))}
              </div>
            </div>

            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                {Array.from({ length: 40 }).map((_, i) => (
                  <PartyParticle key={i} delay={i * 0.05} size={i < 10 ? 'lg' : i < 25 ? 'md' : 'sm'} />
                ))}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {(showBigWin || showJackpot) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
              {Array.from({ length: 60 }).map((_, i) => (
                <PartyParticle key={`overlay-${i}`} delay={i * 0.04} size={i < 15 ? 'lg' : i < 35 ? 'md' : 'sm'} />
              ))}
              <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }} exit={{ scale: 0 }} className="text-center relative z-10">
                <motion.p animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                  className="font-extrabold text-5xl mb-3"
                  style={{
                    background: showJackpot ? 'linear-gradient(135deg, #cc44ff, #ffd700, #cc44ff)' : 'linear-gradient(135deg, #ffd700, #cc44ff)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 30px rgba(204,68,255,0.5))',
                  }}>
                  {showJackpot ? '🎉 JACKPOT! 🎉' : '🎊 BIG WIN!'}
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="font-bold text-4xl" style={{ color: '#cc44ff', textShadow: '0 0 25px rgba(204,68,255,0.5)' }}>
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
          onSetBet={(v) => { setBetAmount(v); if (soundEnabled) FruitPartySound.buttonClick(); }}
          onToggleAuto={() => { setAutoSpin(!autoSpin); if (soundEnabled) FruitPartySound.buttonClick(); }}
          onToggleTurbo={() => { setTurboMode(!turboMode); if (soundEnabled) FruitPartySound.buttonClick(); }}
          accentColor="ff00ff"
          spinEmoji="🎉"
          spinLabel={inFreeSpinMode ? `FREE SPIN (${freeSpins})` : 'SPIN'}
          betDisabled={inFreeSpinMode}
        />

        {/* Paytable */}
        <div className="px-3 pb-4 relative z-10">
          <details className="group">
            <summary className="text-center text-[11px] font-bold uppercase tracking-wider cursor-pointer py-1"
              style={{ color: 'rgba(204,68,255,0.4)' }}>▼ Paytable</summary>
            <div className="mt-2 space-y-1">
              {[
                { label: '🎉 🎉 🎉', payout: '100-500x', color: '#cc44ff', highlight: true },
                { label: '⭐ ⭐ ⭐', payout: '50-250x', color: '#ffd700' },
                { label: '🍒 🍒 🍒', payout: '30-100x', color: '#ffaa00' },
                { label: '🍑 / 🍇', payout: '10-50x', color: '#aaa' },
                { label: '🍎 / 🍐', payout: '5-25x', color: '#888' },
                { label: '🍋 / 🍓 / 🫧', payout: '2-10x', color: '#666' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                  style={{ background: row.highlight ? 'rgba(204,68,255,0.08)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-bold text-sm" style={{ color: row.color }}>{row.label}</span>
                  <span className="font-bold text-xs text-purple-400">{row.payout}</span>
                </div>
              ))}
              <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,204,170,0.05)', border: '1px solid rgba(0,204,170,0.15)' }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: '#66ffdd' }}>✦ 4th BONUS REEL ✦</p>
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

export default FruitPartyGame;
