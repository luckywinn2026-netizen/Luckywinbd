import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';
import PaytableModal from '@/components/PaytableModal';
import { SUPER_ACE_PAYTABLE } from '@/config/paytableConfigs';
import BigWinOverlay from '@/components/BigWinOverlay';

import { sfx } from './engine/SoundEngine';

import scatterImg from './assets/scatter.png';
import jokerImg from './assets/joker.png';

// ─── CSS Symbol Renderer (no images, instant render, JILI Super Ace style) ───
const SYMBOL_STYLES: Record<string, { char: string; color: string; bg: string; shadow: string; rank?: string }> = {
  spade:   { char: '♠', color: 'hsl(220, 20%, 15%)',  bg: 'linear-gradient(160deg, hsl(220, 15%, 95%) 0%, hsl(220, 12%, 82%) 100%)', shadow: '0 2px 6px hsla(220, 20%, 15%, 0.3)', rank: '2' },
  heart:   { char: '♥', color: 'hsl(0, 80%, 48%)',    bg: 'linear-gradient(160deg, hsl(0, 70%, 96%) 0%, hsl(0, 55%, 85%) 100%)', shadow: '0 2px 6px hsla(0, 80%, 48%, 0.3)', rank: '3' },
  diamond: { char: '♦', color: 'hsl(210, 85%, 48%)',  bg: 'linear-gradient(160deg, hsl(210, 75%, 95%) 0%, hsl(210, 60%, 83%) 100%)', shadow: '0 2px 6px hsla(210, 85%, 48%, 0.3)', rank: '4' },
  club:    { char: '♣', color: 'hsl(145, 55%, 28%)',  bg: 'linear-gradient(160deg, hsl(145, 45%, 94%) 0%, hsl(145, 38%, 82%) 100%)', shadow: '0 2px 6px hsla(145, 55%, 28%, 0.3)', rank: '5' },
  ace:     { char: 'A',  color: 'hsl(45, 95%, 40%)',   bg: 'linear-gradient(160deg, hsl(45, 85%, 95%) 0%, hsl(42, 75%, 72%) 100%)', shadow: '0 2px 8px hsla(45, 90%, 40%, 0.4)' },
  king:    { char: 'K',  color: 'hsl(280, 65%, 42%)',  bg: 'linear-gradient(160deg, hsl(280, 55%, 94%) 0%, hsl(280, 48%, 78%) 100%)', shadow: '0 2px 6px hsla(280, 65%, 42%, 0.3)' },
  queen:   { char: 'Q',  color: 'hsl(330, 65%, 48%)',  bg: 'linear-gradient(160deg, hsl(330, 55%, 95%) 0%, hsl(330, 48%, 80%) 100%)', shadow: '0 2px 6px hsla(330, 65%, 48%, 0.3)' },
  jack:    { char: 'J',  color: 'hsl(200, 65%, 38%)',  bg: 'linear-gradient(160deg, hsl(200, 55%, 94%) 0%, hsl(200, 48%, 78%) 100%)', shadow: '0 2px 6px hsla(200, 65%, 38%, 0.3)' },
  scatter: { char: '⭐', color: 'hsl(45, 100%, 50%)',  bg: 'linear-gradient(145deg, hsl(30, 95%, 52%), hsl(45, 100%, 48%), hsl(55, 90%, 50%))', shadow: '0 0 12px hsla(45, 100%, 50%, 0.6)' },
  joker:   { char: '🃏', color: 'hsl(0, 0%, 100%)',    bg: 'linear-gradient(145deg, hsl(280, 85%, 52%), hsl(320, 90%, 48%), hsl(350, 85%, 52%))', shadow: '0 0 12px hsla(300, 80%, 50%, 0.5)' },
};

const SUIT_FOR_CARD: Record<string, { suit: string; suitColor: string }> = {
  ace:   { suit: '♠', suitColor: 'hsl(220, 20%, 25%)' },
  king:  { suit: '♥', suitColor: 'hsl(0, 80%, 48%)' },
  queen: { suit: '♦', suitColor: 'hsl(210, 85%, 48%)' },
  jack:  { suit: '♣', suitColor: 'hsl(145, 55%, 30%)' },
};

const CSSSymbol = ({ sym }: { sym: SimpleSymbol }) => {
  const style = SYMBOL_STYLES[sym.id] || SYMBOL_STYLES.spade;
  const isSpecial = sym.id === 'scatter' || sym.id === 'joker';
  const isScatter = sym.id === 'scatter';
  const isJoker = sym.id === 'joker';
  const isSuit = ['spade', 'heart', 'diamond', 'club'].includes(sym.id);
  const isCard = ['ace', 'king', 'queen', 'jack'].includes(sym.id);
  const cardSuit = isCard ? SUIT_FOR_CARD[sym.id] : null;

  // Corner label styles
  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    fontSize: 'clamp(0.6rem, 3vw, 0.95rem)',
    fontWeight: 700,
    fontFamily: "'Georgia', serif",
    lineHeight: 1.1,
    opacity: 0.9,
    zIndex: 1,
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center select-none"
      style={{
        background: isSpecial ? style.bg : 'transparent',
        borderRadius: '4px',
        animation: isSpecial ? 'specialGlow 2s ease-in-out infinite' : undefined,
        boxShadow: isScatter
          ? '0 0 15px hsla(45, 100%, 50%, 0.5), inset 0 0 15px hsla(45, 100%, 60%, 0.15)'
          : isJoker
            ? '0 0 15px hsla(300, 80%, 50%, 0.5), inset 0 0 15px hsla(300, 80%, 60%, 0.15)'
            : undefined,
      }}>
      {/* Corner rank + suit for suit symbols (like real cards) */}
      {isSuit && style.rank && (
        <>
          <span style={{ ...cornerStyle, top: '3px', left: '4px', color: style.color }}>
            {style.rank}<br/><span style={{ fontSize: '0.9em' }}>{style.char}</span>
          </span>
          <span style={{ ...cornerStyle, bottom: '3px', right: '4px', color: style.color, transform: 'rotate(180deg)' }}>
            {style.rank}<br/><span style={{ fontSize: '0.9em' }}>{style.char}</span>
          </span>
        </>
      )}
      {/* Corner suit for card rank symbols (A/K/Q/J) */}
      {isCard && cardSuit && (
        <>
          <span style={{ ...cornerStyle, top: '3px', left: '4px', color: cardSuit.suitColor }}>
            {style.char}<br/><span style={{ fontSize: '0.9em' }}>{cardSuit.suit}</span>
          </span>
          <span style={{ ...cornerStyle, bottom: '3px', right: '4px', color: cardSuit.suitColor, transform: 'rotate(180deg)' }}>
            {style.char}<br/><span style={{ fontSize: '0.9em' }}>{cardSuit.suit}</span>
          </span>
        </>
      )}
      {/* Glow ring behind special symbols */}
      {isSpecial && (
        <div style={{
          position: 'absolute',
          inset: '-2px',
          borderRadius: '6px',
          background: isScatter
            ? 'linear-gradient(135deg, hsla(45, 100%, 60%, 0.4), transparent, hsla(45, 100%, 60%, 0.4))'
            : 'linear-gradient(135deg, hsla(300, 80%, 60%, 0.4), transparent, hsla(300, 80%, 60%, 0.4))',
          animation: 'glowRotate 3s linear infinite',
          zIndex: 0,
        }} />
      )}
      {/* Scatter uses actual image */}
      {(isScatter || isJoker) ? (
        <img
          src={isScatter ? scatterImg : jokerImg}
          alt={isScatter ? 'Scatter' : 'Wild'}
          style={{
            width: '90%',
            height: '90%',
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))',
            animation: 'symbolPulse 1.5s ease-in-out infinite',
          }}
          draggable={false}
        />
      ) : (
        <span style={{
          fontSize: isCard ? 'clamp(2.2rem, 12vw, 3.8rem)' : 'clamp(2.5rem, 13vw, 4.2rem)',
          fontWeight: isCard ? 800 : 900,
          fontFamily: isCard ? "'Georgia', 'Times New Roman', serif" : 'inherit',
          color: style.color,
          textShadow: `0 2px 3px rgba(0,0,0,0.2), ${style.shadow}`,
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
        }}>{style.char}</span>
      )}
    </div>
  );
};

// Inject keyframes for special symbol animations (module-level, runs once)
if (typeof document !== 'undefined' && !document.getElementById('super-ace-special-anims')) {
  const s = document.createElement('style');
  s.id = 'super-ace-special-anims';
  s.textContent = `
    @keyframes specialGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.15)} }
    @keyframes symbolPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
    @keyframes glowRotate { 0%{transform:rotate(0deg);opacity:.6} 50%{opacity:1} 100%{transform:rotate(360deg);opacity:.6} }
  `;
  document.head.appendChild(s);
}

// ─── Types (matching backend response) ───
interface SimpleSymbol {
  id: string;
  isWild: boolean;
  isScatter: boolean;
  isGolden: boolean;
}

interface CascadeStep {
  grid: SimpleSymbol[][];
  winPositions: string[];
  cascadePayout: number;
  multiplier: number;
  goldenConversions: string[];
}

interface SpinResponse {
  initialGrid: SimpleSymbol[][];
  goldenPositions: string[];
  scatterPositions: string[];
  cascadeSteps: CascadeStep[];
  finalGrid?: SimpleSymbol[][];
  totalWin: number;
  newBalance: number;
  winTier?: string;
  freeSpins: {
    triggered: boolean;
    remaining: number;
    sessionId: string | null;
  };
}

const ROWS = 4, COLS = 5;

// ─── Default grid for initial display ───
const defaultSymbol = (): SimpleSymbol => ({
  id: ['spade', 'heart', 'diamond', 'club', 'jack', 'queen', 'king', 'ace'][Math.floor(Math.random() * 8)],
  isWild: false, isScatter: false, isGolden: false,
});

const defaultGrid = (): SimpleSymbol[][] =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, defaultSymbol));

// ─── Spinning Icon Component (top-to-bottom flow) ───
const SpinningIcon = ({
  finalSym, spinning, colIndex, rowIndex, turbo,
}: {
  finalSym: SimpleSymbol; spinning: boolean; colIndex: number; rowIndex: number;
  turbo: boolean;
}) => {
  const [displaySym, setDisplaySym] = useState<SimpleSymbol>(finalSym);
  const [animState, setAnimState] = useState<'idle' | 'cycling' | 'landed'>('idle');
  const finalRef = useRef<SimpleSymbol>(finalSym);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { finalRef.current = finalSym; }, [finalSym]);

  // When finalSym changes (cascade only): sync only when idle and symbol id differs — never overwrite after landing
  useEffect(() => {
    finalRef.current = finalSym;
    if (animState === 'idle') {
      setDisplaySym(prev => (prev?.id !== finalSym?.id ? finalSym : prev));
    }
  }, [finalSym, animState]);

  useEffect(() => {
    if (spinning) {
      // Clear previous timers
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      const colDelay = colIndex * (turbo ? 25 : 50);
      const spinDuration = (turbo ? 40 : 80) + colIndex * (turbo ? 15 : 30);

      // Start cycling after column delay
      const t1 = setTimeout(() => {
        setAnimState('cycling');
      }, colDelay);

      // Land after spin duration
      const t2 = setTimeout(() => {
        setDisplaySym(finalRef.current);
        setAnimState('landed');
        sfx.reelStop(colIndex);
      }, colDelay + spinDuration);

      timersRef.current = [t1, t2];

      return () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    } else {
      // Spin stopped — lock final symbol, no further changes
      setDisplaySym(finalRef.current);
      setAnimState('idle');
    }
  }, [spinning, colIndex, turbo]);

  // Cycling random symbols
  useEffect(() => {
    if (animState !== 'cycling') return;
    const interval = turbo ? 35 : 50;
    const timer = setInterval(() => {
      setDisplaySym(defaultSymbol());
    }, interval);
    return () => clearInterval(timer);
  }, [animState, turbo]);

  // Animation values — smooth card fall (no harsh bounce)
  const animate = animState === 'cycling'
    ? { y: ['-60%', '60%'], opacity: [0.3, 0.8, 0.3], scale: 0.9 }
    : animState === 'landed'
      ? { y: ['-100%', '0%'], opacity: [0.6, 1], scale: 1 }
      : { y: '0%', opacity: 1, scale: 1 };

  const transition: any = animState === 'cycling'
    ? { duration: turbo ? 0.06 : 0.09, repeat: Infinity, ease: 'linear' as const }
    : animState === 'landed'
      ? { duration: turbo ? 0.08 : 0.12, ease: [0.25, 0.46, 0.45, 0.94] as const, delay: rowIndex * 0.008 }
      : { duration: 0 };

  return (
    <motion.div
      className="absolute inset-0 w-full h-full p-[2px]"
      initial={false}
      animate={animate}
      transition={transition}
    >
      <CSSSymbol sym={displaySym} />
    </motion.div>
  );
};

// ─── Particle Effect ───
const WinParticles = ({ active }: { active: boolean }) => {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 1 + Math.random() * 1.5, size: 3 + Math.random() * 5,
    color: ['hsl(45,90%,60%)', 'hsl(35,85%,50%)', 'hsl(25,80%,55%)', 'hsl(0,0%,100%)'][Math.floor(Math.random() * 4)],
  })), []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {particles.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, bottom: 0, width: p.size, height: p.size, background: p.color }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: -400, opacity: [1, 1, 0], x: [0, (Math.random() - 0.5) * 60] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }} />
      ))}
    </div>
  );
};

// ─── Main Component (UI Only — all logic is backend) ───
const SuperAceGame = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const { symbols: customSymbols, background: customBg, backgroundZoom, music: customMusic, loading: assetsLoading } = useGameAssets('super-ace');

  // No image merging needed — CSS symbols are used

  const musicRef = useRef<HTMLAudioElement | null>(null);

  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<SimpleSymbol[][]>(defaultGrid);
  const [spinning, setSpinning] = useState(false);
  const [reelsSpinning, setReelsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [winPositions, setWinPositions] = useState<Set<string>>(new Set());
  const [goldenPositions, setGoldenPositions] = useState<Set<string>>(new Set());
  const [scatterPositions, setScatterPositions] = useState<Set<string>>(new Set());
  const [multiplier, setMultiplier] = useState(1);
  const [cascadeCount, setCascadeCount] = useState(0);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinMode, setFreeSpinMode] = useState(false);
  const [showFreeSpin, setShowFreeSpin] = useState(false);
  const [winTier, setWinTier] = useState<'none' | 'small' | 'medium' | 'bigwin' | 'megawin'>('none');
  const [showParticles, setShowParticles] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [turboMode, setTurboMode] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showTotalWinOverlay, setShowTotalWinOverlay] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);

  const autoSpinRef = useRef(false);
  const spinningRef = useRef(false);

  const [splashAnimDone, setSplashAnimDone] = useState(false);
  const handleLoadingComplete = useCallback(() => setSplashAnimDone(true), []);

  // Only hide splash when both animation is done AND assets are loaded
  useEffect(() => {
    if (splashAnimDone && !assetsLoading) {
      setShowSplash(false);
    }
  }, [splashAnimDone, assetsLoading]);
  useActivePlayer('super-ace', 'Lucky Super Ace', 'slot', stake);

  // No image preloading needed — CSS symbols are instant

  useEffect(() => { sfx.muted = muted; }, [muted]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  // Custom music playback
  useEffect(() => {
    if (customMusic && !muted) {
      const audio = new Audio(customMusic);
      audio.loop = true;
      audio.volume = 0.3;
      audio.play().catch(() => {});
      musicRef.current = audio;
      return () => { audio.pause(); musicRef.current = null; };
    } else if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current = null;
    }
  }, [customMusic, muted]);

  const BASE_MULTIPLIERS = [1, 2, 3, 5];
  const FREE_MULTIPLIERS = [2, 4, 6, 10];
  const currentMultipliers = freeSpinMode ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;

  // Check for existing free spin session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('super_ace_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle();
      if (data && data.spins_remaining > 0) {
        setFreeSpinMode(true);
        setFreeSpinsRemaining(data.spins_remaining);
      }
    };
    checkSession();
  }, []);

  // ─── Perform Spin (calls backend) ───
  const performSpin = useCallback(async () => {
    if (spinningRef.current) return;

    // Low balance check — prevent spin if balance < stake
    if (balance < stake) {
      gameToast.error(`Low balance! You have ৳${balance.toLocaleString()} but bet is ৳${stake.toLocaleString()}. Please deposit or reduce bet.`);
      return;
    }

    spinningRef.current = true;

    sfx.spinStart();
    setSpinning(true);
    setLastWin(0);
    setTotalWin(0);
    setWinPositions(new Set());
    setScatterPositions(new Set());
    setCascadeCount(0);
    setMultiplier(1);
    setWinTier('none');
    setShowParticles(false);
    setShowTotalWinOverlay(false);

    try {
      let data: Awaited<ReturnType<typeof api.superAceSpin>>;
      try {
        data = await api.superAceSpin({ bet: stake });
      } catch (e: unknown) {
        gameToast.error((e as Error)?.message || 'Spin failed');
        setSpinning(false);
        setReelsSpinning(false);
        spinningRef.current = false;
        return;
      }
      if (data?.error) {
        gameToast.error(data.error || 'Spin failed');
        setSpinning(false);
        setReelsSpinning(false);
        spinningRef.current = false;
        return;
      }
      const result = data as SpinResponse;

      // API asar por grid set, tarpor spin — jate land holei notun icon dekhabe, ager spin er icon na
      const finalGridToUse = result.finalGrid ?? (result.cascadeSteps.length > 0 ? result.cascadeSteps[result.cascadeSteps.length - 1].grid : result.initialGrid);
      setGrid(finalGridToUse);
      setGoldenPositions(new Set(result.goldenPositions));
      setReelsSpinning(true);

      // Fall complete hole tokhon spinning=false
      const spinTime = turboMode ? 400 : 550;
      await new Promise(r => setTimeout(r, spinTime));
      setReelsSpinning(false);

      // Show scatters
      if (result.scatterPositions.length >= 3) {
        sfx.scatter();
        setScatterPositions(new Set(result.scatterPositions));
      }

      // If no wins at all, instantly finish — no delays
      if (result.cascadeSteps.length === 0 && result.totalWin === 0) {
        setTotalWin(0);
        if (result.newBalance != null) applyAuthoritativeBalance(result.newBalance);
        else refreshBalance();
        setSpinning(false);
        spinningRef.current = false;
        if (autoSpinRef.current || freeSpinMode) {
          setTimeout(() => performSpin(), freeSpinMode ? 150 : 80);
        }
        return;
      }

      const delay = turboMode ? 30 : 120;
      if (result.cascadeSteps.length > 0) {
        await new Promise(r => setTimeout(r, delay));
      }

      // Cascade win animation — show matching grid per step, fling winning symbols
      for (let i = 0; i < result.cascadeSteps.length; i++) {
        const step = result.cascadeSteps[i];

        setGrid(step.grid);
        setWinPositions(new Set(step.winPositions));
        setMultiplier(step.multiplier);
        setLastWin(step.cascadePayout);
        setTotalWin(result.cascadeSteps.slice(0, i + 1).reduce((s, c) => s + c.cascadePayout, 0));
        setShowParticles(true);
        setCascadeCount(i);

        if (step.cascadePayout >= stake * 5) {
          sfx.winBig();
        } else {
          sfx.winSmall();
        }

        await new Promise(r => setTimeout(r, turboMode ? 120 : 420));

        sfx.cascade();
        setWinPositions(new Set());
        setShowParticles(false);

        await new Promise(r => setTimeout(r, delay));
      }

      setGrid(finalGridToUse);

      // Set total win
      setTotalWin(result.totalWin);

      // Tiered win celebration — Small Win / Medium / Big / Mega (4 tiers)
      const tier = result.winTier ?? (result.totalWin >= stake * 20 ? 'mega_win' : result.totalWin >= stake * 10 ? 'big_win' : result.totalWin >= stake * 5 ? 'medium_win' : result.totalWin > 0 ? 'small_win' : 'loss');
      const frontendTier = tier === 'mega_win' ? 'megawin' : tier === 'big_win' ? 'bigwin' : tier === 'medium_win' ? 'medium' : tier === 'small_win' ? 'small' : 'none';
      setWinTier(frontendTier);

      // Total payout overlay (flaming + Money Coming style) — only for Big Win and Mega Win
      if (tier === 'big_win' || tier === 'mega_win') {
        setShowTotalWinOverlay(true);
      } else if (tier === 'small_win' || tier === 'medium_win') {
        // Final win overlay disabled
      }
      if (frontendTier === 'megawin') {
        sfx.winMega();
        setTimeout(() => setWinTier('none'), 5000);
      } else if (frontendTier === 'bigwin') {
        sfx.winBig();
        setTimeout(() => setWinTier('none'), 5000);
      } else if (frontendTier === 'medium') {
        sfx.winBig();
        setTimeout(() => setWinTier('none'), 900);
      } else if (frontendTier === 'small') {
        setTimeout(() => setWinTier('none'), 600);
      }

      // Free spins
      if (result.freeSpins.triggered) {
        sfx.freeSpinTrigger();
        setFreeSpinMode(true);
        setFreeSpinsRemaining(result.freeSpins.remaining);
        setShowFreeSpin(true);
        setTimeout(() => setShowFreeSpin(false), 1200);
      } else {
        setFreeSpinsRemaining(result.freeSpins.remaining);
        if (result.freeSpins.remaining <= 0) {
          setFreeSpinMode(false);
        }
      }

      // Update balance from backend (use server value for instant consistency)
      if (result.newBalance != null) applyAuthoritativeBalance(result.newBalance);
      else refreshBalance();

    } catch (err) {
      console.error('Spin error:', err);
      gameToast.error('Connection error. Please try again.');
    }

    setSpinning(false);
    spinningRef.current = false;

    // Auto-spin or free spin continuation
    if (autoSpinRef.current || freeSpinMode) {
      setTimeout(() => performSpin(), freeSpinMode ? 150 : 80);
    }
  }, [stake, turboMode, freeSpinMode, refreshBalance, applyAuthoritativeBalance, balance]);

  // Auto-trigger free spins
  useEffect(() => {
    if (freeSpinMode && freeSpinsRemaining > 0 && !spinningRef.current && !showSplash) {
      const t = setTimeout(() => performSpin(), 400);
      return () => clearTimeout(t);
    }
  }, [freeSpinMode, freeSpinsRemaining, performSpin, showSplash]);

  const stakeOptions = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

  return (
    <AuthGate>
      <GameLoadingScreen
        show={showSplash}
        gameName="🂡 Lucky Super Ace"
        onComplete={handleLoadingComplete}
        preloadImages={[]}
      />

      <div className="min-h-screen flex flex-col relative" style={{ background: 'linear-gradient(180deg, hsl(75, 40%, 55%) 0%, hsl(80, 35%, 45%) 30%, hsl(75, 30%, 38%) 100%)' }}>
        {/* Custom Background */}
        {customBg && (
          <div className="absolute inset-0 z-0 pointer-events-none" style={{
            backgroundImage: `url(${customBg})`,
            backgroundSize: backgroundZoom !== 100 ? `${backgroundZoom}%` : '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.35,
          }} />
        )}

        {/* JILI Header — Dark Wood Panel */}
        <div className="relative z-10" style={{
          background: 'linear-gradient(180deg, hsl(15, 35%, 28%) 0%, hsl(12, 40%, 18%) 50%, hsl(10, 35%, 14%) 100%)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 hsla(20, 30%, 40%, 0.4)',
          borderBottom: '2px solid hsl(25, 40%, 22%)',
        }}>
          {/* Nav row */}
          <div className="flex items-center gap-2 px-3 py-1">
            <button onClick={() => navigate('/slots')} className="p-1.5">
              <ArrowLeft size={18} style={{ color: 'hsl(35, 50%, 60%)' }} />
            </button>
            <div className="flex-1" />
            <PaytableModal gameName="Lucky Super Ace" betAmount={stake} {...SUPER_ACE_PAYTABLE} />
            <button onClick={() => setMuted(!muted)} className="p-1.5">
              {muted ? <VolumeX size={16} style={{ color: 'hsl(35, 20%, 50%)' }} /> : <Volume2 size={16} style={{ color: 'hsl(35, 50%, 60%)' }} />}
            </button>
          </div>

          {/* SuperAce Title — Red/Gold 3D plate */}
          <div className="text-center pb-2 -mt-1">
            <div className="inline-block relative px-6 py-1 rounded-lg" style={{
              background: 'linear-gradient(180deg, hsl(15, 30%, 22%), hsl(10, 25%, 16%))',
              border: '1.5px solid hsl(25, 35%, 30%)',
              boxShadow: 'inset 0 1px 0 hsla(30, 30%, 35%, 0.5), 0 2px 4px rgba(0,0,0,0.4)',
            }}>
              <h1 className="font-heading font-extrabold text-xl tracking-wider italic" style={{
                background: 'linear-gradient(180deg, hsl(0, 75%, 55%) 0%, hsl(5, 80%, 45%) 40%, hsl(35, 85%, 55%) 80%, hsl(45, 90%, 65%) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
              }}>
                SuperAce
              </h1>
            </div>
          </div>
        </div>

        {/* JILI Multiplier Bar — Brown with gold tabs */}
        <div className="px-3 mb-1 relative z-10">
          <div className="rounded-lg overflow-hidden" style={{
            background: 'linear-gradient(180deg, hsl(20, 40%, 25%), hsl(15, 35%, 18%), hsl(20, 40%, 25%))',
            border: '1.5px solid hsl(25, 40%, 28%)',
            boxShadow: 'inset 0 1px 0 hsla(30, 40%, 35%, 0.4), 0 2px 6px rgba(0,0,0,0.5)',
          }}>
            {freeSpinMode && (
              <motion.div className="text-center py-0.5" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <span className="text-[10px] font-heading" style={{ color: 'hsl(45, 60%, 55%)' }}>FREE SPIN</span>
                <span className="ml-2 text-base font-heading font-extrabold" style={{ color: 'hsl(45, 90%, 65%)' }}>{freeSpinsRemaining}</span>
              </motion.div>
            )}
            <div className="flex justify-center gap-1.5 px-3 py-1.5">
              {currentMultipliers.map((m, i) => {
                const isActive = currentMultipliers[i] === multiplier && (lastWin > 0 || totalWin > 0);
                return (
                  <motion.div key={m}
                    className="px-4 py-1 rounded text-xs font-heading font-extrabold transition-all"
                    style={isActive ? {
                      background: 'linear-gradient(180deg, hsl(40, 85%, 55%), hsl(30, 80%, 40%))',
                      color: 'hsl(30, 90%, 15%)',
                      boxShadow: '0 0 8px hsla(40, 80%, 50%, 0.5), inset 0 1px 0 hsla(45, 90%, 70%, 0.5)',
                      border: '2px solid hsl(0, 85%, 50%)',
                    } : {
                      background: 'linear-gradient(180deg, hsl(25, 30%, 22%), hsl(20, 25%, 16%))',
                      color: 'hsl(35, 30%, 50%)',
                      border: '1px solid hsla(30, 30%, 30%, 0.5)',
                    }}
                    animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                    transition={isActive ? { duration: 0.4 } : {}}>
                    x{m}
                  </motion.div>
                );
              })}
            </div>
            <p className="text-center text-[9px] font-heading pb-1" style={{ color: 'hsl(35, 25%, 45%)' }}>
              multiplier reward in Free Game.
            </p>
          </div>
        </div>

        {/* Game Grid — JILI Style with Dark Wooden Frame */}
        <div className="px-1.5 pb-1 flex-1 flex items-center justify-center relative z-10">
        {/* Outer wooden frame */}
        <div className="rounded-xl p-[6px] relative overflow-hidden w-full max-w-[min(95vw,480px)] mx-auto"
            style={{
              background: 'linear-gradient(180deg, hsl(20, 40%, 30%) 0%, hsl(15, 35%, 20%) 10%, hsl(10, 30%, 14%) 50%, hsl(15, 35%, 20%) 90%, hsl(20, 40%, 30%) 100%)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.7), inset 0 1px 0 hsla(25, 35%, 38%, 0.5), inset 0 -1px 0 hsla(10, 25%, 10%, 0.8)',
              border: '1px solid hsl(25, 35%, 25%)',
            }}>
            {/* Inner frame bevel */}
            <div className="rounded-lg p-[3px] w-full" style={{
              background: 'linear-gradient(180deg, hsl(10, 25%, 10%), hsl(15, 20%, 8%))',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 0 hsla(20, 25%, 18%, 0.3)',
            }}>
            {/* Teal felt area */}
            <div className="rounded-md p-[2px] w-full" style={{
              background: 'hsl(195, 30%, 20%)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.6)',
            }}>
            <div className="rounded relative overflow-hidden w-full" style={{
              background: 'linear-gradient(180deg, hsl(195, 28%, 24%), hsl(200, 30%, 20%), hsl(195, 25%, 17%))',
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.45)' }} />
            <WinParticles active={showParticles} />

            {/* Column divider clips */}
            <div className="absolute top-0 left-0 right-0 z-20 flex pointer-events-none">
              {Array.from({ length: COLS - 1 }, (_, i) => (
                <div key={i} className="absolute" style={{
                  left: `${((i + 1) / COLS) * 100}%`,
                  transform: 'translateX(-50%)',
                  width: '8px',
                  height: '5px',
                  background: 'linear-gradient(180deg, hsl(15, 25%, 16%), hsl(10, 20%, 10%))',
                  borderRadius: '0 0 2px 2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }} />
              ))}
            </div>

            <div className="grid grid-cols-5 gap-0 relative z-10">
              {Array.from({ length: COLS }, (_, ci) => {
                const colSymbols = grid.map(row => row[ci]);
                return (
                  <div key={ci} className="flex flex-col gap-[2px] relative" style={{
                    borderRight: ci < COLS - 1 ? '1px solid hsla(195, 20%, 28%, 0.5)' : 'none',
                    padding: '3px 1.5px',
                  }}>
                    {colSymbols.map((sym, ri) => {
                      const posKey = `${ri}-${ci}`;
                      const isWin = winPositions.has(posKey);
                      const isGolden = goldenPositions.has(posKey) || sym?.isGolden;
                      const isScatter = scatterPositions.has(posKey);

                      return (
                        <div key={ri}
                          className={`relative overflow-hidden ${ri === ROWS - 1 ? 'rounded-t-[3px] rounded-b-[8px]' : 'rounded-[3px]'} ${isWin ? 'z-20' : ''} ${isScatter ? 'z-20' : ''}`}
                          style={{
                            paddingBottom: '140%',
                            border: isWin ? '2px solid hsl(0, 85%, 50%)' : isScatter ? '2px solid hsl(45, 100%, 50%)' : isGolden ? '1.5px solid hsl(45, 75%, 55%)' : '1px solid hsla(0, 0%, 70%, 0.3)',
                            boxShadow: isWin
                              ? '0 0 12px hsla(0, 85%, 50%, 0.7)'
                              : 'inset 0 1px 2px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)',
                            background: isGolden
                              ? 'linear-gradient(145deg, hsl(48, 75%, 70%) 0%, hsl(42, 65%, 55%) 50%, hsl(38, 60%, 45%) 100%)'
                              : 'linear-gradient(160deg, hsl(0, 0%, 97%) 0%, hsl(0, 0%, 93%) 30%, hsl(0, 0%, 88%) 70%, hsl(0, 0%, 82%) 100%)',
                          }}>
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={false}
                            animate={isWin ? {
                              scale: [1, 1.3, 0],
                              opacity: [1, 1, 0],
                              x: [(ci - 2) * 0, (ci - 2) * 25],
                              y: [(ri - 1.5) * 0, (ri - 1.5) * 30],
                              transition: { duration: 0.4, ease: 'power2.in' },
                            } : { scale: 1, opacity: 1, x: 0, y: 0 }}
                          >
                            <SpinningIcon
                              finalSym={sym}
                              spinning={reelsSpinning}
                              colIndex={ci}
                              rowIndex={ri}
                              turbo={turboMode}
                            />
                          </motion.div>
                          {isGolden && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 2, repeat: Infinity }}
                              style={{ background: 'linear-gradient(135deg, transparent, hsla(45, 90%, 60%, 0.35))' }} />
                          )}
                          {isWin && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 0.6, repeat: Infinity }}
                              style={{ background: 'radial-gradient(circle, hsla(45, 90%, 60%, 0.6), transparent)' }} />
                          )}
                          {isScatter && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.05, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ background: 'radial-gradient(circle, hsla(45, 100%, 50%, 0.4), transparent)', boxShadow: '0 0 20px hsla(45, 100%, 50%, 0.3)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Small Win / Partial Win Overlay (tier: < 5x) */}
            <AnimatePresence>
              {lastWin > 0 && !spinning && (winTier === 'none' || winTier === 'small') && (
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="text-center px-8 py-4 rounded-2xl" style={{ background: 'hsla(0, 0%, 0%, 0.75)', backdropFilter: 'blur(6px)' }}>
                    <motion.p className="text-primary font-heading font-extrabold text-xl"
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: 2 }}>
                      Win
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-3xl gold-text"
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    {multiplier > 1 && (
                      <motion.p className="text-xs text-primary font-heading font-bold mt-1"
                        animate={{ opacity: [0, 1] }}>x{multiplier} Multiplier!</motion.p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Medium Overlay (5x–10x) */}
            <AnimatePresence>
              {winTier === 'medium' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
                  style={{ background: 'hsla(0, 0%, 0%, 0.8)' }}>
                  <motion.div className="text-center px-8 py-5 rounded-2xl"
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    style={{ background: 'linear-gradient(180deg, hsl(35, 80%, 45%), hsl(30, 75%, 35%))', border: '2px solid hsl(45, 90%, 55%)', boxShadow: '0 0 24px hsla(45, 90%, 55%, 0.4)' }}>
                    <motion.p className="font-heading font-extrabold text-2xl mb-1" style={{ color: 'hsl(45, 100%, 75%)' }}
                      animate={{ opacity: [1, 0.8, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      MEDIUM!
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-4xl gold-text">
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    {multiplier > 1 && (
                      <p className="text-sm text-primary font-heading font-bold mt-1">x{multiplier} Multiplier!</p>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Big Overlay (10x–20x) */}
            <AnimatePresence>
              {winTier === 'bigwin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50"
                  style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                  <motion.div className="text-center" initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6, type: 'spring' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="absolute rounded-full border-2"
                        style={{ borderColor: 'hsla(45, 90%, 60%, 0.3)', width: 120 + i * 80, height: 120 + i * 80, left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
                        animate={{ scale: [0.8, 1.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} />
                    ))}
                    <motion.p className="font-heading font-extrabold text-3xl mb-1"
                      animate={{ color: ['hsl(200,90%,60%)', 'hsl(220,90%,70%)', 'hsl(200,90%,60%)'] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{ textShadow: '0 0 20px hsla(200, 90%, 60%, 0.6)' }}>
                      💎 BIG! 💎
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-5xl"
                      style={{ color: 'hsl(200, 90%, 65%)', textShadow: '0 0 30px hsla(200, 90%, 60%, 0.6)' }}
                      animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    {multiplier > 1 && (
                      <motion.p className="text-sm font-heading font-bold mt-2"
                        style={{ color: 'hsl(200, 80%, 70%)' }}
                        animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                        x{multiplier} Multiplier!
                      </motion.p>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mega Overlay (20x+) */}
            <AnimatePresence>
              {winTier === 'megawin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
                  style={{ background: 'hsla(0, 0%, 0%, 0.9)' }}>
                  {Array.from({ length: 30 }, (_, i) => (
                    <motion.div key={i} className="absolute rounded-full"
                      style={{
                        width: 4 + Math.random() * 6, height: 4 + Math.random() * 6,
                        background: ['hsl(45,95%,60%)', 'hsl(0,90%,60%)', 'hsl(280,90%,65%)', 'hsl(120,80%,55%)', 'hsl(200,90%,65%)'][i % 5],
                        left: '50%', top: '50%',
                      }}
                      animate={{
                        x: [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 300],
                        y: [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 400],
                        opacity: [0, 1, 1, 0], scale: [0, 1.5, 1, 0],
                      }}
                      transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: Math.random() * 1.5, ease: 'easeOut' }}
                    />
                  ))}
                  <motion.div className="text-center relative z-10" initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: [0, 1.4, 1], rotate: [-15, 5, 0] }} transition={{ duration: 1, type: 'spring', damping: 8 }}>
                    <motion.div className="absolute -inset-20 rounded-full pointer-events-none"
                      style={{ background: 'radial-gradient(circle, hsla(45, 100%, 50%, 0.25), transparent 70%)' }}
                      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }} />
                    <motion.p className="font-heading font-extrabold text-2xl mb-1"
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.3, repeat: Infinity }}
                      style={{ color: 'hsl(45, 100%, 70%)' }}>
                      🎰🎰🎰
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-4xl mb-2"
                      animate={{ color: ['hsl(45,95%,65%)', 'hsl(30,95%,55%)', 'hsl(0,90%,60%)', 'hsl(280,90%,65%)', 'hsl(45,95%,65%)'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ textShadow: '0 0 30px hsla(45, 90%, 60%, 0.7), 0 4px 8px rgba(0,0,0,0.5)' }}>
                      ✨ MEGA! ✨
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-6xl"
                      style={{ color: 'hsl(45, 95%, 65%)', textShadow: '0 0 40px hsla(45, 90%, 55%, 0.8)' }}
                      animate={{ scale: [1, 1.12, 1], y: [0, -5, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    {multiplier > 1 && (
                      <motion.p className="text-lg font-heading font-bold mt-3"
                        style={{ color: 'hsl(45, 90%, 70%)' }}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                        x{multiplier} MULTIPLIER!
                      </motion.p>
                    )}
                    <motion.div className="flex justify-center gap-1 mt-2"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                      {['🎉', '🏆', '💰', '🏆', '🎉'].map((e, i) => (
                        <motion.span key={i} className="text-2xl"
                          animate={{ y: [0, -10, 0], rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}>
                          {e}
                        </motion.span>
                      ))}
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Final win overlay — small/medium: clear total payout after round */}
            <AnimatePresence>
              {showFinalWinOverlay && totalWin > 0 && (
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
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="text-center px-10 py-6 rounded-2xl"
                    style={{
                      background: 'linear-gradient(180deg, hsl(45, 70%, 42%), hsl(38, 65%, 32%))',
                      border: '2px solid hsl(45, 90%, 55%)',
                      boxShadow: '0 0 32px hsla(45, 90%, 50%, 0.4)',
                    }}
                  >
                    <p className="font-heading font-bold text-lg mb-1" style={{ color: 'hsl(45, 100%, 80%)' }}>
                      Win
                    </p>
                    <p className="font-heading font-extrabold text-5xl gold-text" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                      ৳{totalWin.toLocaleString()}
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total Payout Overlay — flaming + Money Coming style (after all cascades) */}
            <BigWinOverlay
              active={showTotalWinOverlay}
              amount={totalWin}
              type={winTier === 'megawin' ? 'mega_win' : 'big_win'}
              onComplete={() => setShowTotalWinOverlay(false)}
            />

            {/* Free Spin Popup */}
            <AnimatePresence>
              {showFreeSpin && (
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 10 }}
                  className="absolute inset-0 flex items-center justify-center z-50"
                  style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                  <div className="text-center">
                    <motion.p className="font-heading font-extrabold text-3xl mb-2"
                      style={{ color: 'hsl(45, 90%, 60%)', textShadow: '0 0 15px hsla(45, 90%, 60%, 0.5)' }}
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                      ✨ FREE SPINS! ✨
                    </motion.p>
                    <motion.p className="text-primary font-heading font-extrabold text-6xl"
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.6, delay: 0.3 }}>
                      10
                    </motion.p>
                    <motion.p className="text-sm text-muted-foreground mt-3 font-heading"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                      x2 → x4 → x6 → x10 Multipliers!
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
          </div>
        </div>
        </div>

        {/* Bottom Controls — JILI Dark Brown Wood Style */}
        <div className="px-3 pb-3 space-y-1.5 mb-16 relative z-10" style={{
          background: 'linear-gradient(180deg, hsl(15, 30%, 18%), hsl(10, 28%, 12%))',
          borderTop: '2px solid hsl(25, 35%, 25%)',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
          paddingTop: '8px',
        }}>
          {/* WIN Counter */}
          <div className="flex items-center justify-center rounded-lg py-2 px-4 relative overflow-hidden" style={{
            background: 'linear-gradient(180deg, hsl(15, 25%, 14%), hsl(10, 20%, 10%))',
            border: '1px solid hsla(25, 30%, 25%, 0.5)',
          }}>
            <span className="text-xs font-heading mr-3 uppercase tracking-wider" style={{ color: 'hsl(35, 25%, 45%)' }}>WIN</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={totalWin}
                className={`font-heading font-extrabold ${totalWin > 0 ? 'text-2xl' : 'text-lg'}`}
                style={totalWin > 0 ? {
                  background: 'linear-gradient(180deg, hsl(45, 100%, 75%), hsl(40, 95%, 55%), hsl(35, 85%, 45%))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 8px hsla(45, 90%, 55%, 0.5))',
                } : { color: 'hsl(35, 20%, 40%)' }}
                initial={{ scale: 1.5, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              >
                ৳{totalWin.toLocaleString()}
              </motion.span>
            </AnimatePresence>
            {totalWin > 0 && (
              <motion.div className="absolute inset-0 pointer-events-none"
                animate={{ opacity: [0, 0.15, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ background: 'linear-gradient(90deg, transparent 20%, hsla(45, 90%, 55%, 0.2) 50%, transparent 80%)' }} />
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            {/* Bet controls */}
            <div className="flex-1">
              <div className="flex items-center gap-1 rounded-lg px-2 py-1.5" style={{
                background: 'hsl(15, 20%, 12%)',
                border: '1px solid hsla(25, 25%, 22%, 0.6)',
              }}>
                <span className="text-[10px] font-heading mr-1" style={{ color: 'hsl(35, 20%, 45%)' }}>Bet</span>
                <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx > 0) setStake(stakeOptions[idx - 1]); }}
                  disabled={spinning}
                  className="w-7 h-7 rounded flex items-center justify-center font-bold text-sm active:scale-90 transition-transform disabled:opacity-50"
                  style={{ background: 'hsl(15, 18%, 18%)', color: 'hsl(35, 50%, 55%)' }}>−</button>
                <span className="flex-1 text-center font-heading font-bold text-sm" style={{ color: 'hsl(45, 80%, 60%)' }}>৳{stake}</span>
                <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx < stakeOptions.length - 1) setStake(stakeOptions[idx + 1]); }}
                  disabled={spinning}
                  className="w-7 h-7 rounded flex items-center justify-center font-bold text-sm active:scale-90 transition-transform disabled:opacity-50"
                  style={{ background: 'hsl(15, 18%, 18%)', color: 'hsl(35, 50%, 55%)' }}>+</button>
              </div>
            </div>

            {/* JILI Golden Spin Button */}
            <motion.button onClick={() => { sfx.buttonClick(); if (autoSpin) { setAutoSpin(false); return; } performSpin(); }}
              disabled={spinning && !autoSpin}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70 relative"
              style={{
                background: 'linear-gradient(135deg, hsl(40, 75%, 55%), hsl(35, 70%, 40%))',
                boxShadow: '0 0 15px hsla(40, 80%, 50%, 0.4), 0 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 hsla(45, 90%, 70%, 0.5)',
                border: '3px solid hsl(35, 60%, 35%)',
              }}
              whileTap={{ scale: 0.9 }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(40, 80%, 60%), hsl(35, 75%, 45%))', border: '2px solid hsl(40, 65%, 50%)' }}>
                <div style={{
                  width: 0, height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderLeft: '12px solid hsl(25, 80%, 20%)',
                  marginLeft: '2px',
                }} />
              </div>
            </motion.button>

            {/* Right controls */}
            <div className="flex-1 flex justify-end gap-1">
              <button onClick={() => { sfx.buttonClick(); setTurboMode(!turboMode); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold transition-colors"
                style={turboMode ? {
                  background: 'linear-gradient(135deg, hsl(40, 80%, 50%), hsl(30, 75%, 40%))',
                  color: 'hsl(30, 90%, 15%)',
                } : {
                  background: 'hsl(15, 20%, 14%)',
                  color: 'hsl(35, 20%, 50%)',
                  border: '1px solid hsla(25, 25%, 22%, 0.5)',
                }}>
                ⚡ Turbo
              </button>
              <button onClick={() => { sfx.buttonClick(); setAutoSpin(!autoSpin); if (!autoSpin && !spinning) { autoSpinRef.current = true; performSpin(); } }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold transition-colors"
                style={autoSpin ? {
                  background: 'hsl(0, 70%, 45%)',
                  color: 'hsl(0, 0%, 95%)',
                } : {
                  background: 'hsl(15, 20%, 14%)',
                  color: 'hsl(35, 20%, 50%)',
                  border: '1px solid hsla(25, 25%, 22%, 0.5)',
                }}>
                {autoSpin ? '⏹ Stop' : '🔄 Auto'}
              </button>
            </div>
          </div>

          {/* Balance bar */}
          <div className="flex items-center justify-between px-2 py-1 rounded-lg"
            style={{ background: 'hsl(15, 20%, 10%)', border: '1px solid hsla(25, 20%, 20%, 0.4)' }}>
            <span className="text-[10px] font-heading" style={{ color: 'hsl(35, 20%, 40%)' }}>Balance</span>
            <span className="font-heading font-bold text-sm" style={{ color: 'hsl(45, 80%, 60%)' }}>৳{balance.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default SuperAceGame;
