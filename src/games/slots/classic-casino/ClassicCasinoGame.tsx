import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Minus, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { ClassicCasinoSound } from './ClassicCasinoSoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { CLASSIC_CASINO_PAYTABLE } from '@/config/paytableConfigs';
import SlotControlPanel from '@/components/SlotControlPanel';

// ─── Symbol definitions: each maps to a digit value (0–9) ───
const SYMBOLS = [
  { label: 'BAR', value: 0, color: '#555', imageSrc: '/classic-casino-icons/classic-casino-bar.png' },
  { label: 'Cherry', value: 1, color: '#cc0033', imageSrc: '/classic-casino-icons/classic-casino-cherry.png' },
  { label: 'Lemon', value: 2, color: '#e8c800', imageSrc: '/classic-casino-icons/classic-casino-lemon.png' },
  { label: 'Orange', value: 3, color: '#ff8c00', imageSrc: '/classic-casino-icons/classic-casino-orange.png' },
  { label: 'Grape', value: 4, color: '#7b2d8e', imageSrc: '/classic-casino-icons/classic-casino-grape.png' },
  { label: 'Bell', value: 5, color: '#ffd700', imageSrc: '/classic-casino-icons/classic-casino-bell.png' },
  { label: 'Star', value: 6, color: '#ffaa00', imageSrc: '/classic-casino-icons/classic-casino-star.png' },
  { label: 'Seven', value: 7, color: '#cc0015', imageSrc: '/classic-casino-icons/classic-casino-seven.png' },
  { label: 'Diamond', value: 8, color: '#00bfff', imageSrc: '/classic-casino-icons/classic-casino-diamond.png' },
  { label: 'Crown', value: 9, color: '#ffd700', imageSrc: '/classic-casino-icons/classic-casino-crown.png' },
];

// Weighted selection: 7 (Seven) has lowest weight
const SYM_WEIGHTS: number[] = [12, 12, 12, 12, 12, 10, 10, 5, 8, 7];
const TOTAL_WEIGHT = SYM_WEIGHTS.reduce((a, b) => a + b, 0);

const pickSymIndex = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYM_WEIGHTS.length; i++) {
    r -= SYM_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
};

// ─── 4th Reel Multiplier ───
const MULTIPLIER_VALUES = [0, 1, 2, 3, 5, 10, 25, 50, 100, 200, 500, 1000];
const IDX_1000X = MULTIPLIER_VALUES.indexOf(1000);

const getActiveReelCount = (bet: number): number => (bet >= 5 ? 3 : 2);

const getAllowedMultiplierIndices = (bet: number): number[] => {
  if (bet <= 5) {
    return MULTIPLIER_VALUES
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v <= 50)
      .map(({ i }) => i);
  }
  return MULTIPLIER_VALUES
    .map((v, i) => ({ v, i }))
    .filter(({ i, v }) => i !== IDX_1000X && v <= 500)
    .map(({ i }) => i);
};

const getDisplayMultiplierIndices = (bet: number): number[] => {
  if (bet >= 500) return MULTIPLIER_VALUES.map((_, i) => i);
  return getAllowedMultiplierIndices(bet);
};

const getThreeDigitNumber = (d1: number, d2: number, d3: number): number => d1 * 100 + d2 * 10 + d3;

// ─── Coin Rain ───
const CoinParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const flipSpeed = 0.3 + Math.random() * 0.4;
  return (
    <motion.div className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60 }}
      initial={{ opacity: 1, y: 0, x: 0, rotateY: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 1, 0], y: [0, 150, 350, 550],
        x: [0, drift * 0.3, drift * 0.7, drift],
        rotateY: [0, 360 / flipSpeed, 720 / flipSpeed], scale: [0.8, 1, 0.9, 0.6],
      }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}>
      <div className="w-full h-full rounded-full relative" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle at 35% 30%, #ffe566, #ffd700 40%, #c9a030 70%, #8B6914)',
          border: '2px solid #b8860b',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(139,105,20,0.6), inset 0 2px 4px rgba(255,229,102,0.8)',
        }}>
          <span className="absolute inset-0 flex items-center justify-center font-extrabold"
            style={{ fontSize: s * 0.5, color: '#8B6914', textShadow: '0 1px 0 rgba(255,229,102,0.6)' }}>৳</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── 3D Cylindrical Symbol Reel ───
const CELL_H = 64;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

const SymbolReel = ({
  finalIndex, spinning, reelIndex, onStop, soundEnabled, isWin, spinId,
}: {
  finalIndex: number; spinning: boolean; reelIndex: number;
  onStop: () => void; soundEnabled: boolean; isWin: boolean; spinId: number;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIndex * FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIndex * FACE_ANGLE));
  const SPIN_DURATION = 150 + reelIndex * 50;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = 14 + reelIndex * 2;
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
    const fullRotations = 3 + reelIndex;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIndex * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.5) {
        eased = progress / 0.5 * 0.7;
      } else {
        const t = (progress - 0.5) / 0.5;
        const decel = 1 - Math.pow(1 - t, 4);
        const bounce = Math.sin(t * Math.PI * 1.2) * 0.01 * (1 - t);
        eased = 0.7 + 0.3 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.003);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);

      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / FACE_ANGLE);
        const curFace = Math.floor(Math.abs(currentAngle) / FACE_ANGLE);
        if (curFace !== prevFace) ClassicCasinoSound.tick();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalIndex * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) ClassicCasinoSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 210;
  const faces = SYMBOLS.map((sym, i) => {
    const faceRotation = i * FACE_ANGLE;
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{
          height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`, left: 0,
          transform: `rotateX(${faceRotation}deg) translateZ(${CYLINDER_RADIUS}px)`,
          backfaceVisibility: 'hidden',
        }}>
        <img
          src={sym.imageSrc}
          alt={sym.label}
          className="select-none object-contain pointer-events-none"
          style={{
            width: sym.value === 8 ? 58 : 54,
            height: sym.value === 8 ? 58 : 54,
            filter: sym.value === 7 && !spinning && isWin
              ? 'drop-shadow(0 0 25px #ffd700)'
              : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
          }}
        />
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 88, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '16px',
        background: 'linear-gradient(180deg, #2a0800 0%, #5a1500 6%, #8B1a00 12%, #e8e0d0 16%, #f5f0e8 25%, #faf8f2 40%, #fffef8 50%, #faf8f2 60%, #f5f0e8 75%, #e8e0d0 84%, #8B1a00 88%, #5a1500 94%, #2a0800 100%)',
        border: '3px solid #c9a030',
        boxShadow: '0 0 0 2px #7a5a10, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2)',
      }}>
        {/* Gold corner rivets */}
        {[6, 94].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 4, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[6, 94].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 4, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}

        {/* Dark red bands */}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10" style={{
          background: 'linear-gradient(180deg, #1a0400, #4a0d00, #7a1500, rgba(122,21,0,0))',
          borderBottom: '2px solid #c9a030', borderRadius: '14px 14px 0 0',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10" style={{
          background: 'linear-gradient(0deg, #1a0400, #4a0d00, #7a1500, rgba(122,21,0,0))',
          borderTop: '2px solid #c9a030', borderRadius: '0 0 14px 14px',
        }} />

        {/* 3D Cylinder */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '300px', perspectiveOrigin: '50% 50%' }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%',
            }}>{faces}</div>
          </div>
          {/* Glass overlay */}
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            background: `linear-gradient(180deg,
              rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%,
              rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.15) 50%,
              rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%,
              rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)`,
            borderRadius: '12px',
          }} />
        </div>

        {/* Gold trims */}
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }} />
      </div>

      {/* Win glow */}
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '16px' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{
            borderRadius: '16px',
            boxShadow: '0 0 40px rgba(255,215,0,0.9), inset 0 0 30px rgba(255,215,0,0.3)',
          }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── 4th Multiplier Reel (Lucky Reel) ───
const LuckyReel = ({
  finalIndex, spinning, onStop, soundEnabled, isWin, spinId,
  displayValues = MULTIPLIER_VALUES,
}: {
  finalIndex: number; spinning: boolean; onStop: () => void;
  soundEnabled: boolean; isWin: boolean; spinId: number; displayValues?: number[];
}) => {
  const numFaces = displayValues.length;
  const faceAngle = 360 / numFaces;
  const radius = (CELL_H / 2) / Math.tan(Math.PI / numFaces);
  const [rotationX, setRotationX] = useState(-(finalIndex * faceAngle));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIndex * faceAngle));
  const SPIN_DURATION = 250;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = 12;
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
    const fullRotations = 5;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIndex * faceAngle) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.4) {
        eased = progress / 0.4 * 0.6;
      } else {
        const t = (progress - 0.4) / 0.6;
        const decel = 1 - Math.pow(1 - t, 5);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.015 * (1 - t);
        eased = 0.6 + 0.4 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.003);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);

      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / faceAngle);
        const curFace = Math.floor(Math.abs(currentAngle) / faceAngle);
        if (curFace !== prevFace) ClassicCasinoSound.tick();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalIndex * faceAngle);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) ClassicCasinoSound.reelStop(3);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId, finalIndex, faceAngle]);

  const containerH = 210;
  const faces = displayValues.map((mult, i) => {
    const isHigh = mult >= 50;
    const faceRotation = i * FACE_ANGLE;
    return (
      <div key={i} className="absolute w-full flex items-center justify-center"
        style={{
          height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`, left: 0,
          transform: `rotateX(${faceRotation}deg) translateZ(${radius}px)`,
          backfaceVisibility: 'hidden',
        }}>
        <span className="font-extrabold select-none" style={{
          fontSize: mult >= 100 ? 26 : 32,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          color: isHigh ? '#ffd700' : mult >= 10 ? '#ff6600' : '#1a1a1a',
          textShadow: isHigh
            ? '0 0 20px rgba(255,215,0,0.7), 2px 2px 0 #8B6914, 0 4px 10px rgba(0,0,0,0.4)'
            : mult >= 10 ? '0 0 10px rgba(255,100,0,0.5), 1px 1px 0 #8B6914'
            : '1px 2px 3px rgba(0,0,0,0.2)',
          filter: isHigh && !spinning && isWin ? 'drop-shadow(0 0 25px #ffd700)' : 'none',
        }}>×{mult}</span>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 88, height: containerH }}>
      {/* "LUCKY REEL" label */}
      <div className="absolute -top-5 left-0 right-0 z-30 text-center">
        <span className="text-[8px] font-extrabold tracking-[0.15em] uppercase px-2 py-0.5 rounded"
          style={{ color: '#ffd700', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,215,0,0.3)' }}>
          LUCKY REEL
        </span>
      </div>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '16px',
        background: 'linear-gradient(180deg, #1a0020 0%, #3a0050 6%, #5a1080 12%, #e8e0d0 16%, #f5f0e8 25%, #faf8f2 40%, #fffef8 50%, #faf8f2 60%, #f5f0e8 75%, #e8e0d0 84%, #5a1080 88%, #3a0050 94%, #1a0020 100%)',
        border: '3px solid #ffd700',
        boxShadow: '0 0 0 2px #7a5a10, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2)',
      }}>
        {[6, 94].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 4, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[6, 94].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 4, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10" style={{
          background: 'linear-gradient(180deg, #0d0015, #250035, #45107a, rgba(69,16,122,0))',
          borderBottom: '2px solid #ffd700', borderRadius: '14px 14px 0 0',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10" style={{
          background: 'linear-gradient(0deg, #0d0015, #250035, #45107a, rgba(69,16,122,0))',
          borderTop: '2px solid #ffd700', borderRadius: '0 0 14px 14px',
        }} />
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '300px', perspectiveOrigin: '50% 50%' }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%',
            }}>{faces}</div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            background: `linear-gradient(180deg,
              rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%,
              rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.15) 50%,
              rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%,
              rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)`,
            borderRadius: '12px',
          }} />
        </div>
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }} />
      </div>
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '16px' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{
            borderRadius: '16px', boxShadow: '0 0 40px rgba(150,50,255,0.9), inset 0 0 30px rgba(150,50,255,0.3)',
          }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game ───
const ClassicCasinoGame = () => {
  const navigate = useNavigate();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelIndices, setReelIndices] = useState<number[]>([7, 7, 7]); // symbol indices
  const [multiplierIndex, setMultiplierIndex] = useState(0);
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number; newBalance: number | null }>({ outcome: 'loss', maxWinAmount: 0, newBalance: null });

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('classic-casino', 'Lucky Classic Casino', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const activeReels = getActiveReelCount(betAmount);
  const lockedReels = 3 - activeReels;

  const adjustBet = (dir: number) => {
    if (spinning) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setBetAmount(steps[newIdx]);
    if (soundEnabled) ClassicCasinoSound.buttonClick();
  };

  const handleReelStop = useCallback(() => { setStoppedReels(prev => prev + 1); }, []);

  // Evaluate win when all 4 reels stop
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    setSpinning(false);
    setStoppedReels(0);

    const [i1, i2, i3] = reelIndices;
    const d1 = SYMBOLS[i1].value, d2 = SYMBOLS[i2].value, d3 = SYMBOLS[i3].value;
    const oc = outcomeRef.current;
    const multValue = MULTIPLIER_VALUES[multiplierIndex] ?? 0;
    const threeDigitNum = getThreeDigitNumber(d1, d2, d3);

    const serverIsLoss = oc.outcome === 'loss' || oc.maxWinAmount <= 0;

    if (!serverIsLoss && threeDigitNum > 0) {
      const effectiveMult = multValue === 0 ? 1 : multValue;
      const rawWin = threeDigitNum * effectiveMult;
      // Use backend amount as authoritative — avoids mismatch
      const authoritativeWin = Math.round(oc.maxWinAmount ?? (oc as { winAmount?: number }).winAmount ?? 0);
      const winAmt = authoritativeWin > 0 ? authoritativeWin : Math.min(rawWin, oc.maxWinAmount || rawWin);
      const displayMult = Math.round((winAmt / betAmount) * 10) / 10;

      setLastWin(winAmt);
      setWinMultiplier(displayMult);
      setIsWin(true);

      const serverOutcome = oc.outcome;
      if (serverOutcome === 'mega_win') {
        setShowJackpot(true); setShowConfetti(true);
        if (soundEnabled) ClassicCasinoSound.jackpot();
        setTimeout(() => { setShowJackpot(false); setShowConfetti(false); }, 800);
      } else if (serverOutcome === 'big_win') {
        setShowBigWin(true); setShowConfetti(true);
        if (soundEnabled) ClassicCasinoSound.bigWin();
        setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600);
      } else {
        setShowConfetti(true);
        if (soundEnabled) ClassicCasinoSound.win();
        setTimeout(() => { setShowConfetti(false); }, 500);
      }

      if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
    } else {
      setLastWin(0); setWinMultiplier(0); setIsWin(false);
      if (soundEnabled) ClassicCasinoSound.loss();
      if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
    }

    if (autoSpinRef.current) {
      setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
    }
  }, [stoppedReels]);

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (betAmount > balance) { gameToast.error('Insufficient balance'); return; }

    setLastWin(0); setWinMultiplier(0); setIsWin(false);
    setShowBigWin(false); setShowJackpot(false);
    if (soundEnabled) ClassicCasinoSound.spin();
    setStoppedReels(lockedReels);
    setSpinning(true);

    const spinStart = Date.now();
    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: betAmount, game_id: 'classic-casino', game_name: 'Classic Casino' });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      return setSpinning(false);
    }
    outcomeRef.current = outcome;

    // Pick 4th reel FIRST
    const allowedMultiplierIndices = getAllowedMultiplierIndices(betAmount);
    let finalMultIndex: number;
    if (outcome.outcome === 'mega_win') {
      const megaPool = allowedMultiplierIndices.filter((i) => MULTIPLIER_VALUES[i] >= 50);
      finalMultIndex = megaPool.length ? megaPool[Math.floor(Math.random() * megaPool.length)] : allowedMultiplierIndices[0];
    } else if (outcome.outcome === 'big_win') {
      const bigPool = allowedMultiplierIndices.filter((i) => {
        const v = MULTIPLIER_VALUES[i];
        return v >= 10 && v <= 50;
      });
      finalMultIndex = bigPool.length ? bigPool[Math.floor(Math.random() * bigPool.length)] : allowedMultiplierIndices[0];
    } else if (outcome.outcome === 'medium_win') {
      const medPool = allowedMultiplierIndices.filter((i) => {
        const v = MULTIPLIER_VALUES[i];
        return v >= 2 && v <= 10;
      });
      finalMultIndex = medPool.length ? medPool[Math.floor(Math.random() * medPool.length)] : allowedMultiplierIndices[0];
    } else if (outcome.outcome === 'small_win') {
      const smallPool = allowedMultiplierIndices.filter((i) => {
        const v = MULTIPLIER_VALUES[i];
        return v === 0 || v === 1 || v === 2;
      });
      finalMultIndex = smallPool.length ? smallPool[Math.floor(Math.random() * smallPool.length)] : allowedMultiplierIndices[0];
    } else {
      // Loss should look like a loss: keep 4th reel on low/no multiplier.
      const lossPool = allowedMultiplierIndices.filter((i) => MULTIPLIER_VALUES[i] <= 1);
      finalMultIndex = lossPool.length
        ? lossPool[Math.floor(Math.random() * lossPool.length)]
        : allowedMultiplierIndices[0];
    }

    const hardCap = Math.max(outcome.maxWinAmount || 0, 0) || (betAmount * 25);

    // Downgrade multiplier if it exceeds what hardCap can support
    if (outcome.outcome !== 'loss') {
      let mv = MULTIPLIER_VALUES[finalMultIndex];
      let em = mv === 0 ? 1 : mv;
      if (em > 1 && hardCap / em < 1) {
        const sortedAllowed = [...allowedMultiplierIndices].sort((a, b) => {
          const va = MULTIPLIER_VALUES[a] === 0 ? 1 : MULTIPLIER_VALUES[a];
          const vb = MULTIPLIER_VALUES[b] === 0 ? 1 : MULTIPLIER_VALUES[b];
          return vb - va;
        });
        for (const i of sortedAllowed) {
          const v = MULTIPLIER_VALUES[i] === 0 ? 1 : MULTIPLIER_VALUES[i];
          if (v <= hardCap) { finalMultIndex = i; break; }
        }
      }
    }

    const multValue = MULTIPLIER_VALUES[finalMultIndex];
    const effectiveMult = multValue === 0 ? 1 : multValue;
    const maxCombined = Math.floor(hardCap / effectiveMult);

    // Generate target digit value then map to symbol indices
    let finalIndices: number[];
    if (outcome.outcome === 'loss') {
      // Loss visuals must match backend result to avoid user confusion.
      finalIndices = [0, 0, 0];
    } else {
      let targetNumber: number;
      if (outcome.outcome === 'mega_win') targetNumber = Math.min(700 + Math.floor(Math.random() * 299), maxCombined);
      else if (outcome.outcome === 'big_win') targetNumber = Math.min(200 + Math.floor(Math.random() * 500), maxCombined);
      else if (outcome.outcome === 'medium_win') targetNumber = Math.min(10 + Math.floor(Math.random() * 190), maxCombined);
      else targetNumber = Math.min(1 + Math.floor(Math.random() * 9), maxCombined);
      if (targetNumber <= 0) targetNumber = 1;
      // Map digit values back to symbol indices (value === index)
      finalIndices = [
        Math.floor(targetNumber / 100) % 10,
        Math.floor(targetNumber / 10) % 10,
        targetNumber % 10,
      ];
    }

    for (let i = 0; i < lockedReels; i++) finalIndices[i] = 0;

    const elapsed = Date.now() - spinStart;
    const remaining = Math.max(0, 200 - elapsed);
    await new Promise(r => setTimeout(r, remaining));

    setReelIndices(finalIndices);
    setMultiplierIndex(finalMultIndex);
    setSpinId(prev => prev + 1);
  };

  useEffect(() => { spinRef.current = spin; });
  useEffect(() => { if (autoSpin && !spinning) spinRef.current(); }, [autoSpin]);

  const reelDigits = reelIndices.map(i => SYMBOLS[i].value);

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🎰 Lucky Classic Casino" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0800 0%, #2a1200 30%, #1a0a05 60%, #0a0400 100%)' }}>

        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,200,0,0.06) 0%, rgba(200,80,0,0.03) 40%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ perspective: '200px' }}>
              <div className="flex items-baseline gap-1.5" style={{ transform: 'rotateY(-3deg)', transformStyle: 'preserve-3d' }}>
                <span className="font-black text-lg tracking-tight" style={{
                  background: 'linear-gradient(180deg, #ffe566 0%, #ffd700 30%, #c9a030 60%, #8B6914 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
                }}>CLASSIC</span>
                <span className="font-black text-xl" style={{
                  background: 'linear-gradient(180deg, #ff6600 0%, #ff0044 50%, #cc0033 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 2px rgba(255,0,50,0.5))',
                }}>CASINO</span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Classic Casino" betAmount={betAmount} {...CLASSIC_CASINO_PAYTABLE} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {soundEnabled ? <Volume2 size={16} className="text-yellow-400" /> : <VolumeX size={16} className="text-white/40" />}
            </button>
            <div className="rounded-full px-3 py-1"
              style={{ border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.08)' }}>
              <span className="text-sm font-bold text-yellow-400">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Slot Machine */}
        <div className="flex-1 flex items-center justify-center px-3 relative z-10">
          <div className="w-full max-w-[min(95vw,480px)] relative">
            {/* Casino frame lights */}
            <style>{`
              @keyframes casinoLights { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
            `}</style>
            <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff0044', '#ffd700', '#00ff88', '#ff6600', '#ff00ff', '#ffd700'][i % 6],
                  boxShadow: `0 0 6px ${['#ff0044', '#ffd700', '#00ff88', '#ff6600', '#ff00ff', '#ffd700'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.12}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#ff0044', '#00ff88', '#ff6600', '#ff00ff', '#ffd700'][i % 6],
                  boxShadow: `0 0 6px ${['#ffd700', '#ff0044', '#00ff88', '#ff6600', '#ff00ff', '#ffd700'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.12 + 0.3}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#ff0044', '#00ff88', '#ff6600'][i % 4],
                  boxShadow: `0 0 6px ${['#ffd700', '#ff0044', '#00ff88', '#ff6600'][i % 4]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff0044', '#ffd700', '#ff6600', '#00ff88'][i % 4],
                  boxShadow: `0 0 6px ${['#ff0044', '#ffd700', '#ff6600', '#00ff88'][i % 4]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                }} />
              ))}
            </div>

            {/* Machine outer frame */}
            <div className="rounded-3xl p-2 relative" style={{
              background: 'linear-gradient(180deg, #2a0800, #4a1500, #2a0800)',
              border: '3px solid #c9a030',
              boxShadow: '0 0 50px rgba(255,215,0,0.1), 0 0 0 3px #6b4f1e, inset 0 2px 4px rgba(255,215,0,0.15)',
            }}>
              {/* Top label with ornamental styling */}
              <div className="text-center py-2 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
                <span className="text-xs font-extrabold tracking-[0.3em] uppercase"
                  style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                  ♦ CLASSIC CASINO ♦
                </span>
              </div>

              {/* Gold divider */}
              <div className="mx-4 h-[2px] mb-2"
                style={{ background: 'linear-gradient(90deg, transparent, #c9a030, #ffd700, #c9a030, transparent)' }} />

              {/* Reels area */}
              <div className="flex justify-center items-center gap-1.5 py-3 px-1 mx-1 rounded-2xl relative" style={{
                background: 'linear-gradient(180deg, #0a0400, #1a0a05, #0a0400)',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,215,0,0.15)',
              }}>
                {/* Gold separators between symbol reels */}
                {[0, 1].map(i => (
                  <div key={`sep-${i}`} className="absolute z-10 w-[2px]" style={{
                    left: `${(i + 1) * 23}%`, top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #8B6914, #ffd700, #c9a030, #ffd700, #8B6914)',
                    borderRadius: 2, boxShadow: '0 0 6px rgba(255,215,0,0.3)',
                  }} />
                ))}

                {/* 3 Symbol Reels */}
                {reelIndices.map((symIdx, i) => {
                  const isLocked = i < lockedReels;
                  return (
                    <div key={i} className="relative">
                      <SymbolReel
                        finalIndex={isLocked ? 0 : symIdx}
                        spinning={isLocked ? false : spinning}
                        reelIndex={i}
                        onStop={handleReelStop}
                        soundEnabled={soundEnabled}
                        isWin={isWin}
                        spinId={spinId}
                      />
                      {isLocked && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{
                          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)',
                          border: '2px solid rgba(255,0,0,0.4)', borderRadius: '16px',
                        }}>
                          <div className="text-center">
                            <span className="text-2xl">🔒</span>
                            <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,100,100,0.8)' }}>
                              {betAmount < 10 ? '৳10+' : '৳20+'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* × Separator */}
                <div className="flex-shrink-0 flex items-center justify-center px-0.5">
                  <span className="font-extrabold text-2xl" style={{
                    color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.8)',
                  }}>×</span>
                </div>

                {/* 4th Lucky Reel */}
                {(() => {
                  const displayIndices = getDisplayMultiplierIndices(betAmount);
                  const displayValues = displayIndices.map((i) => MULTIPLIER_VALUES[i]);
                  const displayFinalIndex = Math.max(
                    0,
                    displayIndices.findIndex((i) => i === multiplierIndex)
                  );
                  return (
                    <LuckyReel
                      finalIndex={displayFinalIndex}
                      spinning={spinning}
                      onStop={handleReelStop}
                      soundEnabled={soundEnabled}
                      isWin={isWin}
                      spinId={spinId}
                      displayValues={displayValues}
                    />
                  );
                })()}
              </div>

              {/* Gold divider */}
              <div className="mx-4 h-[2px] mt-2"
                style={{ background: 'linear-gradient(90deg, transparent, #c9a030, #ffd700, #c9a030, transparent)' }} />

              {/* Win display */}
              <div className="h-16 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!spinning && lastWin > 0 && (
                    <motion.div key="win" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-green-400 text-lg">✅</span>
                        <span className="font-extrabold text-2xl" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                          WIN ৳{lastWin.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold block mt-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>
                        {(() => {
                          const num = getThreeDigitNumber(reelDigits[0], reelDigits[1], reelDigits[2]);
                          const mv = MULTIPLIER_VALUES[multiplierIndex];
                          const effectiveMv = mv === 0 ? 1 : mv;
                          const rawWin = num * effectiveMv;
                          if (rawWin !== lastWin) return `WIN ৳${lastWin.toLocaleString()}`;
                          return mv > 0 ? `${num} × ${mv} = ৳${lastWin.toLocaleString()}` : `${num} = ৳${lastWin.toLocaleString()}`;
                        })()}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom rivets */}
              <div className="flex justify-between px-4 pb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                ))}
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

        {/* Jackpot / Big Win overlay */}
        <AnimatePresence>
          {(showBigWin || showJackpot) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
              {Array.from({ length: 60 }).map((_, i) => (
                <CoinParticle key={`overlay-${i}`} delay={i * 0.04} size={i < 15 ? 'lg' : i < 35 ? 'md' : 'sm'} />
              ))}
              <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }} exit={{ scale: 0 }}
                className="text-center relative z-10">
                <motion.p animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                  className="font-extrabold text-5xl mb-3" style={{
                    background: showJackpot ? 'linear-gradient(135deg, #ff0044, #ffd700, #ff0044)' : 'linear-gradient(135deg, #ffd700, #ff8800)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.5))',
                  }}>
                  {showJackpot ? '🎰 JACKPOT! 🎰' : '🎉 BIG WIN!'}
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="font-bold text-4xl" style={{ color: '#ffd700', textShadow: '0 0 25px rgba(255,215,0,0.5)' }}>
                  ৳{lastWin.toLocaleString()}
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-8">
          <SlotControlPanel
            betAmount={betAmount}
            spinning={spinning}
            autoSpin={autoSpin}
            turboMode={turboMode}
            onSpin={spin}
            onAdjustBet={(d) => adjustBet(d)}
            onSetBet={(v) => { setBetAmount(v); if (soundEnabled) ClassicCasinoSound.buttonClick(); }}
            onToggleAuto={() => { setAutoSpin(!autoSpin); if (soundEnabled) ClassicCasinoSound.buttonClick(); }}
            onToggleTurbo={() => { setTurboMode(!turboMode); if (soundEnabled) ClassicCasinoSound.buttonClick(); }}
            accentColor="cc0022"
            spinEmoji="🎰"
          />
        </div>
      </div>
    </AuthGate>
  );
};

export default ClassicCasinoGame;
