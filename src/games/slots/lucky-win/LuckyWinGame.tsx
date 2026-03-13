import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import PaytableModal from '@/components/PaytableModal';
import { LUCKY_WIN_PAYTABLE } from '@/config/paytableConfigs';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';
import SlotControlPanel from '@/components/SlotControlPanel';
import BigWinOverlay from '@/components/BigWinOverlay';
import { outcomeToTier, getTierDisplayLabel, shouldShowFinalWinOverlay } from '../slotTierUtils';

import imgSkull from './assets/skull.png';
import imgCompass from './assets/compass.png';
import imgParrot from './assets/parrot.png';
import imgOctopus from './assets/octopus.png';
import imgBarrel from './assets/barrel.png';
import imgTreasure from './assets/treasure.png';
import imgWild from './assets/wild.png';
import imgScatter from './assets/scatter.png';

// ─── Symbol Definitions ───
const SYMBOLS = [
  { id: 'treasure', img: imgTreasure, weight: 4, payout: 50 },
  { id: 'compass', img: imgCompass, weight: 6, payout: 25 },
  { id: 'skull', img: imgSkull, weight: 7, payout: 15 },
  { id: 'parrot', img: imgParrot, weight: 9, payout: 10 },
  { id: 'octopus', img: imgOctopus, weight: 10, payout: 8 },
  { id: 'barrel', img: imgBarrel, weight: 12, payout: 5 },
  { id: 'wild', img: imgWild, weight: 3, payout: 0, isWild: true },
  { id: 'scatter', img: imgScatter, weight: 3, payout: 0, isScatter: true },
];

const SCATTER_IDX = 7; // scatter index in SYMBOLS array
const ROWS = 3;
const COLS = 5;
const TOTAL_WEIGHT = SYMBOLS.reduce((a, s) => a + s.weight, 0);
const FREE_SPIN_COUNT = 8;

const pickSymbol = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= SYMBOLS[i].weight;
    if (r <= 0) return i;
  }
  return 5;
};

// Higher scatter chance during free spins for retrigger excitement
const pickSymbolFreeSpin = (): number => {
  // Increase scatter weight slightly for retrigger possibility
  const boostedWeights = SYMBOLS.map((s, i) => i === SCATTER_IDX ? s.weight * 1.5 : s.weight);
  const total = boostedWeights.reduce((a, w) => a + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < boostedWeights.length; i++) {
    r -= boostedWeights[i];
    if (r <= 0) return i;
  }
  return 5;
};

// Count scatters in a grid
const countScatters = (g: number[][]): number => {
  let count = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (g[r][c] === SCATTER_IDX) count++;
  return count;
};

// Get scatter cell positions
const getScatterCells = (g: number[][]): [number, number][] => {
  const cells: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (g[r][c] === SCATTER_IDX) cells.push([r, c]);
  return cells;
};

// ─── Coin Particle ───
const CoinParticle = ({ delay }: { delay: number }) => {
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 100;
  const dur = 1.8 + Math.random() * 1.2;
  const s = 16 + Math.random() * 12;
  return (
    <motion.div className="absolute pointer-events-none" style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60 }}
      initial={{ opacity: 1, y: 0, x: 0, rotateY: 0 }}
      animate={{ opacity: [1, 1, 0], y: [0, 250, 500], x: [0, drift * 0.5, drift], rotateY: [0, 720] }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}
    >
      <div className="w-full h-full rounded-full" style={{
        background: 'radial-gradient(circle at 35% 30%, #ffe566, #ffd700 40%, #c9a030 70%, #8B6914)',
        border: '1.5px solid #b8860b',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}>
        <span className="absolute inset-0 flex items-center justify-center font-extrabold"
          style={{ fontSize: s * 0.45, color: '#8B6914' }}>৳</span>
      </div>
    </motion.div>
  );
};

// ─── Symbol Blast Particle ───
const BLAST_COLORS = ['#ffd700', '#ff8800', '#ff4444', '#00ff88', '#44aaff', '#ff66ff', '#ffffff'];

const SymbolBlastEffect = ({ symbolImg, cellX, cellY }: { symbolImg: string; cellX: number; cellY: number }) => {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 4 + Math.random() * 6,
      color: BLAST_COLORS[Math.floor(Math.random() * BLAST_COLORS.length)],
      rot: Math.random() * 720 - 360,
    };
  });
  return (
    <div className="absolute pointer-events-none z-50" style={{ left: cellX, top: cellY, width: 58, height: 62 }}>
      {/* Icon scale-up flash */}
      <motion.img src={symbolImg} alt="" className="absolute inset-0 w-full h-full object-contain"
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 1.6, 0], opacity: [1, 1, 0], rotate: [0, 15, -10] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* Central flash */}
      <motion.div className="absolute inset-0 rounded-lg"
        initial={{ opacity: 0.9, scale: 0.8 }}
        animate={{ opacity: 0, scale: 2.5 }}
        transition={{ duration: 0.4 }}
        style={{ background: 'radial-gradient(circle, #fff 0%, #ffd700 40%, transparent 70%)' }}
      />
      {/* Ring burst */}
      <motion.div className="absolute rounded-full"
        style={{ left: '50%', top: '50%', width: 10, height: 10, marginLeft: -5, marginTop: -5, border: '2px solid #ffd700' }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 6, opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      {/* Sparkle particles */}
      {particles.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{
            left: '50%', top: '50%', width: p.size, height: p.size,
            marginLeft: -p.size / 2, marginTop: -p.size / 2,
            background: p.color,
            boxShadow: `0 0 4px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0, rotate: p.rot }}
          transition={{ duration: 0.6 + Math.random() * 0.3, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

// ─── Win Count Ticker ───
const WinCountUp = ({ target, prefix = '৳' }: { target: number; prefix?: string }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();
  const startRef = useRef(0);
  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    startRef.current = performance.now();
    const dur = Math.min(2000, 800 + target * 2);
    const tick = (now: number) => {
      const p = Math.min((now - startRef.current) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) ref.current = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);
  return <>{prefix}{display.toLocaleString()}</>;
};

// ─── Rope Component ───
const Rope = ({ side }: { side: 'left' | 'right' }) => (
  <div className="absolute z-20" style={{
    [side]: -4, top: '10%', bottom: '10%', width: 8,
  }}>
    <div className="w-full h-full" style={{
      background: `repeating-linear-gradient(
        180deg,
        #c9a060 0px, #a07830 3px, #8B6520 6px, #c9a060 9px
      )`,
      borderRadius: 4,
      boxShadow: '2px 2px 4px rgba(0,0,0,0.4)',
    }} />
  </div>
);

// ─── Wooden Post ───
const WoodPost = ({ side }: { side: 'left' | 'right' }) => (
  <div className="absolute top-0 bottom-0 z-10" style={{
    [side]: 0, width: 22,
    background: 'linear-gradient(90deg, #5a3a18, #8B6520 30%, #a07830 50%, #8B6520 70%, #5a3a18)',
    borderRadius: side === 'left' ? '6px 0 0 6px' : '0 6px 6px 0',
    boxShadow: side === 'left'
      ? 'inset -3px 0 8px rgba(0,0,0,0.3), inset 3px 0 4px rgba(160,120,48,0.3)'
      : 'inset 3px 0 8px rgba(0,0,0,0.3), inset -3px 0 4px rgba(160,120,48,0.3)',
  }}>
    <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{
      top: '20%', width: 10, height: 10,
      background: 'radial-gradient(circle at 40% 35%, #a07830, #5a3a18)',
      border: '1px solid #4a2a10',
    }} />
    <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{
      top: '70%', width: 8, height: 8,
      background: 'radial-gradient(circle at 40% 35%, #a07830, #5a3a18)',
      border: '1px solid #4a2a10',
    }} />
  </div>
);

// ─── Free Spins Intro Overlay ───
const FreeSpinsIntro = ({ count, onDone }: { count: number; onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div className="fixed inset-0 z-[9998] flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div className="relative flex flex-col items-center gap-4 p-8"
        initial={{ scale: 0, rotateZ: -10 }} animate={{ scale: 1, rotateZ: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
        {/* Scatter icon pulsing */}
        <motion.img src={imgScatter} alt="Scatter" className="w-24 h-24 drop-shadow-2xl"
          animate={{ scale: [1, 1.2, 1], rotateY: [0, 360] }}
          transition={{ duration: 1.5, repeat: Infinity }} />
        {/* Title */}
        <motion.div className="text-center"
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="font-black text-3xl tracking-wider mb-2" style={{
            background: 'linear-gradient(135deg, #ffd700, #ff8800, #ffd700)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmer 2s ease-in-out infinite',
            textShadow: 'none',
            filter: 'drop-shadow(0 2px 8px rgba(255,215,0,0.5))',
          }}>
            🗺️ FREE SPINS! 🗺️
          </div>
          <motion.div className="font-black text-5xl" style={{ color: '#ffd700' }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}>
            {count}
          </motion.div>
          <p className="text-white/70 text-sm mt-1 font-bold">Free Spins Awarded!</p>
        </motion.div>
        {/* Coin shower */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <CoinParticle key={i} delay={i * 0.08} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Free Spins HUD Banner ───
const FreeSpinsBanner = ({ remaining, total, totalWin, multiplier }: { remaining: number; total: number; totalWin: number; multiplier: number }) => (
  <motion.div className="absolute -top-10 left-0 right-0 z-50 flex items-center justify-center"
    initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{
      background: 'linear-gradient(135deg, #1a0a30, #2d1060, #1a0a30)',
      border: '2px solid #ffd700',
      boxShadow: '0 0 20px rgba(255,215,0,0.3), 0 4px 12px rgba(0,0,0,0.5)',
    }}>
      <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}
        className="text-lg">🗺️</motion.span>
      <div className="flex items-center gap-1.5">
        <span className="font-black text-xs" style={{ color: '#ffd700' }}>FREE</span>
        <span className="font-black text-sm px-2 py-0.5 rounded-md" style={{
          background: 'rgba(255,215,0,0.15)', color: '#fff', border: '1px solid rgba(255,215,0,0.3)',
        }}>
          {remaining}/{total}
        </span>
      </div>
      {/* Multiplier badge */}
      <motion.div
        key={multiplier}
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        className="flex items-center px-2 py-0.5 rounded-md font-black text-sm"
        style={{
          background: multiplier >= 5
            ? 'linear-gradient(135deg, #ff4444, #ff0000)'
            : multiplier >= 3
            ? 'linear-gradient(135deg, #ff8800, #ff6600)'
            : multiplier >= 2
            ? 'linear-gradient(135deg, #ffd700, #ffaa00)'
            : 'linear-gradient(135deg, #888, #666)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: multiplier >= 3 ? '0 0 12px rgba(255,68,68,0.5)' : 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        <motion.span
          animate={multiplier >= 3 ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.6, repeat: Infinity }}
        >
          {multiplier}x
        </motion.span>
        {multiplier >= 5 && <span className="ml-0.5">🔥</span>}
      </motion.div>
      {totalWin > 0 && (
        <span className="font-black text-xs" style={{ color: '#00ff88' }}>
          ৳{totalWin.toLocaleString()}
        </span>
      )}
    </div>
  </motion.div>
);

// ─── Main Lucky Win Game ───
const LuckyWinGame = () => {
  const navigate = useNavigate();
  const { balance, addWin, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => Math.floor(Math.random() * SYMBOLS.length))
    )
  );
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [winCells, setWinCells] = useState<[number, number][]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [muted, setMuted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [landed, setLanded] = useState<boolean[][]>(() =>
    Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => true))
  );
  const [showGrid, setShowGrid] = useState(true);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);
  const [finalWinAmount, setFinalWinAmount] = useState(0);
  const [bigWinType, setBigWinType] = useState<'big_win' | 'mega_win' | 'jackpot'>('big_win');
  const [blastCells, setBlastCells] = useState<[number, number][]>([]);

  // ─── Free Spins State ───
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotal, setFreeSpinsTotal] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [showFreeSpinsIntro, setShowFreeSpinsIntro] = useState(false);
  const [freeSpinsBet, setFreeSpinsBet] = useState(0);
  const isFreeSpin = freeSpinsRemaining > 0;

  // ─── Progressive Multiplier State ───
  const MULTIPLIER_TIERS = [1, 2, 3, 5, 8, 10];
  const [consecutiveWins, setConsecutiveWins] = useState(0);
  const currentMultiplier = isFreeSpin ? MULTIPLIER_TIERS[Math.min(consecutiveWins, MULTIPLIER_TIERS.length - 1)] : 1;

  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number }>({ outcome: 'loss', maxWinAmount: 0 });
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const freeSpinRef = useRef(false);
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);

  const { mascot, mascotSize, background: customBg } = useGameAssets('lucky-win');
  useActivePlayer('lucky-win', 'Lucky Win', 'slot', stake);

  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);
  useEffect(() => { freeSpinRef.current = isFreeSpin; }, [isFreeSpin]);

  // Auto-play free spins
  useEffect(() => {
    if (isFreeSpin && !spinning && !animating && !showFreeSpinsIntro) {
      const t = setTimeout(() => { spinRef.current(); }, 200);
      return () => clearTimeout(t);
    }
  }, [isFreeSpin, spinning, animating, showFreeSpinsIntro]);

  const triggerFreeSpins = (count: number) => {
    setFreeSpinsRemaining(prev => prev + count);
    setFreeSpinsTotal(prev => prev > 0 ? prev + count : count);
    if (!isFreeSpin) {
      setFreeSpinsTotalWin(0);
      setFreeSpinsBet(stake);
      setConsecutiveWins(0);
    }
    setShowFreeSpinsIntro(true);
    gameToast.success(`🗺️ ${count} FREE SPINS TRIGGERED!`);
  };

  const spin = async () => {
    if (spinning || animating) return;
    if (showFreeSpinsIntro) return;

    const currentBet = isFreeSpin ? freeSpinsBet : stake;

    // Only deduct balance for normal spins, not free spins
    if (!isFreeSpin) {
      if (currentBet < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
      if (currentBet > balance) { gameToast.error('Insufficient balance'); return; }
    }

    setSpinning(true);
    setAnimating(true);
    setLastWin(0);
    setWinCells([]);
    setBlastCells([]);
    setShowConfetti(false);
    setShowGrid(false);
    setLanded(Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false)));

    // Decrement free spins counter
    if (isFreeSpin) {
      setFreeSpinsRemaining(prev => prev - 1);
    }

    const spinStart = Date.now();

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = isFreeSpin
        ? await api.gameOutcome({ bet_amount: currentBet, game_type: 'slot', game_id: 'lucky-win', is_free_spin: true })
        : await api.sharedSlotSpin({ bet: currentBet, game_id: 'lucky-win', game_name: 'Lucky Win' });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      setAnimating(false);
      return;
    }
    outcomeRef.current = outcome;

    let finalGrid: number[][];
    let winCellsResult: [number, number][] = [];
    const picker = isFreeSpin ? pickSymbolFreeSpin : pickSymbol;

    if (outcome.outcome === 'loss') {
      finalGrid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => picker())
      );
      // Break row matches
      for (let r = 0; r < ROWS; r++) {
        for (let c = 2; c < COLS; c++) {
          if (finalGrid[r][c] === finalGrid[r][c - 1] && finalGrid[r][c - 1] === finalGrid[r][c - 2]) {
            finalGrid[r][c] = (finalGrid[r][c] + 1) % 6;
          }
        }
      }
      for (let c = 0; c < COLS; c++) {
        if (finalGrid[0][c] === finalGrid[1][c] && finalGrid[1][c] === finalGrid[2][c]) {
          finalGrid[2][c] = (finalGrid[2][c] + 1) % 6;
        }
      }
      // Also break 3+ scatters on loss
      let scatterCount = countScatters(finalGrid);
      while (scatterCount >= 3) {
        // Replace a random scatter with a non-scatter
        for (let r = 0; r < ROWS && scatterCount >= 3; r++) {
          for (let c = 0; c < COLS && scatterCount >= 3; c++) {
            if (finalGrid[r][c] === SCATTER_IDX) {
              finalGrid[r][c] = Math.floor(Math.random() * 6);
              scatterCount--;
            }
          }
        }
      }
    } else {
      finalGrid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => picker())
      );
      const winSymIdx = Math.floor(Math.random() * 6);
      const winRow = Math.floor(Math.random() * ROWS);

      if (outcome.outcome === 'mega_win' || outcome.outcome === 'jackpot') {
        for (let c = 0; c < COLS; c++) finalGrid[winRow][c] = winSymIdx;
        for (let c = 0; c < COLS; c++) winCellsResult.push([winRow, c]);
      } else if (outcome.outcome === 'big_win') {
        for (let c = 0; c < 4; c++) finalGrid[winRow][c] = winSymIdx;
        for (let c = 0; c < 4; c++) winCellsResult.push([winRow, c]);
      } else if (outcome.outcome === 'medium_win') {
        const startC = Math.random() < 0.5 ? 0 : 1;
        for (let c = startC; c < startC + 4; c++) finalGrid[winRow][c] = winSymIdx;
        for (let c = startC; c < startC + 4; c++) winCellsResult.push([winRow, c]);
      } else {
        const startC = Math.floor(Math.random() * (COLS - 2));
        for (let c = startC; c < startC + 3; c++) finalGrid[winRow][c] = winSymIdx;
        for (let c = startC; c < startC + 3; c++) winCellsResult.push([winRow, c]);
      }

      // Break accidental extra matches on non-win rows
      for (let r = 0; r < ROWS; r++) {
        if (r === winRow) continue;
        for (let c = 2; c < COLS; c++) {
          if (finalGrid[r][c] === finalGrid[r][c - 1] && finalGrid[r][c - 1] === finalGrid[r][c - 2]) {
            finalGrid[r][c] = (finalGrid[r][c] + 1) % 6;
          }
        }
      }
    }

    const elapsed = Date.now() - spinStart;
    await new Promise(r => setTimeout(r, Math.max(0, 200 - elapsed)));

    setGrid(finalGrid);
    setShowGrid(true);
    setSpinning(false);

    // Cascade landing
    for (let c = 0; c < COLS; c++) {
      await new Promise(r => setTimeout(r, 30));
      setLanded(prev => {
        const next = prev.map(row => [...row]);
        for (let r = 0; r < ROWS; r++) next[r][c] = true;
        return next;
      });
    }
    await new Promise(r => setTimeout(r, 50));

    setWinCells(winCellsResult);

    // Trigger blast effect on winning cells
    if (winCellsResult.length > 0) {
      setBlastCells([...winCellsResult]);
      setTimeout(() => setBlastCells([]), 800);
    }

    // Check for scatter → free spins trigger
    const scattersOnGrid = countScatters(finalGrid);
    const scatterPositions = getScatterCells(finalGrid);

    if (outcome.outcome !== 'loss' && outcome.maxWinAmount > 0) {
      const baseWin = Math.round(outcome.maxWinAmount);
      const multipliedWin = isFreeSpin ? baseWin * currentMultiplier : baseWin;
      const winAmount = multipliedWin;
      const displayMult = Math.round((winAmount / currentBet) * 10) / 10;
      setLastWin(winAmount);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 600);

      if (freeSpinRef.current || isFreeSpin) {
        setFreeSpinsTotalWin(prev => prev + winAmount);
        setConsecutiveWins(prev => Math.min(prev + 1, MULTIPLIER_TIERS.length - 1));
      }

      if (!isFreeSpin) applyAuthoritativeBalance(outcome.newBalance);
      else addWin(winAmount, 'Lucky Win', 'slot', displayMult, currentBet, 'lucky-win');

      const tier = outcomeToTier(outcome.outcome);
      if (displayMult >= 20) {
        setBigWinType(outcome.outcome === 'jackpot' ? 'jackpot' : 'mega_win');
        setShowBigWin(true);
      } else if (displayMult >= 10) {
        setBigWinType('big_win');
        setShowBigWin(true);
      } else if (shouldShowFinalWinOverlay(tier)) {
        setFinalWinAmount(winAmount);
        // Final win overlay disabled
      }

      setSpinHistory(prev => [{ win: true, amount: winAmount }, ...prev.slice(0, 14)]);
    } else {
      if (isFreeSpin || freeSpinRef.current) {
        setConsecutiveWins(0); // Reset multiplier streak on loss
      }
      if (!isFreeSpin && !freeSpinRef.current) {
        applyAuthoritativeBalance(outcome.newBalance);
      }
      setSpinHistory(prev => [{ win: false, amount: currentBet }, ...prev.slice(0, 14)]);
    }

    setAnimating(false);

    // Trigger free spins if 3+ scatters appeared (highlight scatter cells briefly)
    if (scattersOnGrid >= 3) {
      // Highlight scatter cells
      setWinCells(prev => [...prev, ...scatterPositions]);
      await new Promise(r => setTimeout(r, 800));
      triggerFreeSpins(scattersOnGrid >= 4 ? FREE_SPIN_COUNT + 4 : FREE_SPIN_COUNT);
      return; // Don't auto-spin — free spin useEffect will handle it
    }

    // Check if free spins just ended
    if (!freeSpinRef.current && freeSpinsTotal > 0 && freeSpinsRemaining <= 0) {
      // Free spins round ended
      setFreeSpinsTotal(0);
      setFreeSpinsTotalWin(0);
    }

    if (autoSpinRef.current && !freeSpinRef.current) {
      setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
    }
  };

  useEffect(() => { spinRef.current = spin; });
  useEffect(() => { if (autoSpin && !spinning && !animating && !isFreeSpin) spinRef.current(); }, [autoSpin]);

  const adjustBet = (dir: number) => {
    if (spinning || animating || isFreeSpin) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000, 2000];
    const idx = steps.indexOf(stake);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setStake(steps[newIdx]);
  };

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🏴‍☠️ Lucky Win" onComplete={handleLoadingComplete} />

      {/* Free Spins Intro Overlay */}
      <AnimatePresence>
        {showFreeSpinsIntro && (
          <FreeSpinsIntro
            count={freeSpinsRemaining}
            onDone={() => setShowFreeSpinsIntro(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col relative overflow-hidden" style={{
        background: customBg
          ? `url(${customBg}) center/cover no-repeat`
          : isFreeSpin
          ? 'linear-gradient(180deg, #1a0a30 0%, #2d1060 30%, #4a1a80 70%, #1a0a30 100%)'
          : 'linear-gradient(180deg, #5bc0f5 0%, #3ba0d8 30%, #d4a853 70%, #c49540 100%)',
      }}>
        {/* Sky & beach background (hide during free spins for dark theme) */}
        {!isFreeSpin && (
          <>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 25%, #87ceeb 0%, #5bc0f5 30%, #d2b48c 75%, #c49540 100%)',
            }} />
            <div className="absolute bottom-0 left-0 right-0 h-[40%]" style={{
              background: 'linear-gradient(180deg, transparent 0%, #d2b48c 20%, #c49540 60%, #b08530 100%)',
            }} />
            <div className="absolute top-[8%] left-[5%] w-20 h-8 rounded-full opacity-70" style={{
              background: 'radial-gradient(ellipse, white 0%, rgba(255,255,255,0.3) 70%, transparent)',
            }} />
            <div className="absolute top-[5%] right-[10%] w-28 h-10 rounded-full opacity-60" style={{
              background: 'radial-gradient(ellipse, white 0%, rgba(255,255,255,0.3) 70%, transparent)',
            }} />
          </>
        )}
        {/* Free spins mystical background */}
        {isFreeSpin && (
          <>
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at 50% 30%, #4a1a80 0%, #2d1060 40%, #1a0a30 100%)',
            }} />
            <motion.div className="absolute inset-0 opacity-20"
              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
              transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
              style={{
                backgroundImage: 'radial-gradient(circle 80px, rgba(255,215,0,0.15) 0%, transparent 100%), radial-gradient(circle 60px, rgba(138,43,226,0.2) 0%, transparent 100%)',
                backgroundSize: '200px 200px, 150px 150px',
              }} />
          </>
        )}

        {/* ═══ SHIP WHEEL TITLE ═══ */}
        <div className="relative z-20 flex flex-col items-center pt-8 pb-2">
          <div className="relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-20 opacity-30" style={{
              background: `radial-gradient(circle, ${isFreeSpin ? '#6a2aba' : '#8B6520'} 30%, transparent 70%)`,
              borderRadius: '50%',
            }} />
            <div className="relative px-8 py-2" style={{
              background: isFreeSpin
                ? 'linear-gradient(180deg, #6a2aba, #4a1a80, #2d1060)'
                : 'linear-gradient(180deg, #c49540, #a07830, #8B6520)',
              borderRadius: 12,
              border: `3px solid ${isFreeSpin ? '#ffd700' : '#d4a853'}`,
              boxShadow: isFreeSpin
                ? '0 4px 16px rgba(255,215,0,0.3), 0 0 30px rgba(138,43,226,0.3)'
                : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
              <span className="font-black text-xl tracking-wider" style={{
                color: '#fff8e1',
                textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(212,168,83,0.5)',
              }}>
                {isFreeSpin ? '🗺️ FREE SPINS' : '🏴‍☠️ LUCKY WIN'}
              </span>
            </div>
            <div className="absolute -left-4 top-1/2 -translate-y-1/2" style={{
              width: 20, height: 24,
              background: isFreeSpin ? '#4a1a80' : '#8B6520',
              clipPath: 'polygon(100% 0, 100% 100%, 0 50%)',
            }} />
            <div className="absolute -right-4 top-1/2 -translate-y-1/2" style={{
              width: 20, height: 24,
              background: isFreeSpin ? '#4a1a80' : '#8B6520',
              clipPath: 'polygon(0 0, 0 100%, 100% 50%)',
            }} />
          </div>
        </div>

        {/* ═══ MAIN GAME AREA ═══ */}
        <div className="flex flex-col relative z-10 px-3">
          <div className="relative mx-auto w-full" style={{ maxWidth: 380 }}>
            {/* Free Spins HUD Banner */}
            {isFreeSpin && (
              <FreeSpinsBanner
                remaining={freeSpinsRemaining}
                total={freeSpinsTotal}
                totalWin={freeSpinsTotalWin}
                multiplier={currentMultiplier}
              />
            )}

            <Rope side="left" />
            <Rope side="right" />
            <WoodPost side="left" />
            <WoodPost side="right" />

            {/* Main wooden frame */}
            <div className="relative mx-5" style={{
              background: isFreeSpin
                ? 'linear-gradient(180deg, #6a2aba 0%, #4a1a80 3%, #2d1060 6%)'
                : 'linear-gradient(180deg, #8B6520 0%, #a07830 3%, #6b4e18 6%)',
              borderRadius: 12,
              padding: '3px',
              boxShadow: isFreeSpin
                ? '0 8px 32px rgba(138,43,226,0.5), 0 0 0 1px #ffd700'
                : '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #c49540',
            }}>
              {/* Inner border */}
              <div style={{
                background: isFreeSpin
                  ? 'linear-gradient(180deg, #8a3ad0, #6a2aba)'
                  : 'linear-gradient(180deg, #c9a060, #b08530)',
                borderRadius: 10,
                padding: '3px',
                border: `2px solid ${isFreeSpin ? '#4a1a80' : '#8B6520'}`,
              }}>
                {/* Header row */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-t-lg" style={{
                  background: isFreeSpin
                    ? 'linear-gradient(180deg, #1a0a30, #0d0520)'
                    : 'linear-gradient(180deg, #1a3a5c, #0d2240)',
                  border: `1px solid ${isFreeSpin ? '#6a2aba' : '#2a5a8a'}`,
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                }}>
                  <button onClick={() => { setAutoSpin(false); navigate('/slots'); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                    style={{
                      background: isFreeSpin
                        ? 'linear-gradient(135deg, #ffd700, #ff8800)'
                        : 'linear-gradient(135deg, #c49540, #8B6520)',
                      border: `2px solid ${isFreeSpin ? '#cc6600' : '#6b4e18'}`,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}>
                    <ArrowLeft size={16} style={{ color: '#fff8e1' }} />
                  </button>

                  <div className="flex items-center gap-2">
                    <button onClick={() => setMuted(!muted)} className="p-1.5 rounded-full"
                      style={{ background: 'rgba(194,149,64,0.2)', border: '1px solid rgba(194,149,64,0.4)' }}>
                      {muted ? <VolumeX size={13} className="text-white/40" /> : <Volume2 size={13} className="text-yellow-400" />}
                    </button>
                    <PaytableModal
                      gameName="Lucky Win"
                      betAmount={isFreeSpin ? freeSpinsBet : stake}
                      {...LUCKY_WIN_PAYTABLE}
                    />
                    <div className="rounded-full px-3 py-1" style={{
                      background: isFreeSpin
                        ? 'linear-gradient(135deg, #1a0a30, #2d1060)'
                        : 'linear-gradient(135deg, #0d2240, #1a3a5c)',
                      border: `2px solid ${isFreeSpin ? '#ffd700' : '#c49540'}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                      <span className="text-sm font-extrabold" style={{ color: '#ffd700' }}>৳{balance.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Reel area */}
                <div className="p-2 rounded-b-lg relative" style={{
                  background: isFreeSpin
                    ? 'linear-gradient(180deg, #1a0830 0%, #120620 50%, #0a0318 100%)'
                    : 'linear-gradient(180deg, #1a3050 0%, #162840 50%, #0f1e30 100%)',
                }}>
                  {/* 5x3 Grid */}
                  <div className="flex flex-col gap-1.5 overflow-hidden">
                    {Array.from({ length: ROWS }, (_, r) => (
                      <div key={r} className="flex gap-1.5 justify-center">
                        {Array.from({ length: COLS }, (_, c) => {
                          const symIdx = grid[r][c];
                          const sym = SYMBOLS[symIdx];
                          const isWin = winCells.some(([wr, wc]) => wr === r && wc === c);
                          const isScatterCell = sym.id === 'scatter' && isWin;
                          const isLanded = landed[r]?.[c] ?? true;
                          const gemVisible = showGrid && isLanded;
                          return (
                            <motion.div key={`${r}-${c}`}
                              initial={false}
                              animate={
                                spinning
                                  ? { y: [0, -4, 4, -2, 2, 0], opacity: [0.7, 0.4, 0.7, 0.4, 0.7, 0.4], scale: 0.85 }
                                  : !showGrid
                                  ? { y: -120, opacity: 0, scale: 0.5 }
                                  : !isLanded
                                  ? { y: -120, opacity: 0, scale: 0.5 }
                                  : isWin
                                  ? { y: 0, opacity: 1, scale: [1, 1.12, 1] }
                                  : { y: 0, opacity: 1, scale: 1 }
                              }
                              transition={
                                spinning
                                  ? { duration: 0.2, repeat: Infinity, delay: c * 0.04 + r * 0.03 }
                                  : !gemVisible
                                  ? { duration: 0.1 }
                                  : isLanded && !isWin
                                  ? { type: 'spring', stiffness: 600, damping: 12, mass: 0.6, delay: r * 0.04 }
                                  : isWin
                                  ? { duration: 0.8, repeat: Infinity }
                                  : { duration: 0.15 }
                              }
                            >
                              <div className="relative flex items-center justify-center" style={{
                                width: 58, height: 62,
                                background: isScatterCell
                                  ? 'linear-gradient(135deg, #6a2aba, #8a3ad0, #aa4aff)'
                                  : isWin
                                  ? 'linear-gradient(135deg, #2a5a9a, #3a7acc, #4a8aee)'
                                  : isFreeSpin
                                  ? 'linear-gradient(180deg, #2a1050 0%, #3a1870 50%, #2a1050 100%)'
                                  : 'linear-gradient(180deg, #1a4070 0%, #224a80 50%, #1a3868 100%)',
                                borderRadius: 8,
                                border: isScatterCell ? '2px solid #aa4aff' : isWin ? '2px solid #ffd700' : isFreeSpin ? '2px solid #4a2090' : '2px solid #2a5a9a',
                                boxShadow: isScatterCell
                                  ? '0 0 15px rgba(170,74,255,0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
                                  : isWin
                                  ? '0 0 15px rgba(255,215,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                                  : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.2)',
                              }}>
                                <img src={sym.img} alt={sym.id}
                                  className="w-11 h-11 object-contain"
                                  style={{
                                    filter: isScatterCell
                                      ? 'brightness(1.4) drop-shadow(0 0 10px rgba(170,74,255,0.8))'
                                      : isWin
                                      ? 'brightness(1.3) drop-shadow(0 0 8px rgba(255,215,0,0.6))'
                                      : 'none'
                                  }}
                                />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Blast effects on winning cells */}
                  <AnimatePresence>
                    {blastCells.length > 0 && blastCells.map(([r, c]) => {
                      const cellW = 59.5;
                      const cellH = 63.5;
                      const padX = 8;
                      const padY = 8;
                      const cx = padX + c * cellW;
                      const cy = padY + r * cellH;
                      return (
                        <SymbolBlastEffect
                          key={`blast-${r}-${c}`}
                          symbolImg={SYMBOLS[grid[r][c]].img}
                          cellX={cx}
                          cellY={cy}
                        />
                      );
                    })}
                  </AnimatePresence>

                  {/* Win line overlay */}
                  <AnimatePresence>
                    {winCells.length > 0 && !spinning && !animating && (
                      <motion.svg
                        className="absolute inset-0 pointer-events-none z-30"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <defs>
                          <filter id="lw-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                          <linearGradient id="lw-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.9" />
                            <stop offset="50%" stopColor="#fff8e1" stopOpacity="1" />
                            <stop offset="100%" stopColor="#ffd700" stopOpacity="0.9" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const rowGroups: Record<number, number[]> = {};
                          winCells.forEach(([r, c]) => {
                            if (!rowGroups[r]) rowGroups[r] = [];
                            rowGroups[r].push(c);
                          });
                          const lines: React.ReactNode[] = [];
                          const cellW = 59.5;
                          const cellH = 63.5;
                          const padX = 8;
                          const padY = 8;
                          const cx = 29;
                          const cy = 31;

                          Object.entries(rowGroups).forEach(([rStr, cols]) => {
                            if (cols.length >= 3) {
                              cols.sort((a, b) => a - b);
                              const r = Number(rStr);
                              const x1 = padX + cols[0] * cellW + cx;
                              const x2 = padX + cols[cols.length - 1] * cellW + cx;
                              const y = padY + r * cellH + cy;
                              lines.push(
                                <motion.line key={`row-${r}`} x1={x1} y1={y} x2={x2} y2={y}
                                  stroke="url(#lw-grad)" strokeWidth={4} strokeLinecap="round" filter="url(#lw-glow)"
                                  initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: [0.7, 1, 0.7] }}
                                  transition={{ duration: 0.5, opacity: { duration: 1.2, repeat: Infinity } }}
                                />
                              );
                              cols.forEach(c => {
                                lines.push(
                                  <motion.circle key={`dot-${r}-${c}`} cx={padX + c * cellW + cx} cy={y} r={6}
                                    fill="#ffd700" filter="url(#lw-glow)"
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: c * 0.1 }}
                                  />
                                );
                              });
                            }
                          });
                          return lines;
                        })()}
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </div>

                {/* Total Win display */}
                <div className="h-10 flex items-center justify-center" style={{
                  background: isFreeSpin
                    ? 'linear-gradient(180deg, #4a1a80, #6a2aba)'
                    : 'linear-gradient(180deg, #8B0000, #cc0022)',
                  borderRadius: '0 0 8px 8px',
                  borderTop: '2px solid #ffd700',
                }}>
                  <AnimatePresence mode="wait">
                    {lastWin > 0 && !spinning && !animating && (
                      <motion.div key="win" initial={{ scale: 0 }} animate={{ scale: [1, 1.08, 1] }}
                        exit={{ scale: 0 }} transition={{ scale: { duration: 0.6, repeat: 3 } }}
                        className="flex items-center gap-2">
                        <motion.span className="font-extrabold text-sm"
                          style={{ color: '#ffd700' }}
                          animate={{ textShadow: ['0 0 6px rgba(255,215,0,0.4)', '0 0 16px rgba(255,215,0,0.8)', '0 0 6px rgba(255,215,0,0.4)'] }}
                          transition={{ duration: 1.2, repeat: Infinity }}>
                          {isFreeSpin ? (currentMultiplier > 1 ? `🔥 ${currentMultiplier}x WIN` : 'FREE SPIN WIN') : 'TOTAL WIN'}
                        </motion.span>
                        <motion.span className="font-black text-lg" style={{ color: '#fff' }}
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity }}>
                          <WinCountUp target={lastWin} />
                        </motion.span>
                      </motion.div>
                    )}
                    {!spinning && !animating && lastWin === 0 && spinHistory.length > 0 && (
                      <motion.div key="loss" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <span className="font-bold text-sm" style={{ color: '#ffd700', opacity: 0.5 }}>
                          TOTAL WIN ৳0.00
                        </span>
                      </motion.div>
                    )}
                    {(spinning || animating || (lastWin === 0 && spinHistory.length === 0)) && (
                      <span className="font-bold text-sm" style={{ color: '#ffd700', opacity: 0.5 }}>TOTAL WIN ৳0.00</span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Wooden base */}
            <div className="mx-3 -mt-1 relative z-0">
              <div style={{
                height: 12,
                background: isFreeSpin
                  ? 'linear-gradient(180deg, #4a1a80, #2d1060, #1a0a30)'
                  : 'linear-gradient(180deg, #8B6520, #6b4e18, #5a3a18)',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }} />
              <div className="mx-2 mt-0.5" style={{
                height: 8,
                background: isFreeSpin
                  ? 'linear-gradient(180deg, #2d1060, #1a0a30, #0d0520)'
                  : 'linear-gradient(180deg, #6b4e18, #5a3a18, #4a2a10)',
                borderRadius: '0 0 6px 6px',
              }} />
            </div>

            {/* Mascot */}
            {mascot && (
              <motion.img src={mascot} alt="Mascot"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="absolute -top-6 -right-2 z-30 drop-shadow-lg pointer-events-none"
                style={{ width: mascotSize, height: mascotSize, objectFit: 'contain' }}
              />
            )}

            {/* Confetti */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
                {Array.from({ length: 30 }).map((_, i) => (
                  <CoinParticle key={i} delay={i * 0.05} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ CONTROLS ═══ */}
        <SlotControlPanel
          betAmount={isFreeSpin ? freeSpinsBet : stake}
          spinning={spinning || animating || isFreeSpin}
          autoSpin={autoSpin}
          turboMode={turboMode}
          onSpin={spin}
          onAdjustBet={adjustBet}
          onSetBet={(v) => !(spinning || animating || isFreeSpin) && setStake(v)}
          onToggleAuto={() => setAutoSpin(!autoSpin)}
          onToggleTurbo={() => setTurboMode(!turboMode)}
          accentColor={isFreeSpin ? '6a2aba' : 'ff8800'}
          spinLabel={isFreeSpin ? `FREE ${freeSpinsRemaining}` : 'SPIN'}
          spinEmoji={isFreeSpin ? '🗺️' : '🏴‍☠️'}
        />

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

        {/* Big Win Overlay */}
        <BigWinOverlay
          active={showBigWin}
          amount={lastWin}
          type={bigWinType}
          onComplete={() => setShowBigWin(false)}
        />

        <div className="h-20" />
      </div>

      {/* Shimmer animation for free spins intro */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </AuthGate>
  );
};

export default LuckyWinGame;
