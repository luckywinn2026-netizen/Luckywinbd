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
import { Lucky777Sound } from './Lucky777SoundEngine';
import PaytableModal from '@/components/PaytableModal';
import BigWinOverlay from '@/components/BigWinOverlay';
import { LUCKY_777_PAYTABLE } from '@/config/paytableConfigs';
import { outcomeToTier, getTierDisplayLabel, shouldShowFinalWinOverlay } from '../slotTierUtils';

// ─── Number Reel: digits 0-9 ───
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Weighted selection: 7 has lowest weight (win symbol)
const DIGIT_WEIGHTS: Record<number, number> = {
  0: 12, 1: 12, 2: 12, 3: 12, 4: 12,
  5: 10, 6: 10, 7: 5, 8: 8, 9: 7,
};
const TOTAL_WEIGHT = Object.values(DIGIT_WEIGHTS).reduce((a, b) => a + b, 0);

const pickDigit = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const d of DIGITS) {
    r -= DIGIT_WEIGHTS[d];
    if (r <= 0) return d;
  }
  return 0;
};

// ─── 4th Reel Multiplier Values ───
// 0 means "no multiplier" — payout is just the 3-digit number itself
const MULTIPLIER_VALUES = [0, 1, 2, 3, 5, 10, 25, 50, 100, 200, 500, 1000];
const IDX_1000X = MULTIPLIER_VALUES.indexOf(1000);

// Bet tier rules (Money Coming style):
// - 0.5/1/2: 1 reel locked
// - 5+: no lock
const getActiveReelCount = (bet: number): number => (bet >= 5 ? 3 : 2);

// Landable multiplier indices by bet:
// - 0.5–5: max 50x
// - 10–100: max 500x
// - 500–1000: 1000x never lands
const getAllowedMultiplierIndices = (bet: number): number[] => {
  if (bet <= 5) {
    return MULTIPLIER_VALUES
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v <= 50)
      .map(({ i }) => i);
  }
  return MULTIPLIER_VALUES
    .map((v, i) => ({ v, i }))
    .filter(({ i, v }) => v <= 500 || (v === 0 && i !== IDX_1000X))
    .map(({ i }) => i);
};

// Displayed multiplier indices by bet:
// - 0.5–5: up to 50x
// - 10–100: up to 500x
// - 500–1000: show 1000x, but it won't land
const getDisplayMultiplierIndices = (bet: number): number[] => {
  if (bet >= 500) return MULTIPLIER_VALUES.map((_, i) => i);
  return getAllowedMultiplierIndices(bet);
};

// Get 3-digit number from reels: e.g. [5,3,4] → 534, [0,0,2] → 2, [0,0,0] → 0
const getThreeDigitNumber = (d1: number, d2: number, d3: number): number => d1 * 100 + d2 * 10 + d3;

// ─── 3D Coin Rain ───
const CoinParticle = ({ delay, size = 'md' }: { delay: number; size?: 'sm' | 'md' | 'lg' }) => {
  const s = size === 'lg' ? 32 : size === 'md' ? 22 : 14;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 120;
  const dur = 1.8 + Math.random() * 1.2;
  const flipSpeed = 0.3 + Math.random() * 0.4;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60 }}
      initial={{ opacity: 1, y: 0, x: 0, rotateY: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 1, 0],
        y: [0, 150, 350, 550],
        x: [0, drift * 0.3, drift * 0.7, drift],
        rotateY: [0, 360 / flipSpeed, 720 / flipSpeed],
        scale: [0.8, 1, 0.9, 0.6],
      }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}
    >
      <div className="w-full h-full rounded-full relative" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #ffe566, #ffd700 40%, #c9a030 70%, #8B6914)',
            border: '2px solid #b8860b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(139,105,20,0.6), inset 0 2px 4px rgba(255,229,102,0.8)',
          }}
        >
          <span className="absolute inset-0 flex items-center justify-center font-extrabold"
            style={{
              fontSize: s * 0.5,
              color: '#8B6914',
              textShadow: '0 1px 0 rgba(255,229,102,0.6)',
            }}>৳</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── 3D Cylindrical Reel (True CSS 3D Cylinder) ───
const CELL_H = 56;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

const CylinderReel = ({
  finalDigit,
  spinning,
  reelIndex,
  onStop,
  soundEnabled,
  isWin,
  spinId,
}: {
  finalDigit: number;
  spinning: boolean;
  reelIndex: number;
  onStop: () => void;
  soundEnabled: boolean;
  isWin: boolean;
  spinId: number;
}) => {
  const [rotationX, setRotationX] = useState(-(finalDigit * FACE_ANGLE));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalDigit * FACE_ANGLE));
  const SPIN_DURATION = 150 + reelIndex * 50;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  // Phase 1: continuous free-spin
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

  // Phase 2: land on finalDigit
  useEffect(() => {
    if (!spinning || landingTriggered.current) return;
    if (spinId === lastSpinIdRef.current) return;
    lastSpinIdRef.current = spinId;
    landingTriggered.current = true;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startAngle = currentAngleRef.current;
    const fullRotations = 4 + reelIndex * 2;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalDigit * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);

      let eased: number;
      if (progress < 0.35) {
        eased = progress / 0.35 * 0.5;
      } else {
        const t = (progress - 0.35) / 0.65;
        const decel = 1 - Math.pow(1 - t, 6);
        const bounce = Math.sin(t * Math.PI * 1.8) * 0.012 * (1 - t);
        eased = 0.5 + 0.5 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.003);

      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);

      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / FACE_ANGLE);
        const curFace = Math.floor(Math.abs(currentAngle) / FACE_ANGLE);
        if (curFace !== prevFace) Lucky777Sound.tick();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalDigit * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) Lucky777Sound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 200;

  const faces = DIGITS.map((digit, i) => {
    const isSeven = digit === 7;
    const faceRotation = i * FACE_ANGLE;

    return (
      <div
        key={digit}
        className="absolute w-full flex items-center justify-center"
        style={{
          height: CELL_H,
          top: `calc(50% - ${CELL_H / 2}px)`,
          left: 0,
          transform: `rotateX(${faceRotation}deg) translateZ(${CYLINDER_RADIUS}px)`,
          backfaceVisibility: 'hidden',
        }}
      >
        <span
          className="font-extrabold select-none"
          style={{
            fontSize: 48,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            color: isSeven ? '#cc0015' : '#1a1a1a',
            textShadow: isSeven
              ? '0 0 30px rgba(255,0,50,0.7), 2px 2px 0 #c9a030, -1px -1px 0 #c9a030, 0 4px 10px rgba(0,0,0,0.4)'
              : '1px 2px 3px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.1)',
            WebkitTextStroke: isSeven ? '1.5px #c9a030' : '0.5px rgba(0,0,0,0.1)',
            filter: isSeven && !spinning && isWin ? 'drop-shadow(0 0 25px #ffd700)' : 'none',
            letterSpacing: '3px',
          }}
        >
          {digit}
        </span>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '50% / 14%',
          background: 'linear-gradient(180deg, #4a0000 0%, #8B0000 6%, #bb1133 12%, #c8c8d8 16%, #e8eaf0 25%, #f4f4f8 40%, #fafafe 50%, #f4f4f8 60%, #e8eaf0 75%, #c8c8d8 84%, #bb1133 88%, #8B0000 94%, #4a0000 100%)',
          border: '3px solid #c9a030',
          boxShadow: '0 0 0 2px #7a5a10, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2), inset 0 4px 8px rgba(255,255,255,0.35)',
        }}
      >
        {/* Gold rivets */}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{
              top: `${pct}%`, left: 3,
              background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{
              top: `${pct}%`, right: 3,
              background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          />
        ))}

        {/* Red bands top/bottom */}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{
            background: 'linear-gradient(180deg, #3a0000, #7a0000, #aa1133, rgba(170,17,51,0))',
            borderBottom: '2px solid #c9a030',
            borderRadius: '48% 48% 0 0 / 100% 100% 0 0',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{
            background: 'linear-gradient(0deg, #3a0000, #7a0000, #aa1133, rgba(170,17,51,0))',
            borderTop: '2px solid #c9a030',
            borderRadius: '0 0 48% 48% / 0 0 100% 100%',
          }}
        />

        {/* 3D Cylinder viewport */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotationX}deg)`,
              transformOrigin: '50% 50%',
            }}>
              {faces}
            </div>
          </div>

          {/* Curved glass overlay */}
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: `linear-gradient(180deg,
                rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%,
                rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.15) 50%,
                rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%,
                rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)`,
              borderRadius: '50% / 8%',
            }}
          />
          <div className="absolute left-[15%] right-[15%] top-[44%] h-[12%] pointer-events-none rounded-full z-10"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.1), rgba(255,255,255,0.02))' }}
          />
        </div>

        {/* Gold ring trim */}
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }}
        />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }}
        />
      </div>

      {/* Win glow pulse */}
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{
            borderRadius: '50% / 14%',
            boxShadow: '0 0 40px rgba(255,215,0,0.9), inset 0 0 30px rgba(255,215,0,0.3)',
          }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── 4th Reel: Multiplier Cylinder ───
const MultiplierReel = ({
  finalIndex,
  spinning,
  onStop,
  soundEnabled,
  isWin,
  spinId,
  displayValues = MULTIPLIER_VALUES,
}: {
  finalIndex: number;
  spinning: boolean;
  onStop: () => void;
  soundEnabled: boolean;
  isWin: boolean;
  spinId: number;
  displayValues?: number[];
}) => {
  const numFaces = displayValues.length;
  const faceAngle = 360 / numFaces;
  const radius = (CELL_H / 2) / Math.tan(Math.PI / numFaces);

  const [rotationX, setRotationX] = useState(-(finalIndex * faceAngle));
  const animRef = useRef<number>();
  const startTimeRef = useRef(0);
  const currentAngleRef = useRef(-(finalIndex * faceAngle));
  const SPIN_DURATION = 300;
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
    const fullRotations = 7; // More rotations for suspense
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIndex * faceAngle) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);

      let eased: number;
      if (progress < 0.3) {
        eased = progress / 0.3 * 0.4;
      } else {
        const t = (progress - 0.3) / 0.7;
        const decel = 1 - Math.pow(1 - t, 7);
        const bounce = Math.sin(t * Math.PI * 2) * 0.018 * (1 - t);
        eased = 0.4 + 0.6 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.003);

      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);

      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / faceAngle);
        const curFace = Math.floor(Math.abs(currentAngle) / faceAngle);
        if (curFace !== prevFace) Lucky777Sound.tick();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalIndex * faceAngle);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        if (soundEnabled) Lucky777Sound.reelStop(3);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId, finalIndex, faceAngle]);

  const containerH = 200;

  const faces = displayValues.map((mult, i) => {
    const isHigh = mult >= 50;
    const faceRotation = i * faceAngle;

    return (
      <div key={i}
        className="absolute w-full flex items-center justify-center"
        style={{
          height: CELL_H,
          top: `calc(50% - ${CELL_H / 2}px)`,
          left: 0,
          transform: `rotateX(${faceRotation}deg) translateZ(${radius}px)`,
          backfaceVisibility: 'hidden',
        }}
      >
        <span className="font-extrabold select-none"
          style={{
            fontSize: mult >= 100 ? 28 : 34,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            color: isHigh ? '#ffd700' : mult >= 10 ? '#ff6600' : '#1a1a1a',
            textShadow: isHigh
              ? '0 0 20px rgba(255,215,0,0.7), 2px 2px 0 #8B6914, 0 4px 10px rgba(0,0,0,0.4)'
              : mult >= 10
              ? '0 0 10px rgba(255,100,0,0.5), 1px 1px 0 #8B6914'
              : '1px 2px 3px rgba(0,0,0,0.2)',
            filter: isHigh && !spinning && isWin ? 'drop-shadow(0 0 25px #ffd700)' : 'none',
          }}
        >
          ×{mult}
        </span>
      </div>
    );
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '50% / 14%',
          background: 'linear-gradient(180deg, #002a4a 0%, #004080 6%, #1166bb 12%, #c8c8d8 16%, #e8eaf0 25%, #f4f4f8 40%, #fafafe 50%, #f4f4f8 60%, #e8eaf0 75%, #c8c8d8 84%, #1166bb 88%, #004080 94%, #002a4a 100%)',
          border: '3px solid #ffd700',
          boxShadow: '0 0 0 2px #7a5a10, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.2)',
        }}
      >
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ffe066, #b8860b)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
          />
        ))}

        <div className="absolute top-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(180deg, #001a33, #003366, #1155aa, rgba(17,85,170,0))', borderBottom: '2px solid #ffd700', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10"
          style={{ background: 'linear-gradient(0deg, #001a33, #003366, #1155aa, rgba(17,85,170,0))', borderTop: '2px solid #ffd700', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }}
        />

        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotationX}deg)`,
              transformOrigin: '50% 50%',
            }}>
              {faces}
            </div>
          </div>

          <div className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: `linear-gradient(180deg,
                rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%,
                rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.15) 50%,
                rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%,
                rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)`,
              borderRadius: '50% / 8%',
            }}
          />
        </div>

        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }}
        />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914, transparent 95%)' }}
        />
      </div>

      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{
            borderRadius: '50% / 14%',
            boxShadow: '0 0 40px rgba(0,150,255,0.9), inset 0 0 30px rgba(0,150,255,0.3)',
          }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game ───
const Lucky777Game = () => {
  const navigate = useNavigate();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelDigits, setReelDigits] = useState<number[]>([7, 7, 7]);
  const [multiplierIndex, setMultiplierIndex] = useState(0); // 4th reel index
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);
  const [finalWinAmount, setFinalWinAmount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number; winAmount?: number; newBalance: number | null }>({ outcome: 'loss', maxWinAmount: 0, newBalance: null });

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('lucky-777', 'Lucky 777', 'slot', betAmount);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  // How many of the 3 digit reels are locked (always show 0)
  const activeReels = getActiveReelCount(betAmount);
  const lockedReels = 3 - activeReels;

  const adjustBet = (dir: number) => {
    if (spinning) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(betAmount);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setBetAmount(steps[newIdx]);
    if (soundEnabled) Lucky777Sound.buttonClick();
  };

  const handleReelStop = useCallback(() => {
    setStoppedReels(prev => prev + 1);
  }, []);

  // Evaluate win when all 4 reels stop (3 digit reels + 1 multiplier reel)
  useEffect(() => {
    if (stoppedReels < 4 || !spinning) return;
    setSpinning(false);
    setStoppedReels(0);

    const [d1, d2, d3] = reelDigits;
    const oc = outcomeRef.current;
    const multValue = MULTIPLIER_VALUES[multiplierIndex] ?? 0;
    const threeDigitNum = getThreeDigitNumber(d1, d2, d3);
    const serverIsLoss = oc.outcome === 'loss' || oc.maxWinAmount <= 0;

    if (!serverIsLoss && threeDigitNum > 0) {
      // Use server's win amount as source of truth — UI must show exactly what server sent
      const serverWinAmount = Math.round(oc.winAmount ?? oc.maxWinAmount ?? 0);
      const effectiveMult = multValue === 0 ? 1 : multValue;
      const displayMult = serverWinAmount > 0 ? Math.round((serverWinAmount / betAmount) * 10) / 10 : 0;

      setLastWin(serverWinAmount);
      setWinMultiplier(displayMult);
      setIsWin(true);

      const serverOutcome = oc.outcome;
      if (serverOutcome === 'mega_win') {
        setShowJackpot(true);
        setShowConfetti(true);
        if (soundEnabled) Lucky777Sound.jackpot();
        setTimeout(() => { setShowJackpot(false); setShowConfetti(false); }, 800);
      } else if (serverOutcome === 'big_win') {
        setShowBigWin(true);
        setShowConfetti(true);
        if (soundEnabled) Lucky777Sound.bigWin();
        setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600);
      } else {
        if (shouldShowFinalWinOverlay(outcomeToTier(serverOutcome))) {
          setFinalWinAmount(serverWinAmount);
          // Final win overlay disabled
        }
        setShowConfetti(true);
        if (soundEnabled) Lucky777Sound.win();
        setTimeout(() => { setShowConfetti(false); }, 500);
      }

      const multLabel = multValue === 0 ? '' : ` × ${multValue}`;
      const tierLabel = getTierDisplayLabel(outcomeToTier(serverOutcome), serverWinAmount, betAmount).short;
      if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
      const rawWin = threeDigitNum * effectiveMult;
      setSpinHistory(prev => [{ win: true, amount: serverWinAmount }, ...prev.slice(0, 14)]);
    } else {
      // Loss — reels show whatever digits landed but no payout
      setLastWin(0);
      setWinMultiplier(0);
      setIsWin(false);
      if (soundEnabled) Lucky777Sound.loss();
      if (oc.newBalance !== null) applyAuthoritativeBalance(oc.newBalance);
      setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
    }

    if (autoSpinRef.current) {
      setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
    }
  }, [stoppedReels]);

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (betAmount > balance) { gameToast.error('Insufficient balance'); return; }

    setLastWin(0);
    setWinMultiplier(0);
    setIsWin(false);
    setShowBigWin(false);
    setShowJackpot(false);

    if (soundEnabled) Lucky777Sound.spin();

    setStoppedReels(lockedReels); // Locked reels are already "stopped"
    setSpinning(true);

    const spinStart = Date.now();

    // Fetch outcome in parallel while reels spin
    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: betAmount, game_id: 'lucky-777', game_name: 'Lucky 777' });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      return;
    }
    outcomeRef.current = outcome;

    // Server sends authoritative win amount — derive digits and multiplier to match
    const serverWinAmount = Math.round(outcome.winAmount ?? outcome.maxWinAmount ?? 0);
    const allowedMultiplierIndices = getAllowedMultiplierIndices(betAmount);

    let finalDigits: number[];
    let finalMultIndex: number;

    if (outcome.outcome === 'loss' || serverWinAmount <= 0) {
      finalDigits = [0, 0, 0];
      finalMultIndex = allowedMultiplierIndices[Math.floor(Math.random() * allowedMultiplierIndices.length)];
    } else {
      // Find multiplier + digits such that digits × multiplier = serverWinAmount (UI matches server)
      // Locked reels force leading zeros: lockedReels=2 → targetNum≤9, lockedReels=1 → targetNum≤99
      // Prefer LOWEST multiplier first so 7 shows as 7×1=7 not wrong combo
      const maxTargetByLock = lockedReels >= 2 ? 9 : lockedReels >= 1 ? 99 : 999;
      const sortedByMult = [...allowedMultiplierIndices].sort((a, b) => {
        const va = MULTIPLIER_VALUES[a] === 0 ? 1 : MULTIPLIER_VALUES[a];
        const vb = MULTIPLIER_VALUES[b] === 0 ? 1 : MULTIPLIER_VALUES[b];
        if (va !== vb) return va - vb; // low to high — pick smallest mult that works
        return b - a; // when both 1 (0 vs 1): prefer ×1 over ×0 for display
      });
      let found = false;
      for (const idx of sortedByMult) {
        const mult = MULTIPLIER_VALUES[idx] === 0 ? 1 : MULTIPLIER_VALUES[idx];
        if (serverWinAmount % mult === 0) {
          const targetNum = serverWinAmount / mult;
          if (targetNum >= 1 && targetNum <= maxTargetByLock) {
            finalMultIndex = idx;
            finalDigits = [
              Math.floor(targetNum / 100) % 10,
              Math.floor(targetNum / 10) % 10,
              targetNum % 10,
            ];
            found = true;
            break;
          }
        }
      }
      if (!found) {
        // Fallback: ×1, digits = min(serverWinAmount, maxTargetByLock)
        finalMultIndex = allowedMultiplierIndices.find((i) => MULTIPLIER_VALUES[i] === 0 || MULTIPLIER_VALUES[i] === 1) ?? allowedMultiplierIndices[0];
        const targetNum = Math.min(serverWinAmount, maxTargetByLock, 999);
        const t = Math.max(1, targetNum);
        finalDigits = [
          Math.floor(t / 100) % 10,
          Math.floor(t / 10) % 10,
          t % 10,
        ];
      }
    }

    // Force locked reels to 0 (digits already have leading zeros when locked)
    for (let i = 0; i < lockedReels; i++) {
      finalDigits[i] = 0;
    }

    // Ensure minimum free-spin time
    const elapsed = Date.now() - spinStart;
    const remaining = Math.max(0, 200 - elapsed);
    await new Promise(r => setTimeout(r, remaining));

    setReelDigits(finalDigits);
    setMultiplierIndex(finalMultIndex);
    setSpinId(prev => prev + 1);
  };

  useEffect(() => { spinRef.current = spin; });

  useEffect(() => {
    if (autoSpin && !spinning) {
      spinRef.current();
    }
  }, [autoSpin]);


  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🎰 Lucky 777" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #12102a 40%, #0a0a1a 100%)' }}
      >
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,0,60,0.06) 0%, rgba(255,215,0,0.03) 40%, transparent 70%)' }}
        />

        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2 relative z-10">
          <button onClick={() => { setAutoSpin(false); navigate('/slots'); }} className="p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft size={20} className="text-white/80" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative" style={{ perspective: '200px' }}>
              <div className="flex items-baseline gap-1" style={{ transform: 'rotateY(-5deg)', transformStyle: 'preserve-3d' }}>
                <span className="font-black text-xl tracking-tight" style={{
                  background: 'linear-gradient(180deg, #ffe566 0%, #ffd700 30%, #c9a030 60%, #8B6914 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.8))',
                  letterSpacing: '0.05em',
                }}>LUCKY</span>
                <span className="font-black text-2xl" style={{
                  background: 'linear-gradient(180deg, #ff6600 0%, #ff0044 50%, #cc0033 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 2px rgba(255,0,50,0.5)) drop-shadow(0 0 8px rgba(255,68,0,0.3))',
                  letterSpacing: '0.08em',
                }}>777</span>
              </div>
              <div className="absolute top-[2px] left-[1px] flex items-baseline gap-1 -z-10" style={{ transform: 'rotateY(-5deg)', transformStyle: 'preserve-3d' }}>
                <span className="font-black text-xl tracking-tight" style={{ color: '#4a3500', letterSpacing: '0.05em' }}>LUCKY</span>
                <span className="font-black text-2xl" style={{ color: '#660022', letterSpacing: '0.08em' }}>777</span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky 777" betAmount={betAmount} {...LUCKY_777_PAYTABLE} />
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


        {/* 3D Slot Machine */}
        <div className="flex-1 flex items-end justify-center px-3 pb-3 relative z-10">
          <div className="w-full max-w-[min(95vw,480px)] relative">
            {/* Casino frame lights */}
            <style>{`
              @keyframes casinoLights {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
              }
              @keyframes shine-sweep {
                0%, 100% { transform: translateX(-100%); }
                50% { transform: translateX(200%); }
              }
            `}</style>
            {/* Top lights */}
            <div className="absolute -top-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={`lt-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff0044', '#ffd700', '#00ff88', '#00aaff', '#ff00ff', '#ff6600'][i % 6],
                  boxShadow: `0 0 6px ${['#ff0044', '#ffd700', '#00ff88', '#00aaff', '#ff00ff', '#ff6600'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.12}s infinite`,
                }} />
              ))}
            </div>
            {/* Bottom lights */}
            <div className="absolute -bottom-2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={`lb-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#00ff88', '#ff0044', '#ffd700', '#ff00ff', '#00aaff', '#ff6600'][i % 6],
                  boxShadow: `0 0 6px ${['#00ff88', '#ff0044', '#ffd700', '#ff00ff', '#00aaff', '#ff6600'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.12 + 0.3}s infinite`,
                }} />
              ))}
            </div>
            {/* Left lights */}
            <div className="absolute top-4 bottom-4 -left-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`ll-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ffd700', '#00ff88', '#ff0044', '#00aaff', '#ff00ff', '#ff6600'][i % 6],
                  boxShadow: `0 0 6px ${['#ffd700', '#00ff88', '#ff0044', '#00aaff', '#ff00ff', '#ff6600'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            {/* Right lights */}
            <div className="absolute top-4 bottom-4 -right-2 flex flex-col justify-between z-20 pointer-events-none">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`lr-${i}`} className="w-2.5 h-2.5 rounded-full" style={{
                  background: ['#ff00ff', '#ffd700', '#00aaff', '#ff0044', '#00ff88', '#ff6600'][i % 6],
                  boxShadow: `0 0 6px ${['#ff00ff', '#ffd700', '#00aaff', '#ff0044', '#00ff88', '#ff6600'][i % 6]}`,
                  animation: `casinoLights 1.5s ease-in-out ${i * 0.2 + 0.1}s infinite`,
                }} />
              ))}
            </div>
            {/* Machine outer frame */}
            <div className="rounded-3xl p-2 relative"
              style={{
                background: 'linear-gradient(180deg, #1a0800, #2a1200, #1a0800)',
                border: '3px solid #c9a030',
                boxShadow: '0 0 50px rgba(255,215,0,0.1), 0 0 0 3px #6b4f1e, inset 0 2px 4px rgba(255,215,0,0.15)',
              }}
            >
              {/* Top label */}
              <div className="text-center py-2 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                  style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                />
                <span className="text-xs font-extrabold tracking-[0.4em] uppercase"
                  style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                  ★ LUCKY 777 ★
                </span>
              </div>

              {/* Gold divider */}
              <div className="mx-4 h-[2px] mb-2"
                style={{ background: 'linear-gradient(90deg, transparent, #c9a030, #ffd700, #c9a030, transparent)' }}
              />

              {/* Reels area: 3 digit reels + × + multiplier reel */}
              <div className="flex justify-center items-center gap-1 py-3 px-1 mx-1 rounded-2xl relative"
                style={{
                  background: 'linear-gradient(180deg, #0a0815, #15122a, #0a0815)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,215,0,0.15)',
                }}
              >
                {/* Gold separators between digit reels */}
                {[0, 1].map(i => (
                  <div key={`sep-${i}`} className="absolute z-10 w-[2px]" style={{
                    left: `${(i + 1) * 22.5}%`,
                    top: 8, bottom: 8,
                    background: 'linear-gradient(180deg, #8B6914, #ffd700, #c9a030, #ffd700, #8B6914)',
                    borderRadius: 2,
                    boxShadow: '0 0 6px rgba(255,215,0,0.3)',
                  }} />
                ))}

                {/* 3 Digit Reels */}
                {reelDigits.map((digit, i) => {
                  const isLocked = i < lockedReels;
                  return (
                    <div key={i} className="relative">
                      <CylinderReel
                        finalDigit={isLocked ? 0 : digit}
                        spinning={isLocked ? false : spinning}
                        reelIndex={i}
                        onStop={handleReelStop}
                        soundEnabled={soundEnabled}
                        isWin={isWin}
                        spinId={spinId}
                      />
                      {isLocked && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[50%/14%]"
                          style={{
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(2px)',
                            border: '2px solid rgba(255,0,0,0.4)',
                          }}
                        >
                          <div className="text-center">
                            <span className="text-2xl">🔒</span>
                            <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,100,100,0.8)' }}>
                              ৳5+ to unlock
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
                    color: '#ffd700',
                    textShadow: '0 0 15px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.8)',
                  }}>×</span>
                </div>

                {/* 4th Multiplier Reel */}
                {(() => {
                  const displayIndices = getDisplayMultiplierIndices(betAmount);
                  const displayValues = displayIndices.map((i) => MULTIPLIER_VALUES[i]);
                  const displayFinalIndex = Math.max(
                    0,
                    displayIndices.findIndex((i) => i === multiplierIndex)
                  );
                  return (
                <MultiplierReel
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
                style={{ background: 'linear-gradient(90deg, transparent, #c9a030, #ffd700, #c9a030, transparent)' }}
              />

              {/* Win/Loss display */}
              <div className="h-16 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {!spinning && lastWin > 0 && (
                    <motion.div
                      key="win"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="text-center"
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-green-400 text-lg">✅</span>
                        <span className="font-extrabold text-2xl"
                          style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                          WIN ৳{lastWin.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold block mt-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>
                        {(() => {
                          const num = getThreeDigitNumber(reelDigits[0], reelDigits[1], reelDigits[2]);
                          const mv = MULTIPLIER_VALUES[multiplierIndex];
                          const effectiveMv = mv === 0 ? 1 : mv;
                          const rawWin = num * effectiveMv;
                          // If capped by server, show capped amount without misleading formula
                          if (rawWin !== lastWin) {
                            return `WIN ৳${lastWin.toLocaleString()}`;
                          }
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
                    style={{ background: 'radial-gradient(circle at 35% 35%, #ffd700, #8B6914)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                  />
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
          type={showJackpot ? 'jackpot' : 'big_win'}
          onComplete={() => { setShowBigWin(false); setShowJackpot(false); setShowConfetti(false); }}
        />

        {/* ═══ Gorgeous 3D Controls Panel ═══ */}
        <div className="relative z-10 px-3 pb-6 pt-2">
          {/* 3D Cartoon Frame */}
          <div className="relative rounded-[20px] overflow-hidden" style={{
            background: 'linear-gradient(180deg, #2a1400 0%, #1a0c00 50%, #2a1400 100%)',
            border: '3px solid #c9a030',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6), 0 0 0 4px #5a3a10, inset 0 2px 8px rgba(255,215,0,0.1), 0 -4px 20px rgba(255,215,0,0.05)',
          }}>
            {/* Top gold trim with rivets */}
            <div className="relative h-[3px]" style={{
              background: 'linear-gradient(90deg, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914)',
            }}>
              {[15, 50, 85].map(pct => (
                <div key={pct} className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{
                  left: `${pct}%`,
                  background: 'radial-gradient(circle at 35% 35%, #ffe066, #8B6914)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }} />
              ))}
            </div>

            <div className="p-3 space-y-3">
              {/* Bet | Spin | Turbo | Auto — single row */}
              <div className="flex items-center justify-between gap-2">
                {/* Bet — left */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#c9a030' }}>BET</span>
                  <button onClick={() => adjustBet(-1)} disabled={spinning}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                    style={{
                      background: 'linear-gradient(180deg, #3a2000, #2a1400)',
                      border: '2px solid #c9a030',
                      boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,215,0,0.1)',
                    }}>
                    <Minus size={16} style={{ color: '#ffd700' }} />
                  </button>

                  {/* Bet amount — 3D sunken display */}
                  <div className="min-w-[70px] py-1.5 px-2 rounded-lg text-center shrink-0" style={{
                    background: 'linear-gradient(180deg, #0a0510 0%, #15102a 50%, #0a0510 100%)',
                    border: '2px solid #c9a030',
                    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8), 0 1px 0 rgba(255,215,0,0.15)',
                  }}>
                    <span className="font-black text-xl" style={{
                      background: 'linear-gradient(180deg, #ffe566, #ffd700, #c9a030)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                    }}>৳{betAmount}</span>
                  </div>
                  <button onClick={() => adjustBet(1)} disabled={spinning}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                    style={{
                      background: 'linear-gradient(180deg, #3a2000, #2a1400)',
                      border: '2px solid #c9a030',
                      boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,215,0,0.1)',
                    }}>
                    <Plus size={16} style={{ color: '#ffd700' }} />
                  </button>
                </div>
                {/* Spin — center */}
                <button
                  onClick={spin}
                  disabled={spinning}
                  className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-black text-xs tracking-wider active:scale-[0.96] disabled:opacity-50 relative overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  background: spinning
                    ? 'linear-gradient(180deg, #333, #222, #333)'
                    : 'linear-gradient(180deg, #ff3355, #ff0044, #cc0033, #aa0028)',
                  border: spinning ? '3px solid #555' : '3px solid #ff6680',
                  boxShadow: spinning
                    ? 'none'
                    : '0 6px 0 #8B0018, 0 8px 20px rgba(255,0,50,0.5), inset 0 2px 0 rgba(255,255,255,0.25), 0 0 30px rgba(255,0,50,0.2)',
                  color: spinning ? '#666' : '#fff',
                  textShadow: spinning ? 'none' : '0 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(255,100,100,0.3)',
                  transform: spinning ? 'translateY(0)' : undefined,
                }}
              >
                {/* Shine sweep */}
                {!spinning && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, transparent 55%)',
                    animation: 'shine-sweep 3s ease-in-out infinite',
                  }} />
                )}
                {/* 3D top highlight */}
                {!spinning && (
                  <div className="absolute top-0 left-[10%] right-[10%] h-[40%] rounded-b-full pointer-events-none" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
                  }} />
                )}
                <span className="relative z-[1]">🎰 SPIN</span>
              </button>
                {/* Turbo | Auto — right */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setTurboMode(!turboMode); if (soundEnabled) Lucky777Sound.buttonClick(); }}
                    className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95"
                    style={{
                      background: turboMode ? 'linear-gradient(180deg, #ffd700, #c9a030)' : 'linear-gradient(180deg, #2a1a00, #1a0c00)',
                      border: `2px solid ${turboMode ? '#ffe066' : '#5a3a10'}`,
                      color: turboMode ? '#1a0c00' : '#8B6914',
                      boxShadow: turboMode ? '0 0 8px rgba(255,215,0,0.3)' : 'none',
                    }}
                  >
                    ⚡ TURBO
                  </button>
                  <button
                    onClick={() => { setAutoSpin(!autoSpin); if (soundEnabled) Lucky777Sound.buttonClick(); }}
                    className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95"
                    style={{
                      background: autoSpin ? 'linear-gradient(180deg, #ffd700, #c9a030)' : 'linear-gradient(180deg, #2a1a00, #1a0c00)',
                      border: `2px solid ${autoSpin ? '#ffe066' : '#5a3a10'}`,
                      color: autoSpin ? '#1a0c00' : '#8B6914',
                      boxShadow: autoSpin ? '0 0 12px rgba(255,215,0,0.3)' : 'none',
                    }}
                  >
                    <RotateCcw size={10} className="inline mr-1" />{autoSpin ? 'STOP' : 'AUTO'}
                  </button>
                </div>
              </div>

            {/* Bottom gold trim */}
            <div className="h-[3px]" style={{
              background: 'linear-gradient(90deg, #8B6914, #ffd700, #ffe066, #ffd700, #8B6914)',
            }} />
          </div>
        </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default Lucky777Game;
