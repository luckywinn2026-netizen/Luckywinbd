import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX, Plus, Minus, RotateCcw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';
import FortuneGemsSoundEngine from './FortuneGemsSoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { FORTUNE_GEMS_PAYTABLE } from '@/config/paytableConfigs';
import { outcomeToTier, getTierDisplayLabel, shouldShowFinalWinOverlay, getWinTierFromRatio } from '../slotTierUtils';

// ─── 3D Sphere Gem Definitions ───
const GEM_DEFS = [
  { id: 'blue', colors: ['#4dc9f6', '#2196f3', '#1565c0', '#0d47a1'], highlight: '#b3e5fc' },
  { id: 'red', colors: ['#ff6659', '#e53935', '#b71c1c', '#7f0000'], highlight: '#ffcdd2' },
  { id: 'purple', colors: ['#ce93d8', '#9c27b0', '#6a1b9a', '#4a148c'], highlight: '#e1bee7' },
  { id: 'green', colors: ['#66bb6a', '#2e7d32', '#1b5e20', '#0a3d0a'], highlight: '#c8e6c9' },
  { id: 'star', colors: ['#ffee58', '#ffc107', '#ff8f00', '#e65100'], highlight: '#fff9c4', isStar: true },
];

const ROWS = 3;
const COLS = 5;

// ─── 3D Sphere Gem Component ───
const GemSphere = ({ gem, size = 52, isWin = false }: {
  gem: typeof GEM_DEFS[0]; size?: number; isWin?: boolean;
}) => {
  const [c0, c1, c2, c3] = gem.colors;
  const r = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ground shadow */}
      <div className="absolute" style={{
        bottom: -3, left: '12%', right: '12%', height: size * 0.18,
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
        borderRadius: '50%',
        filter: 'blur(2px)',
      }} />

      {/* Outer glow on win */}
      {isWin && (
        <div className="absolute -inset-1 rounded-full animate-pulse" style={{
          background: `radial-gradient(circle, ${c1}55, transparent 70%)`,
          filter: 'blur(6px)',
        }} />
      )}

      {/* Base sphere - deep shadow layer */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle at 55% 70%, ${c3} 0%, ${c3}00 60%)`,
      }} />

      {/* Main sphere body with realistic light */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `
          radial-gradient(circle at 30% 25%, ${c0}ee 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, ${c1} 0%, ${c2} 55%, ${c3} 100%)
        `,
        boxShadow: isWin
          ? `0 0 24px ${c1}bb, 0 0 48px ${c1}44, inset 0 -${r * 0.25}px ${r * 0.4}px rgba(0,0,0,0.45), inset 0 ${r * 0.12}px ${r * 0.2}px rgba(255,255,255,0.35)`
          : `inset 0 -${r * 0.25}px ${r * 0.4}px rgba(0,0,0,0.45), inset 0 ${r * 0.12}px ${r * 0.2}px rgba(255,255,255,0.35)`,
      }} />

      {/* Equator rim reflection */}
      <div className="absolute rounded-full" style={{
        top: '38%', left: '5%', right: '5%', height: '24%',
        background: `linear-gradient(180deg, transparent 0%, ${c0}33 40%, transparent 100%)`,
        filter: 'blur(2px)',
      }} />

      {/* Primary top highlight - large soft */}
      <div className="absolute rounded-full" style={{
        width: size * 0.55, height: size * 0.35,
        top: '8%', left: '18%',
        background: `radial-gradient(ellipse at 50% 70%, ${gem.highlight}dd, ${gem.highlight}55, transparent)`,
        filter: 'blur(0.5px)',
      }} />

      {/* Sharp specular highlight - small bright */}
      <div className="absolute rounded-full" style={{
        width: size * 0.2, height: size * 0.12,
        top: '14%', left: '26%',
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.95), rgba(255,255,255,0.4), transparent)',
        filter: 'blur(0.5px)',
      }} />

      {/* Tiny pinpoint glint */}
      <div className="absolute rounded-full" style={{
        width: size * 0.08, height: size * 0.06,
        top: '16%', left: '30%',
        background: 'white',
        filter: 'blur(0.3px)',
      }} />

      {/* Bottom rim light (environment reflection) */}
      <div className="absolute rounded-full" style={{
        width: size * 0.6, height: size * 0.15,
        bottom: '8%', left: '20%',
        background: `radial-gradient(ellipse, ${c0}44, transparent)`,
        filter: 'blur(2px)',
      }} />

      {/* Glass-like edge ring */}
      <div className="absolute inset-[1px] rounded-full" style={{
        border: `1px solid ${gem.highlight}33`,
        background: 'transparent',
      }} />

      {/* Star overlay for special gem */}
      {gem.isStar && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{
            fontSize: size * 0.45,
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(255,200,0,0.6))',
          }}>⭐</span>
        </div>
      )}
    </div>
  );
};

// ─── Golden Cell Wrapper ───
const GemCell = ({ children, isWin }: { children: React.ReactNode; isWin: boolean }) => (
  <div className="relative flex items-center justify-center" style={{
    width: 62, height: 62,
    background: isWin
      ? 'linear-gradient(135deg, #fff8e1, #ffe082, #ffd54f)'
      : 'linear-gradient(180deg, #f5e6c8 0%, #e8d5a8 50%, #d4c090 100%)',
    borderRadius: 8,
    border: '2px solid #c9a030',
    boxShadow: isWin
      ? '0 0 15px rgba(255,215,0,0.6), inset 0 1px 0 rgba(255,255,255,0.5)'
      : 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.1)',
  }}>
    {children}
    {/* Gold inner border */}
    <div className="absolute inset-[2px] rounded-[6px] pointer-events-none" style={{
      border: '1px solid rgba(201,160,48,0.3)',
    }} />
  </div>
);

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

// ─── Lantern Component ───
const Lantern = ({ side }: { side: 'left' | 'right' }) => (
  <div className="absolute z-20" style={{
    [side]: -8, top: '15%',
    width: 24, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
  }}>
    {/* Tassel rope */}
    <div className="mx-auto" style={{ width: 2, height: 12, background: '#c9a030' }} />
    {/* Lantern body */}
    <div className="rounded-full mx-auto" style={{
      width: 22, height: 28,
      background: 'radial-gradient(circle at 40% 35%, #ff4444, #cc0000 60%, #8b0000)',
      border: '1.5px solid #ffd700',
      boxShadow: '0 0 10px rgba(255,0,0,0.4)',
    }} />
    {/* Bottom tassel */}
    <div className="mx-auto" style={{ width: 1.5, height: 10, background: '#ffd700' }} />
    <div className="mx-auto rounded-full" style={{ width: 6, height: 6, background: '#ffd700' }} />
  </div>
);

// ─── Red Pillar Component ───
const Pillar = ({ side }: { side: 'left' | 'right' }) => (
  <div className="absolute top-0 bottom-0 z-10" style={{
    [side]: 0, width: 20,
    background: 'linear-gradient(90deg, #5a0000, #aa1111 30%, #cc2222 50%, #aa1111 70%, #5a0000)',
    borderRadius: side === 'left' ? '8px 0 0 8px' : '0 8px 8px 0',
    boxShadow: side === 'left'
      ? 'inset -3px 0 8px rgba(0,0,0,0.3), inset 3px 0 4px rgba(255,100,100,0.2)'
      : 'inset 3px 0 8px rgba(0,0,0,0.3), inset -3px 0 4px rgba(255,100,100,0.2)',
  }}>
    {/* Pillar cap top */}
    <div className="absolute -top-1 left-0 right-0" style={{
      height: 12,
      background: 'linear-gradient(180deg, #ffd700, #c9a030, #8B6914)',
      borderRadius: side === 'left' ? '6px 0 0 0' : '0 6px 0 0',
    }} />
    {/* Pillar base */}
    <div className="absolute -bottom-1 left-0 right-0" style={{
      height: 16,
      background: 'linear-gradient(180deg, #8B6914, #c9a030, #ffd700)',
      borderRadius: side === 'left' ? '0 0 0 6px' : '0 0 6px 0',
    }} />
  </div>
);

// ─── Main Fortune Gems Game ───
const FortuneGemsGame = () => {
  const navigate = useNavigate();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => Math.floor(Math.random() * GEM_DEFS.length))
    )
  );
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [winCells, setWinCells] = useState<[number, number][]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [muted, setMuted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);
  const [finalWinAmount, setFinalWinAmount] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [landed, setLanded] = useState<boolean[][]>(() =>
    Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => true))
  );
  const [showGrid, setShowGrid] = useState(true);

  const soundRef = useRef(new FortuneGemsSoundEngine());
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number }>({ outcome: 'loss', maxWinAmount: 0 });
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);

  const { symbols: customSymbols, mascot, mascotSize, background: customBg } = useGameAssets('fortune-gems');
  useActivePlayer('fortune-gems', 'Lucky Fortune Gems', 'slot', stake);


  useEffect(() => { soundRef.current.setMuted(muted); }, [muted]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const evaluateWin = (g: number[][]) => {
    const cells: [number, number][] = [];
    let baseMult = 0;

    // Check rows for 3+ matching
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 3; c++) {
        if (g[r][c] === g[r][c + 1] && g[r][c + 1] === g[r][c + 2]) {
          let matchLen = 3;
          while (c + matchLen < COLS && g[r][c + matchLen] === g[r][c]) matchLen++;
          for (let m = 0; m < matchLen; m++) {
            if (!cells.some(([cr, cc]) => cr === r && cc === c + m)) {
              cells.push([r, c + m]);
            }
          }
          const gemIdx = g[r][c];
          baseMult += matchLen >= 5 ? 15 : matchLen >= 4 ? 8 : (gemIdx === 4 ? 5 : gemIdx <= 1 ? 4 : 2);
          break;
        }
      }
    }

    // Check columns for 3 matching (full column)
    for (let c = 0; c < COLS; c++) {
      if (g[0][c] === g[1][c] && g[1][c] === g[2][c]) {
        for (let r = 0; r < ROWS; r++) {
          if (!cells.some(([cr, cc]) => cr === r && cc === c)) {
            cells.push([r, c]);
          }
        }
        const gemIdx = g[0][c];
        baseMult += gemIdx === 4 ? 5 : gemIdx <= 1 ? 4 : 2;
      }
    }

    return { cells, baseMult };
  };

  const spin = async () => {
    if (spinning || animating) return;
    if (stake < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (stake > balance) { gameToast.error('Insufficient balance'); return; }

    setSpinning(true);
    setAnimating(true);
    setLastWin(0);
    setWinCells([]);
    setShowConfetti(false);
    setShowGrid(false);
    setLanded(Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false)));
    soundRef.current.playSpinStart();

    const spinStart = Date.now();

    let outcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: stake, game_id: 'fortune-gems', game_name: 'Fortune Gems' });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      setAnimating(false);
      soundRef.current.playLoss();
      return;
    }
    outcomeRef.current = outcome;

    let finalGrid: number[][];
    let winCellsResult: [number, number][] = [];

    if (outcome.outcome === 'loss') {
      // Generate grid with ZERO matches (no row or column triples)
      finalGrid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => Math.floor(Math.random() * GEM_DEFS.length))
      );
      // Break row matches
      for (let r = 0; r < ROWS; r++) {
        for (let c = 2; c < COLS; c++) {
          if (finalGrid[r][c] === finalGrid[r][c - 1] && finalGrid[r][c - 1] === finalGrid[r][c - 2]) {
            finalGrid[r][c] = (finalGrid[r][c] + 1) % GEM_DEFS.length;
          }
        }
      }
      // Break column matches
      for (let c = 0; c < COLS; c++) {
        if (finalGrid[0][c] === finalGrid[1][c] && finalGrid[1][c] === finalGrid[2][c]) {
          finalGrid[2][c] = (finalGrid[2][c] + 1) % GEM_DEFS.length;
        }
      }
    } else {
      // Server says WIN — generate matching grid. Use actual win multiplier to pick gem count
      // and gem type so displayed grid matches paytable (e.g. 0.7x → 3 green gems, not 4)
      const mult = outcome.maxWinAmount / stake;
      let gemCount: number;
      let winGemIdx: number;
      if (mult >= 15) {
        gemCount = 5;
        winGemIdx = 4; // Star — "5× Star gems on payline"
      } else if (mult >= 5) {
        gemCount = Math.random() < 0.5 ? 4 : 5;
        winGemIdx = Math.random() < 0.5 ? 0 : 1; // Blue or Red — high value
      } else if (mult >= 2) {
        gemCount = 4;
        winGemIdx = 2; // Purple — "3–4 matching gems", medium value
      } else {
        gemCount = 3;
        winGemIdx = 3; // Green — "3 low-value gems"
      }

      finalGrid = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => Math.floor(Math.random() * GEM_DEFS.length))
      );
      const winRow = Math.floor(Math.random() * ROWS);
      const startC = Math.floor(Math.random() * (COLS - gemCount + 1));

      for (let c = startC; c < startC + gemCount && c < COLS; c++) {
        finalGrid[winRow][c] = winGemIdx;
        winCellsResult.push([winRow, c]);
      }

      // Break any ACCIDENTAL extra matches in non-win rows/cols
      for (let r = 0; r < ROWS; r++) {
        if (r === winRow) continue;
        for (let c = 2; c < COLS; c++) {
          if (finalGrid[r][c] === finalGrid[r][c - 1] && finalGrid[r][c - 1] === finalGrid[r][c - 2]) {
            finalGrid[r][c] = (finalGrid[r][c] + 1) % GEM_DEFS.length;
          }
        }
      }
      for (let c = 0; c < COLS; c++) {
        const isWinCol = winCellsResult.some(([, cc]) => cc === c) && winCellsResult.filter(([, cc]) => cc === c).length >= 3;
        if (isWinCol) continue;
        if (finalGrid[0][c] === finalGrid[1][c] && finalGrid[1][c] === finalGrid[2][c]) {
          const safeRow = winRow === 2 ? 0 : 2;
          finalGrid[safeRow][c] = (finalGrid[safeRow][c] + 1) % GEM_DEFS.length;
        }
      }
    }

    // Wait minimum spin time
    const elapsed = Date.now() - spinStart;
    const remaining = Math.max(0, 200 - elapsed);
    await new Promise(r => setTimeout(r, remaining));


    setGrid(finalGrid);
    setShowGrid(true);
    setSpinning(false);

    // Cascade landing: column by column with stagger
    for (let c = 0; c < COLS; c++) {
      await new Promise(r => setTimeout(r, 30));
      setLanded(prev => {
        const next = prev.map(row => [...row]);
        for (let r = 0; r < ROWS; r++) next[r][c] = true;
        return next;
      });
    }

    // Small settle delay after last column lands
    await new Promise(r => setTimeout(r, 50));

    // Use server outcome DIRECTLY (like Lucky 777)
    setWinCells(winCellsResult);

    if (outcome.outcome !== 'loss' && outcome.maxWinAmount > 0) {
      const winAmount = Math.round(outcome.maxWinAmount);
      const displayMult = Math.round((winAmount / stake) * 10) / 10;
      applyAuthoritativeBalance(outcome.newBalance);
      setLastWin(winAmount);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 600);
      soundRef.current.playWin(displayMult >= 10);
      const tier = outcomeToTier(outcome.outcome);
      if (shouldShowFinalWinOverlay(tier)) {
        setFinalWinAmount(winAmount);
        // Final win overlay disabled
      }
      setSpinHistory(prev => [{ win: true, amount: winAmount }, ...prev.slice(0, 14)]);
    } else {
      applyAuthoritativeBalance(outcome.newBalance);
      soundRef.current.playLoss();
      setSpinHistory(prev => [{ win: false, amount: stake }, ...prev.slice(0, 14)]);
    }

    setAnimating(false);

    if (autoSpinRef.current) {
      setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
    }
  };

  useEffect(() => { spinRef.current = spin; });
  useEffect(() => { if (autoSpin && !spinning && !animating) spinRef.current(); }, [autoSpin]);

  const adjustBet = (dir: number) => {
    if (spinning || animating) return;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
    const idx = steps.indexOf(stake);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    setStake(steps[newIdx]);
  };

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="💎 Lucky Fortune Gems" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative overflow-hidden" style={{
        background: customBg
          ? `url(${customBg}) center/cover no-repeat`
          : '#8b1a1a',
      }}>
        {/* Red Chinese pattern background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 20%, #b22222 0%, #8b1a1a 40%, #5a0a0a 70%, #3a0505 100%)',
        }} />
        {/* Chinese cloud pattern overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle, rgba(139,26,26,0.6) 0.5px, transparent 0.5px)`,
          backgroundSize: '16px 16px',
          opacity: 0.4,
        }} />

        {/* ═══ TOP ORNATE CROWN/HEADER ═══ */}
        <div className="relative z-20 flex flex-col items-center pt-10">
          {/* Golden ornate crown piece */}
          <div className="relative" style={{ width: '85%', maxWidth: 380 }}>
            {/* Crown shape */}
            <div className="relative mx-auto" style={{
              width: '100%', height: 52,
              background: 'linear-gradient(180deg, #ffd700 0%, #daa520 30%, #b8860b 60%, #8B6914 100%)',
              borderRadius: '20px 20px 0 0',
              border: '2px solid #ffd700',
              borderBottom: 'none',
              boxShadow: '0 -4px 20px rgba(255,215,0,0.3)',
            }}>
              {/* Crown top ornament */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <div style={{
                  width: 28, height: 28,
                  background: 'radial-gradient(circle at 35% 30%, #4dc9f6, #2196f3, #1565c0)',
                  borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
                  border: '2px solid #ffd700',
                  boxShadow: '0 0 12px rgba(33,150,243,0.5)',
                }} />
              </div>
              {/* Curved edges like Chinese roof */}
              <div className="absolute -left-3 -bottom-0" style={{
                width: 30, height: 20,
                background: '#2a1a0a',
                borderRadius: '0 0 0 50%',
                transform: 'rotate(-15deg)',
                boxShadow: 'inset 0 -2px 4px rgba(255,215,0,0.3)',
              }} />
              <div className="absolute -right-3 -bottom-0" style={{
                width: 30, height: 20,
                background: '#2a1a0a',
                borderRadius: '0 0 50% 0',
                transform: 'rotate(15deg)',
                boxShadow: 'inset 0 -2px 4px rgba(255,215,0,0.3)',
              }} />
              {/* Title text */}
              <div className="absolute inset-0 flex items-center justify-center pt-2">
                <span className="font-black text-xl tracking-wider" style={{
                  color: '#3a1500',
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  letterSpacing: '3px',
                }}>FORTUNE GEMS</span>
              </div>
              {/* Golden scrollwork */}
              <div className="absolute bottom-0 left-6 right-6 h-[3px]" style={{
                background: 'linear-gradient(90deg, transparent, #ffd700, #fff8e1, #ffd700, transparent)',
              }} />
            </div>
          </div>
        </div>

        {/* ═══ MAIN GAME AREA ═══ */}
        <div className="flex flex-col relative z-10 px-3">

          {/* ═══ SLOT MACHINE FRAME ═══ */}
          <div className="relative mx-auto w-full" style={{ maxWidth: 370 }}>
            {/* Lanterns */}
            <Lantern side="left" />
            <Lantern side="right" />

            {/* Red pillars */}
            <Pillar side="left" />
            <Pillar side="right" />

            {/* Main frame with golden border */}
            <div className="relative mx-5" style={{
              background: 'linear-gradient(180deg, #ffd700 0%, #c9a030 3%, #8B6914 6%)',
              borderRadius: 12,
              padding: '3px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #ffd700',
            }}>
              {/* Inner golden border */}
              <div style={{
                background: 'linear-gradient(180deg, #f5e6c8, #e8d5a8)',
                borderRadius: 10,
                padding: '3px',
                border: '2px solid #c9a030',
              }}>
                {/* Back + Balance row INSIDE frame */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded-t-lg" style={{
                  background: 'linear-gradient(180deg, #1a1208, #2a1a0a)',
                  border: '1px solid #c9a030',
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                }}>
                  <button onClick={() => { setAutoSpin(false); navigate('/slots'); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                    style={{
                      background: 'linear-gradient(135deg, #ffd700, #c9a030)',
                      border: '2px solid #8B6914',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}>
                    <ArrowLeft size={16} style={{ color: '#3a1500' }} />
                  </button>

                  <div className="flex items-center gap-2">
                    <PaytableModal gameName="Lucky Fortune Gems" betAmount={stake} {...FORTUNE_GEMS_PAYTABLE} />
                    <button onClick={() => setMuted(!muted)} className="p-1.5 rounded-full"
                      style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}>
                      {muted ? <VolumeX size={13} className="text-white/40" /> : <Volume2 size={13} className="text-yellow-400" />}
                    </button>
                    <div className="rounded-full px-3 py-1" style={{
                      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                      border: '2px solid #c9a030',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                      <span className="text-sm font-extrabold" style={{ color: '#ffd700' }}>৳{balance.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Gem grid area */}
                <div className="p-2 rounded-b-lg relative" style={{
                  background: 'linear-gradient(180deg, #f5e6c8 0%, #ede0c0 50%, #e0d0a8 100%)',
                }}>
                  {/* 5x3 Grid */}
                  <div className="flex flex-col gap-1.5 overflow-hidden">
                    {Array.from({ length: ROWS }, (_, r) => (
                      <div key={r} className="flex gap-1.5 justify-center">
                        {Array.from({ length: COLS }, (_, c) => {
                          const gemIdx = grid[r][c];
                          const gem = GEM_DEFS[gemIdx];
                          const isWin = winCells.some(([wr, wc]) => wr === r && wc === c);
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
                                  ? {
                                      type: 'spring',
                                      stiffness: 600,
                                      damping: 12,
                                      mass: 0.6,
                                      delay: r * 0.04,
                                    }
                                  : isWin
                                  ? { duration: 0.8, repeat: Infinity }
                                  : { duration: 0.15 }
                              }
                            >
                              <GemCell isWin={isWin && !spinning}>
                                {customSymbols && customSymbols[gem.id] ? (
                                  <img src={customSymbols[gem.id]} alt={gem.id}
                                    className="w-11 h-11 object-contain"
                                    style={{ filter: isWin ? 'brightness(1.3)' : 'none' }} />
                                ) : (
                                  <GemSphere gem={gem} size={48} isWin={isWin && !spinning} />
                                )}
                              </GemCell>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* ═══ WINNING LINE GLOW OVERLAY ═══ */}
                  <AnimatePresence>
                    {winCells.length > 0 && !spinning && !animating && (
                      <motion.svg
                        className="absolute inset-0 pointer-events-none z-30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <defs>
                          <filter id="glow-line">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.9" />
                            <stop offset="50%" stopColor="#fff8e1" stopOpacity="1" />
                            <stop offset="100%" stopColor="#ffd700" stopOpacity="0.9" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          // Group winCells by row for horizontal lines
                          const rowGroups: Record<number, number[]> = {};
                          winCells.forEach(([r, c]) => {
                            if (!rowGroups[r]) rowGroups[r] = [];
                            rowGroups[r].push(c);
                          });

                          // Also group by column for vertical lines
                          const colGroups: Record<number, number[]> = {};
                          winCells.forEach(([r, c]) => {
                            if (!colGroups[c]) colGroups[c] = [];
                            colGroups[c].push(r);
                          });

                          const lines: React.ReactNode[] = [];
                          const cellW = 63.5; // cell width + gap
                          const cellH = 63.5;
                          const padX = 8; // padding offset
                          const padY = 8;
                          const centerOffset = 31; // half cell

                          // Draw horizontal lines for rows with 3+ matches
                          Object.entries(rowGroups).forEach(([rStr, cols]) => {
                            if (cols.length >= 3) {
                              cols.sort((a, b) => a - b);
                              const r = Number(rStr);
                              const x1 = padX + cols[0] * cellW + centerOffset;
                              const x2 = padX + cols[cols.length - 1] * cellW + centerOffset;
                              const y = padY + r * cellH + centerOffset;
                              lines.push(
                                <motion.line
                                  key={`row-${r}`}
                                  x1={x1} y1={y} x2={x2} y2={y}
                                  stroke="url(#line-grad)"
                                  strokeWidth={4}
                                  strokeLinecap="round"
                                  filter="url(#glow-line)"
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ pathLength: 1, opacity: [0.7, 1, 0.7] }}
                                  transition={{ duration: 0.5, opacity: { duration: 1.2, repeat: Infinity } }}
                                />
                              );
                              // Glow dots at each winning cell
                              cols.forEach((c) => {
                                const cx = padX + c * cellW + centerOffset;
                                lines.push(
                                  <motion.circle
                                    key={`dot-${r}-${c}`}
                                    cx={cx} cy={y} r={6}
                                    fill="#ffd700"
                                    filter="url(#glow-line)"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: c * 0.1 }}
                                  />
                                );
                              });
                            }
                          });

                          // Draw vertical lines for columns with 3 matches
                          Object.entries(colGroups).forEach(([cStr, rows]) => {
                            if (rows.length >= 3) {
                              rows.sort((a, b) => a - b);
                              const c = Number(cStr);
                              const x = padX + c * cellW + centerOffset;
                              const y1 = padY + rows[0] * cellH + centerOffset;
                              const y2 = padY + rows[rows.length - 1] * cellH + centerOffset;
                              lines.push(
                                <motion.line
                                  key={`col-${c}`}
                                  x1={x} y1={y1} x2={x} y2={y2}
                                  stroke="url(#line-grad)"
                                  strokeWidth={4}
                                  strokeLinecap="round"
                                  filter="url(#glow-line)"
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ pathLength: 1, opacity: [0.7, 1, 0.7] }}
                                  transition={{ duration: 0.5, delay: 0.2, opacity: { duration: 1.2, repeat: Infinity } }}
                                />
                              );
                              rows.forEach((r) => {
                                const cy = padY + r * cellH + centerOffset;
                                lines.push(
                                  <motion.circle
                                    key={`vdot-${r}-${c}`}
                                    cx={x} cy={cy} r={6}
                                    fill="#ffd700"
                                    filter="url(#glow-line)"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: r * 0.1 }}
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

                {/* Win/Loss display area */}
                <div className="h-10 flex items-center justify-center" style={{
                  background: 'linear-gradient(180deg, #e8d5a8, #f5e6c8)',
                  borderRadius: '0 0 8px 8px',
                }}>
                  <AnimatePresence mode="wait">
                    {lastWin > 0 && !spinning && !animating && (
                      <motion.div key="win" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="flex items-center gap-2">
                        <span className="font-extrabold text-base" style={{
                          background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                          {(() => {
                            const t = getWinTierFromRatio(lastWin, stake);
                            const lbl = getTierDisplayLabel(t, lastWin, stake).short;
                            return t === 'mega_win' ? `💎 ${lbl}` : t === 'big_win' ? `✨ ${lbl}` : `🎉 ${lbl}`;
                          })()}
                        </span>
                        <span className="font-bold text-base" style={{ color: '#b8860b' }}>
                          + ৳{lastWin.toLocaleString()}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Golden base/steps below frame */}
            <div className="mx-3 -mt-1 relative z-0">
              <div style={{
                height: 12,
                background: 'linear-gradient(180deg, #c9a030, #8B6914, #6b5010)',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }} />
              <div className="mx-2 mt-0.5" style={{
                height: 8,
                background: 'linear-gradient(180deg, #8B6914, #6b5010, #4a3508)',
                borderRadius: '0 0 6px 6px',
              }} />
            </div>

            {/* Mascot from admin */}
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

            {/* Final win overlay (small/medium) — matches Super Ace / Boxing King */}
            <AnimatePresence>
              {showFinalWinOverlay && finalWinAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
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
          </div>

        </div>

        {/* ═══ CONTROLS — Bet | Spin | Turbo | Auto ═══ */}
        <div className="relative z-10 px-4 pb-0 pt-12">
          <div className="flex items-center justify-between gap-2">
            {/* Bet — left */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold uppercase" style={{ color: '#c9a030' }}>BET</span>
              <button onClick={() => adjustBet(-1)} disabled={spinning || animating}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                style={{ background: 'linear-gradient(180deg, #3a2a10, #2a1a08)', border: '2px solid #c9a030' }}>
                <Minus size={14} style={{ color: '#ffd700' }} />
              </button>
              <div className="min-w-[70px] py-1.5 px-2 rounded-lg text-center shrink-0" style={{
                background: 'linear-gradient(180deg, #2a1a08, #1a0e04)',
                border: '2px solid #c9a030',
              }}>
                <span className="font-extrabold text-base" style={{ color: '#ffd700' }}>৳{stake}</span>
              </div>
              <button onClick={() => adjustBet(1)} disabled={spinning || animating}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-30"
                style={{ background: 'linear-gradient(180deg, #3a2a10, #2a1a08)', border: '2px solid #c9a030' }}>
                <Plus size={14} style={{ color: '#ffd700' }} />
              </button>
            </div>
            {/* Spin — center */}
            <button onClick={spin} disabled={spinning || animating}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-extrabold text-xs tracking-wider active:scale-[0.97] disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-1 shrink-0"
              style={{
                background: 'linear-gradient(180deg, #ffe566 0%, #ffd700 20%, #daa520 50%, #b8860b 80%, #8B6914 100%)',
                boxShadow: (spinning || animating) ? 'none' : '0 4px 20px rgba(255,215,0,0.4), inset 0 2px 0 rgba(255,255,255,0.4), 0 0 0 2px #8B6914',
                color: '#3a1500',
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                border: '2px solid #ffd700',
              }}
            >
              💎 <span>SPIN</span>
            </button>
            {/* Turbo | Auto — right */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setTurboMode(!turboMode)}
                className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider"
                style={{
                  background: turboMode ? 'linear-gradient(135deg, #ffd700, #ff8800)' : 'linear-gradient(180deg, #3a2a10, #2a1a08)',
                  border: `2px solid ${turboMode ? '#ffd700' : '#c9a030'}`,
                  color: turboMode ? '#1a0800' : '#c9a030',
                }}
              >
                <Zap size={10} className="inline mr-1" />TURBO
              </button>
              <button onClick={() => setAutoSpin(!autoSpin)}
                className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider"
                style={{
                  background: autoSpin ? 'linear-gradient(135deg, #ffd700, #ff8800)' : 'linear-gradient(180deg, #3a2a10, #2a1a08)',
                  border: `2px solid ${autoSpin ? '#ffd700' : '#c9a030'}`,
                  color: autoSpin ? '#1a0800' : '#c9a030',
                }}
              >
                <RotateCcw size={10} className="inline mr-1" />{autoSpin ? 'STOP' : 'AUTO'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom spacer for mobile nav */}
        <div className="h-20" />
      </div>
    </AuthGate>
  );
};

export default FortuneGemsGame;
