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
import { SWEET_BONANZA_PAYTABLE } from '@/config/paytableConfigs';

// Boxing King symbol images
import boxer1Img from './assets/boxer1.png';
import boxer2Img from './assets/boxer2.png';
import glovesImg from './assets/gloves.png';
import beltImg from './assets/belt.png';
import trophyImg from './assets/trophy.png';
import bellImg from './assets/bell.png';
import shortsImg from './assets/shorts.png';
import wildImg from './assets/wild.png';
import scatterImg from './assets/scatter.png';
import ringBg from './assets/ring-bg.png';
import boxerHero from './assets/boxer-hero.png';

import { sfx } from '../super-ace/engine/SoundEngine';

// ─── Types (matching backend response) ───
interface SimpleSymbol {
  id: string;
  isWild: boolean;
  isScatter: boolean;
}

interface CascadeStep {
  grid: SimpleSymbol[][];
  winPositions: string[];
  paylineWins: { paylineIndex: number; symbolId: string; matchCount: number; payout: number }[];
  cascadePayout: number;
  multiplier: number;
}

interface BonusFightResult {
  triggered: boolean;
  multiplier: number;
  tier: string;
}

interface SpinResponse {
  initialGrid: SimpleSymbol[][];
  finalGrid?: SimpleSymbol[][];
  scatterPositions: string[];
  cascadeSteps: CascadeStep[];
  paylineWins: { paylineIndex: number; symbolId: string; matchCount: number; payout: number; positions: [number, number][] }[];
  scatterWin: { count: number; payout: number; positions: [number, number][] };
  bonusFight: BonusFightResult | null;
  totalWin: number;
  newBalance: number;
  winTier: string;
  freeSpins: {
    triggered: boolean;
    remaining: number;
    sessionId: string | null;
    multiplier: number;
  };
}

// ─── Map backend symbol IDs to boxing images (defaults) ───
const DEFAULT_IMG_MAP: Record<string, string> = {
  boxer: boxer1Img,
  gloves: glovesImg,
  trophy: trophyImg,
  A: bellImg,
  K: boxer2Img,
  Q: glovesImg,
  J: shortsImg,
  '10': beltImg,
  wild: wildImg,
  scatter: scatterImg,
};

const getSymImg = (sym: SimpleSymbol, customSymbols?: Record<string, string>) => {
  if (customSymbols && customSymbols[sym.id]) return customSymbols[sym.id];
  return DEFAULT_IMG_MAP[sym.id] || bellImg;
};

const ROWS = 3, COLS = 5;

const defaultSymbol = (): SimpleSymbol => ({
  id: ['boxer', 'gloves', 'trophy', 'A', 'K', 'Q', 'J', '10'][Math.floor(Math.random() * 8)],
  isWild: false, isScatter: false,
});

const defaultGrid = (): SimpleSymbol[][] =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, defaultSymbol));

// ─── Spinning Icon (Professional vertical scroll with blur) ───
const SPIN_SYMBOLS = ['boxer', 'gloves', 'trophy', 'A', 'K', 'Q', 'J', '10'];
const randomSym = (): SimpleSymbol => ({
  id: SPIN_SYMBOLS[Math.floor(Math.random() * SPIN_SYMBOLS.length)],
  isWild: false, isScatter: false,
});

const SpinningIcon = ({
  finalSym, spinning, colIndex, rowIndex, turbo, customSymbols,
}: {
  finalSym: SimpleSymbol; spinning: boolean; colIndex: number; rowIndex: number; turbo: boolean; customSymbols?: Record<string, string>;
}) => {
  const [displaySym, setDisplaySym] = useState<SimpleSymbol>(finalSym);
  const [phase, setPhase] = useState<'idle' | 'blur' | 'landing' | 'bounce'>('idle');
  const finalRef = useRef<SimpleSymbol>(finalSym);

  useEffect(() => { finalRef.current = finalSym; }, [finalSym]);

  useEffect(() => {
    if (!spinning) {
      setDisplaySym(finalRef.current);
      setPhase('idle');
      return;
    }

    setPhase('idle');
    const delay = colIndex * (turbo ? 15 : 35);
    const spinDuration = (turbo ? 35 : 70) + colIndex * (turbo ? 12 : 22);
    const cycleSpeed = turbo ? 30 : 45;
    let started = false;
    let timer: ReturnType<typeof setInterval>;
    let stopTimeout: ReturnType<typeof setTimeout>;

    const startCycle = () => {
      started = true;
      setPhase('blur');
      timer = setInterval(() => setDisplaySym(randomSym()), cycleSpeed);
      stopTimeout = setTimeout(() => {
        clearInterval(timer);
        setDisplaySym(finalRef.current);
        setPhase('landing');
        sfx.reelStop(colIndex);
        // Bounce settle
        setTimeout(() => setPhase('bounce'), turbo ? 35 : 70);
        setTimeout(() => setPhase('idle'), turbo ? 80 : 130);
      }, spinDuration);
    };

    const delayTimeout = setTimeout(startCycle, delay);
    return () => {
      clearTimeout(delayTimeout);
      if (started) { clearInterval(timer); clearTimeout(stopTimeout); }
    };
  }, [spinning, colIndex, rowIndex, turbo]);

  const animateProps = (() => {
    switch (phase) {
      case 'blur':
        return { y: ['-100%', '100%'], opacity: 0.5, scale: 0.85 };
      case 'landing':
        return { y: ['60%', '-8%', '0%'], opacity: 1, scale: [0.7, 1.12, 1] };
      case 'bounce':
        return { y: ['0%', '-4%', '0%'], opacity: 1, scale: [1, 1.04, 1] };
      default:
        return { y: '0%', opacity: 1, scale: 1 };
    }
  })();

  const transitionProps = (() => {
    switch (phase) {
      case 'blur':
        return { duration: 0.05, repeat: Infinity, ease: 'linear' as const };
      case 'landing':
        return { duration: 0.1, ease: [0.22, 1.2, 0.36, 1] as any, delay: rowIndex * 0.008 };
      case 'bounce':
        return { duration: 0.07, ease: 'easeOut' as const };
      default:
        return { duration: 0 };
    }
  })();

  return (
    <motion.img
      src={getSymImg(displaySym, customSymbols)}
      alt={displaySym.id}
      draggable={false}
      className="absolute inset-0 w-full h-full object-contain p-[3px]"
      style={{
        filter: phase === 'blur'
          ? 'blur(2px) brightness(1.3) drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
          : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5)) contrast(1.1) saturate(1.15)',
        imageRendering: 'crisp-edges' as any,
      }}
      initial={false}
      animate={animateProps}
      transition={transitionProps}
    />
  );
};

// ─── Particle Effect ───
const WinParticles = ({ active }: { active: boolean }) => {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 0.5,
    dur: 1 + Math.random() * 1.5, size: 3 + Math.random() * 5,
    color: ['hsl(0,80%,55%)', 'hsl(35,85%,50%)', 'hsl(45,90%,60%)', 'hsl(0,0%,100%)'][Math.floor(Math.random() * 4)],
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

// ─── Main Boxing King Component ───
const BoxingKingGame = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const { symbols: customSymbols, background: customBg, music: customMusic, mascot: customMascot, mascotSize } = useGameAssets('sweet-bonanza');
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<SimpleSymbol[][]>(defaultGrid);
  const [spinning, setSpinning] = useState(false);
  const [reelsSpinning, setReelsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [winPositions, setWinPositions] = useState<Set<string>>(new Set());
  const [bonusFight, setBonusFight] = useState<BonusFightResult | null>(null);
  const [scatterPositions, setScatterPositions] = useState<Set<string>>(new Set());
  const [multiplier, setMultiplier] = useState(1);
  const [cascadeCount, setCascadeCount] = useState(0);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinMode, setFreeSpinMode] = useState(false);
  const [showFreeSpin, setShowFreeSpin] = useState(false);
  const [winTier, setWinTier] = useState<'none' | 'win' | 'bigwin' | 'megawin'>('none');
  const [showParticles, setShowParticles] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [turboMode, setTurboMode] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showFinalWinOverlay, setShowFinalWinOverlay] = useState(false);

  const autoSpinRef = useRef(false);
  const spinningRef = useRef(false);

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('sweet-bonanza', 'Lucky Boxing King', 'slot', stake);
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

  const BASE_MULTIPLIERS = [1, 1.5, 2, 3, 5];
  const FREE_MULTIPLIERS = [1, 2, 3, 5, 8];
  const currentMultipliers = freeSpinMode ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;

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

  const performSpin = useCallback(async () => {
    if (spinningRef.current) return;
    if (balance < stake) {
      gameToast.error(`Low balance! Please deposit.`);
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
    setBonusFight(null);

    try {
      let data: Awaited<ReturnType<typeof api.boxingKingSpin>>;
      try {
        data = await api.boxingKingSpin({ bet: stake });
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
      setBonusFight(result.bonusFight);
      setReelsSpinning(true);

      // Fall + bounce complete hole tokhon spinning=false
      const spinTime = turboMode ? 350 : 500;
      await new Promise(r => setTimeout(r, spinTime));
      setReelsSpinning(false);

      // Scatter check
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

      // Cascade win animation only — grid already set to final, icon change hobena
      const delay = turboMode ? 40 : 120;
      if (result.cascadeSteps.length > 0) {
        await new Promise(r => setTimeout(r, delay));
      }

      for (let i = 0; i < result.cascadeSteps.length; i++) {
        const step = result.cascadeSteps[i];
        setWinPositions(new Set(step.winPositions));
        setMultiplier(step.multiplier);
        setLastWin(step.cascadePayout);
        setTotalWin(result.cascadeSteps.slice(0, i + 1).reduce((s, c) => s + c.cascadePayout, 0));
        setShowParticles(true);
        setCascadeCount(i);

        if (step.cascadePayout >= stake * 5) sfx.winBig(); else sfx.winSmall();
        await new Promise(r => setTimeout(r, turboMode ? 100 : 280));

        sfx.cascade();
        setWinPositions(new Set());
        setShowParticles(false);
        await new Promise(r => setTimeout(r, delay));
      }

      setTotalWin(result.totalWin);

      // Bonus Fight animation
      if (result.bonusFight?.triggered) {
        setBonusFight(result.bonusFight);
        sfx.winMega();
        await new Promise(r => setTimeout(r, 1200));
        setBonusFight(null);
      }

      const tier = result.winTier ?? (result.totalWin >= stake * 20 ? 'mega_win' : result.totalWin >= stake * 10 ? 'big_win' : result.totalWin >= stake * 5 ? 'medium_win' : result.totalWin > 0 ? 'small_win' : 'loss');
      if (tier === 'mega_win') {
        setWinTier('megawin');
        sfx.winMega();
        setTimeout(() => setWinTier('none'), 1800);
      } else if (tier === 'big_win') {
        setWinTier('bigwin');
        sfx.winBig();
        setTimeout(() => setWinTier('none'), 1200);
      } else if (tier === 'medium_win' || tier === 'small_win') {
        setWinTier('win');
        // Final win overlay disabled
        setTimeout(() => setWinTier('none'), 600);
      }

      if (result.freeSpins.triggered) {
        sfx.freeSpinTrigger();
        setFreeSpinMode(true);
        setFreeSpinsRemaining(result.freeSpins.remaining);
        setShowFreeSpin(true);
        setTimeout(() => setShowFreeSpin(false), 1200);
      } else {
        setFreeSpinsRemaining(result.freeSpins.remaining);
        if (result.freeSpins.remaining <= 0) setFreeSpinMode(false);
      }

      if (result.newBalance != null) applyAuthoritativeBalance(result.newBalance);
      else refreshBalance();
    } catch (err) {
      console.error('Spin error:', err);
      gameToast.error('Connection error. Please try again.');
    }

    setSpinning(false);
    spinningRef.current = false;

    if (autoSpinRef.current || freeSpinMode) {
      setTimeout(() => performSpin(), freeSpinMode ? 150 : 80);
    }
  }, [stake, turboMode, freeSpinMode, refreshBalance, applyAuthoritativeBalance, balance]);

  useEffect(() => {
    if (freeSpinMode && freeSpinsRemaining > 0 && !spinningRef.current && !showSplash) {
      const t = setTimeout(() => performSpin(), 400);
      return () => clearTimeout(t);
    }
  }, [freeSpinMode, freeSpinsRemaining, performSpin, showSplash]);

  const stakeOptions = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🥊 Lucky Boxing King" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative" style={{
        background: 'hsl(220, 60%, 5%)',
      }}>
        {/* Boxing Ring Background */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `url(${customBg || ringBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.35,
        }} />
        <motion.div
          className="relative z-10 flex flex-col min-h-screen"
          animate={
            winTier === 'megawin'
              ? { x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, -3, 3, -2, 2, 0] }
              : winTier === 'bigwin'
                ? { x: [0, -3, 3, -2, 2, 0] }
                : {}
          }
          transition={
            winTier === 'megawin'
              ? { duration: 0.4, repeat: Infinity, repeatType: 'mirror' as const }
              : winTier === 'bigwin'
                ? { duration: 0.3, repeat: 3 }
                : {}
          }
        >
        {/* Header Bar */}
        <div className="flex items-center gap-2 px-3 py-1.5" style={{
          background: 'linear-gradient(90deg, hsl(220, 50%, 12%), hsl(220, 40%, 18%), hsl(220, 50%, 12%))',
          borderBottom: '1px solid hsl(35, 70%, 35%)',
        }}>
          <button onClick={() => navigate('/slots')} className="p-1.5">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="gold-border rounded-full px-2.5 py-0.5">
            <span className="text-xs font-heading font-bold" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{balance.toLocaleString()}</span>
          </div>
          <div className="flex-1" />
          <PaytableModal gameName="Lucky Boxing King" betAmount={stake} {...SWEET_BONANZA_PAYTABLE} />
          <button onClick={() => setMuted(!muted)} className="p-1.5">
            {muted ? <VolumeX size={18} className="text-muted-foreground" /> : <Volume2 size={18} style={{ color: 'hsl(45, 90%, 60%)' }} />}
          </button>
        </div>

        {/* Boxing King Title */}
        <div className="text-center py-2 relative">
          <h1 className="font-heading font-extrabold text-3xl tracking-wider"
            style={{
              background: 'linear-gradient(180deg, hsl(45, 100%, 75%) 0%, hsl(35, 90%, 50%) 40%, hsl(25, 80%, 35%) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 3px 6px hsla(35, 80%, 30%, 0.8)) drop-shadow(0 0 20px hsla(0, 80%, 50%, 0.3))',
            }}>
            🥊 BOXING KING 🥊
          </h1>
          <div className="mx-auto mt-1 h-[2px] w-48 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(0, 70%, 50%), hsl(45, 90%, 55%), hsl(0, 70%, 50%), transparent)' }} />
        </div>

        {/* Multiplier Bar */}
        <div className="px-3 mb-1">
          <div className="rounded-xl overflow-hidden" style={{
            background: 'linear-gradient(180deg, hsl(220, 40%, 12%), hsl(220, 35%, 8%))',
            border: '1px solid hsl(35, 50%, 30%)',
          }}>
            {freeSpinMode && (
              <motion.div className="text-center py-1" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <span className="text-xs font-heading text-muted-foreground">FREE SPINS</span>
                <span className="ml-2 text-lg font-heading font-extrabold" style={{ color: 'hsl(0, 80%, 55%)' }}>{freeSpinsRemaining}</span>
              </motion.div>
            )}
            <div className="flex justify-center gap-1.5 px-3 py-1.5">
              {currentMultipliers.map((m, i) => {
                const isActive = cascadeCount >= i && lastWin > 0;
                return (
                  <motion.div key={m}
                    className={`px-3.5 py-1 rounded-lg text-xs font-heading font-extrabold transition-all ${!isActive ? 'bg-secondary/50 text-muted-foreground' : 'text-primary-foreground'}`}
                    style={isActive ? { background: 'linear-gradient(135deg, hsl(0, 80%, 50%), hsl(35, 90%, 50%))' } : {}}
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={isActive ? { duration: 0.4 } : {}}>
                    x{m}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Boxer Hero - between multiplier bar and grid */}
        <div className="flex justify-center -mb-6 relative z-20">
          <motion.img
            src={customMascot || boxerHero}
            alt="Lucky Boxing King"
            className="object-contain drop-shadow-[0_0_15px_hsla(0,80%,50%,0.5)]"
            style={{ mixBlendMode: 'screen', height: `${mascotSize}px` }}
            animate={
              winTier === 'megawin'
                ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1.2, 1.3, 1.2, 1.15], x: [0, -20, 20, -15, 15, 0] }
                : winTier === 'bigwin'
                  ? { rotate: [0, -10, 10, -5, 0], scale: [1, 1.2, 1.15, 1.2, 1.1], x: [0, -12, 12, -8, 0] }
                  : lastWin > 0 && !spinning
                    ? { rotate: [0, -8, 8, 0], scale: [1, 1.15, 1.1, 1], x: [0, -8, 8, 0] }
                    : { rotate: 0, scale: 1, x: 0 }
            }
            transition={
              winTier === 'megawin'
                ? { duration: 0.6, repeat: Infinity, repeatType: 'mirror' as const }
                : winTier === 'bigwin'
                  ? { duration: 0.5, repeat: 3 }
                  : lastWin > 0
                    ? { duration: 0.4, repeat: 1 }
                    : { duration: 0.3 }
            }
          />
        </div>

        {/* Game Grid — Boxing Ring Style */}
        <div className="px-1.5 pb-1 flex-1 flex items-center justify-center">
          <div className="rounded-2xl p-2 relative overflow-hidden w-full max-w-[min(95vw,480px)] mx-auto"
            style={{
              background: 'linear-gradient(180deg, hsl(220, 50%, 15%), hsl(220, 40%, 8%))',
              border: '3px solid hsl(35, 70%, 40%)',
              boxShadow: '0 0 30px hsla(35, 70%, 40%, 0.2), inset 0 0 40px hsla(220, 50%, 5%, 0.8)',
            }}>
            {/* Ring ropes decoration */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, hsl(0, 70%, 45%), hsl(0, 80%, 55%), hsl(0, 70%, 45%))' }} />
            <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, hsl(0, 70%, 45%), hsl(0, 80%, 55%), hsl(0, 70%, 45%))' }} />

            <WinParticles active={showParticles} />

            <div className="grid grid-cols-5 gap-1.5 relative z-10">
              {Array.from({ length: COLS }, (_, ci) => {
                const colSymbols = grid.map(row => row[ci]);
                return (
                  <div key={ci} className="flex flex-col gap-1.5">
                    {colSymbols.map((sym, ri) => {
                      const posKey = `${ri}-${ci}`;
                      const isWin = winPositions.has(posKey);
                      const isGolden = false;
                      const isScatter = scatterPositions.has(posKey);

                      return (
                        <div key={ri}
                          className={`relative overflow-hidden rounded-lg ${isWin ? 'ring-2 z-20' : ''} ${isScatter ? 'ring-2 ring-yellow-400 z-20' : ''}`}
                          style={{
                            paddingBottom: '100%',
                            border: isWin ? '2px solid hsl(45, 90%, 55%)' : '1.5px solid hsl(220, 30%, 25%)',
                            boxShadow: isWin
                              ? '0 0 15px hsla(45, 90%, 55%, 0.6), 0 0 30px hsla(0, 80%, 50%, 0.3)'
                              : '0 2px 4px rgba(0,0,0,0.4)',
                            background: isGolden
                              ? 'linear-gradient(135deg, hsl(45, 80%, 40%), hsl(35, 70%, 30%))'
                              : 'linear-gradient(180deg, hsl(220, 40%, 18%), hsl(220, 35%, 12%))',
                          }}>
                          <SpinningIcon finalSym={sym} spinning={reelsSpinning} colIndex={ci} rowIndex={ri} turbo={turboMode} customSymbols={customSymbols} />

                          {/* Fire effect — bottom flames on every cell */}
                          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                            {[0, 1, 2].map(fi => (
                              <motion.div
                                key={fi}
                                className="absolute bottom-0 rounded-full"
                                style={{
                                  left: `${15 + fi * 25}%`,
                                  width: '35%',
                                  height: '55%',
                                  background: `radial-gradient(ellipse at bottom, hsla(${20 + fi * 12}, 100%, 55%, 0.7) 0%, hsla(${30 + fi * 10}, 95%, 45%, 0.4) 40%, transparent 70%)`,
                                  filter: 'blur(3px)',
                                }}
                                animate={{
                                  scaleY: [0.7, 1.1, 0.8, 1.0, 0.7],
                                  scaleX: [0.9, 1.1, 0.85, 1.05, 0.9],
                                  y: [0, -4, 2, -6, 0],
                                  opacity: [0.5, 0.8, 0.55, 0.75, 0.5],
                                }}
                                transition={{
                                  duration: 1.2 + fi * 0.3,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: fi * 0.2,
                                }}
                              />
                            ))}
                            {/* Tiny ember sparks */}
                            {[0, 1].map(si => (
                              <motion.div
                                key={`spark-${si}`}
                                className="absolute rounded-full"
                                style={{
                                  width: 3, height: 3,
                                  left: `${30 + si * 30}%`,
                                  bottom: '30%',
                                  background: 'hsl(45, 100%, 70%)',
                                  boxShadow: '0 0 4px hsl(35, 100%, 60%)',
                                }}
                                animate={{
                                  y: [-5, -25, -40],
                                  x: [0, (si === 0 ? -8 : 10), (si === 0 ? -14 : 18)],
                                  opacity: [0.9, 0.6, 0],
                                  scale: [1, 0.7, 0.3],
                                }}
                                transition={{
                                  duration: 1 + si * 0.4,
                                  repeat: Infinity,
                                  delay: si * 0.5,
                                  ease: 'easeOut',
                                }}
                              />
                            ))}
                          </div>

                          {isGolden && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 2, repeat: Infinity }}
                              style={{ background: 'linear-gradient(135deg, transparent, hsla(45, 90%, 60%, 0.3))' }} />
                          )}
                          {isWin && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 0.6, repeat: Infinity }}
                              style={{ background: 'radial-gradient(circle, hsla(0, 80%, 55%, 0.5), transparent)' }} />
                          )}
                          {isScatter && (
                            <motion.div className="absolute inset-0 pointer-events-none"
                              animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.05, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ background: 'radial-gradient(circle, hsla(45, 100%, 50%, 0.4), transparent)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Win Overlay (small / medium) */}
            <AnimatePresence>
              {lastWin > 0 && !spinning && (winTier === 'none' || winTier === 'win') && (
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="text-center px-8 py-4 rounded-2xl" style={{ background: 'hsla(0, 0%, 0%, 0.8)', backdropFilter: 'blur(6px)', border: '2px solid hsl(35, 70%, 40%)' }}>
                    <motion.p className="font-heading font-extrabold text-xl" style={{ color: 'hsl(0, 80%, 55%)' }}
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: 2 }}>🥊 WIN!</motion.p>
                    <motion.p className="font-heading font-extrabold text-3xl gold-text"
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    {multiplier > 1 && (
                      <motion.p className="text-xs font-heading font-bold mt-1" style={{ color: 'hsl(45, 90%, 60%)' }}
                        animate={{ opacity: [0, 1] }}>x{multiplier} Cascading Wins!</motion.p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Final win overlay (small/medium) — same as Super Ace */}
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

            {/* Big Win */}
            <AnimatePresence>
              {winTier === 'bigwin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50"
                  style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                  <motion.div className="text-center" initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6, type: 'spring' }}>
                    <motion.p className="font-heading font-extrabold text-3xl mb-1"
                      animate={{ color: ['hsl(0,80%,55%)', 'hsl(35,90%,55%)', 'hsl(0,80%,55%)'] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{ textShadow: '0 0 20px hsla(0, 80%, 55%, 0.6)' }}>
                      🥊 BIG WIN! 🥊
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-5xl"
                      style={{ color: 'hsl(45, 90%, 60%)', textShadow: '0 0 30px hsla(45, 90%, 55%, 0.6)' }}
                      animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MEGA WIN */}
            <AnimatePresence>
              {winTier === 'megawin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
                  style={{ background: 'hsla(0, 0%, 0%, 0.9)' }}>
                  {Array.from({ length: 30 }, (_, i) => (
                    <motion.div key={i} className="absolute rounded-full"
                      style={{
                        width: 4 + Math.random() * 6, height: 4 + Math.random() * 6,
                        background: ['hsl(0,80%,55%)', 'hsl(45,95%,60%)', 'hsl(35,90%,50%)', 'hsl(0,0%,100%)'][i % 4],
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
                    <motion.p className="font-heading font-extrabold text-4xl mb-2"
                      animate={{ color: ['hsl(0,80%,55%)', 'hsl(45,95%,60%)', 'hsl(35,90%,50%)', 'hsl(0,80%,55%)'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ textShadow: '0 0 30px hsla(0, 80%, 50%, 0.7)' }}>
                      ✨ KNOCKOUT! ✨
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-6xl"
                      style={{ color: 'hsl(45, 95%, 65%)', textShadow: '0 0 40px hsla(45, 90%, 55%, 0.8)' }}
                      animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      ৳{totalWin.toLocaleString()}
                    </motion.p>
                    <motion.div className="flex justify-center gap-1 mt-2"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                      {['🥊', '🏆', '💰', '🏆', '🥊'].map((e, i) => (
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

            {/* Free Spin Popup */}
            <AnimatePresence>
              {showFreeSpin && (
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50"
                  style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                  <div className="text-center">
                    <motion.p className="font-heading font-extrabold text-3xl mb-2"
                      style={{ color: 'hsl(0, 80%, 55%)', textShadow: '0 0 15px hsla(0, 80%, 55%, 0.5)' }}
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                      ✨ FREE SPINS! ✨
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-6xl" style={{ color: 'hsl(45, 90%, 60%)' }}
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.6, delay: 0.3 }}>
                      10
                    </motion.p>
                    <motion.p className="text-sm text-muted-foreground mt-3 font-heading"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                      Cascading Wins x2 → x4 → x6 → x10!
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bonus Fight Overlay */}
            <AnimatePresence>
              {bonusFight && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
                  style={{ background: 'hsla(0, 0%, 0%, 0.92)' }}>
                  {Array.from({ length: 20 }, (_, i) => (
                    <motion.div key={i} className="absolute rounded-full"
                      style={{
                        width: 5 + Math.random() * 8, height: 5 + Math.random() * 8,
                        background: ['hsl(0,80%,55%)', 'hsl(45,95%,60%)', 'hsl(0,0%,100%)'][i % 3],
                        left: '50%', top: '50%',
                      }}
                      animate={{
                        x: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 250],
                        y: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 300],
                        opacity: [0, 1, 0], scale: [0, 1.5, 0],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: Math.random(), ease: 'easeOut' }}
                    />
                  ))}
                  <motion.div className="text-center relative z-10" initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.8, type: 'spring' }}>
                    <motion.p className="font-heading font-extrabold text-2xl mb-1" style={{ color: 'hsl(0, 80%, 55%)' }}
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      🥊 BONUS FIGHT! 🥊
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-4xl mb-2"
                      style={{ color: 'hsl(45, 95%, 65%)', textShadow: '0 0 20px hsla(45, 90%, 55%, 0.8)' }}
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 1] }} transition={{ delay: 0.5, duration: 0.6 }}>
                      {bonusFight.tier}!
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-5xl"
                      style={{ color: 'hsl(120, 60%, 50%)', textShadow: '0 0 30px hsla(120, 60%, 50%, 0.6)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1, scale: [0.5, 1.2, 1] }} transition={{ delay: 1, duration: 0.5 }}>
                      x{bonusFight.multiplier}
                    </motion.p>
                    <motion.div className="flex justify-center gap-2 mt-3"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                      {['🥊', '💥', '🏆', '💥', '🥊'].map((e, i) => (
                        <motion.span key={i} className="text-2xl"
                          animate={{ y: [0, -8, 0], rotate: [0, 15, -15, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}>
                          {e}
                        </motion.span>
                      ))}
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info Bar */}
        <div className="px-3 mb-1">
          <div className="flex items-center justify-between rounded-xl px-3 py-1.5" style={{
            background: 'linear-gradient(90deg, hsl(220, 40%, 10%), hsl(220, 35%, 15%), hsl(220, 40%, 10%))',
            border: '1px solid hsl(35, 50%, 30%)',
          }}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-heading text-muted-foreground">FREE SPINS</span>
              <span className="text-[10px] font-heading text-muted-foreground">CASCADING WINS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-heading" style={{ color: 'hsl(45, 90%, 60%)' }}>Total Win</span>
              <motion.span className={`font-heading font-extrabold text-sm ${totalWin > 0 ? '' : 'text-muted-foreground'}`}
                style={totalWin > 0 ? { color: 'hsl(45, 90%, 60%)' } : {}}
                animate={totalWin > 0 ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }} key={totalWin}>
                ৳{totalWin.toLocaleString()}
              </motion.span>
            </div>
          </div>
        </div>

        {/* Bottom Controls — Bet | Spin (center) | Turbo | Auto */}
        <div className="px-3 pb-3 space-y-2 mb-16">
          <div className="flex items-center justify-between gap-2">
            {/* Bet — left */}
            <div className="flex items-center gap-1 rounded-xl px-2 py-1.5 shrink-0" style={{
              background: 'hsl(220, 35%, 12%)',
              border: '1px solid hsl(35, 50%, 30%)',
            }}>
              <span className="text-[10px] text-muted-foreground font-heading mr-1">BET</span>
              <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx > 0) setStake(stakeOptions[idx - 1]); }}
                disabled={spinning}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground font-bold text-sm active:scale-90 transition-transform disabled:opacity-50"
                style={{ background: 'hsl(220, 30%, 20%)' }}>−</button>
              <span className="min-w-[3rem] text-center font-heading font-bold text-sm" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{stake}</span>
              <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx < stakeOptions.length - 1) setStake(stakeOptions[idx + 1]); }}
                disabled={spinning}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground font-bold text-sm active:scale-90 transition-transform disabled:opacity-50"
                style={{ background: 'hsl(220, 30%, 20%)' }}>+</button>
            </div>

            {/* SPIN — center */}
            <motion.button onClick={() => { sfx.buttonClick(); if (autoSpin) { setAutoSpin(false); return; } performSpin(); }}
              disabled={spinning && !autoSpin}
              className="w-16 h-16 min-w-[64px] min-h-[64px] rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70 relative shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(120, 60%, 35%), hsl(120, 50%, 25%))',
                border: '3px solid hsl(45, 70%, 45%)',
                boxShadow: '0 0 20px hsla(120, 60%, 35%, 0.4), 0 4px 8px rgba(0,0,0,0.5)',
              }}
              whileTap={{ scale: 0.9 }}>
              <span className="font-heading font-extrabold text-primary-foreground text-xs">SPIN</span>
            </motion.button>

            {/* Turbo | Auto — right */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { sfx.buttonClick(); setTurboMode(!turboMode); }}
                className={`px-3 py-2 rounded-lg text-[10px] font-heading font-bold transition-colors ${turboMode ? 'text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}
                style={turboMode ? { background: 'linear-gradient(135deg, hsl(0, 70%, 45%), hsl(35, 80%, 45%))' } : {}}>
                ⚡ TURBO
              </button>
              <button onClick={() => { sfx.buttonClick(); setAutoSpin(!autoSpin); if (!autoSpin && !spinning) { autoSpinRef.current = true; performSpin(); } }}
                className={`px-3 py-2 rounded-lg text-[10px] font-heading font-bold transition-colors ${autoSpin ? 'bg-destructive text-destructive-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                {autoSpin ? '⏹ Stop' : '🔄 Auto'}
              </button>
            </div>
          </div>

          {/* Balance Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl"
            style={{
              background: 'linear-gradient(90deg, hsl(220, 40%, 10%), hsl(220, 35%, 15%), hsl(220, 40%, 10%))',
              border: '1px solid hsl(35, 50%, 25%)',
            }}>
            <span className="text-[10px] text-muted-foreground font-heading">BALANCE</span>
            <span className="font-heading font-bold text-sm" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{balance.toLocaleString()}</span>
          </div>
        </div>
        </motion.div>
      </div>
    </AuthGate>
  );
};

export default BoxingKingGame;
