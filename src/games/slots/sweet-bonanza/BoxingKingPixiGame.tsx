/**
 * Boxing King — PixiJS/WebGL Professional Slot
 * Jilir moto: smooth reel spin, cascade, win effects
 */
import { useState, useRef, useCallback, useEffect } from 'react';
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
import { BoxingKingPixiEngine, type SimpleSymbol } from './BoxingKingPixiEngine';
import { sfx } from '../super-ace/engine/SoundEngine';

// Boxing King symbol assets
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

const ASSET_MAP: Record<string, string> = {
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

interface CascadeStep {
  grid: SimpleSymbol[][];
  winPositions: string[];
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
  totalWin: number;
  newBalance: number;
  winTier: string;
  bonusFight: BonusFightResult | null;
  freeSpins: {
    triggered: boolean;
    remaining: number;
    sessionId: string | null;
    multiplier: number;
  };
}

const ROWS = 3;
const COLS = 5;
const defaultSymbol = (): SimpleSymbol => ({
  id: ['boxer', 'gloves', 'trophy', 'A', 'K', 'Q', 'J', '10'][Math.floor(Math.random() * 8)],
  isWild: false,
  isScatter: false,
});
const defaultGrid = (): SimpleSymbol[][] =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, defaultSymbol));

const BASE_MULTIPLIERS = [1, 1.5, 2, 3, 5];
const FREE_MULTIPLIERS = [1, 2, 3, 5, 8];
const stakeOptions = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

const BoxingKingPixiGame = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();
  const { symbols: customSymbols, background: customBg, music: customMusic, mascot: customMascot, mascotSize } = useGameAssets('sweet-bonanza');
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BoxingKingPixiEngine | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<SimpleSymbol[][]>(defaultGrid);
  const [spinning, setSpinning] = useState(false);
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
  const [showSplash, setShowSplash] = useState(true);
  const [turboMode, setTurboMode] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [muted, setMuted] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  const autoSpinRef = useRef(false);
  const spinningRef = useRef(false);

  useActivePlayer('sweet-bonanza', 'Lucky Boxing King', 'slot', stake);
  useEffect(() => { sfx.muted = muted; }, [muted]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  // Init PixiJS engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new BoxingKingPixiEngine();
    engineRef.current = engine;
    engine.init(canvasRef.current, ASSET_MAP).then(() => {
      engine.setGrid(grid);
      setEngineReady(true);
    });
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineRef.current && engineReady) {
      engineRef.current.setGrid(grid);
    }
  }, [grid, engineReady]);

  // Custom music
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

  const currentMultipliers = freeSpinMode ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;

  const performSpin = useCallback(async () => {
    if (spinningRef.current || !engineRef.current) return;
    if (balance < stake) {
      gameToast.error('Low balance! Please deposit.');
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
    setBonusFight(null);
    engineRef.current.resetTint();

    try {
      let data: Awaited<ReturnType<typeof api.boxingKingSpin>>;
      try {
        data = await api.boxingKingSpin({ bet: stake });
      } catch (e: unknown) {
        gameToast.error((e as Error)?.message || 'Spin failed');
        setSpinning(false);
        spinningRef.current = false;
        return;
      }
      if (data?.error) {
        gameToast.error(data.error || 'Spin failed');
        setSpinning(false);
        spinningRef.current = false;
        return;
      }

      const result = data as SpinResponse;
      const finalGrid = result.finalGrid ?? (result.cascadeSteps.length > 0
        ? result.cascadeSteps[result.cascadeSteps.length - 1].grid
        : result.initialGrid);

      setGrid(finalGrid);
      setBonusFight(result.bonusFight ?? null);

      // PixiJS spin animation
      await engineRef.current!.spinToGrid(finalGrid, turboMode);

      if (result.scatterPositions.length >= 3) {
        sfx.scatter();
        setScatterPositions(new Set(result.scatterPositions));
        engineRef.current!.highlightScatter(new Set(result.scatterPositions));
      }

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

      const delay = turboMode ? 40 : 120;
      for (let i = 0; i < result.cascadeSteps.length; i++) {
        const step = result.cascadeSteps[i];
        setWinPositions(new Set(step.winPositions));
        setMultiplier(step.multiplier);
        setLastWin(step.cascadePayout);
        setTotalWin(result.cascadeSteps.slice(0, i + 1).reduce((s, c) => s + c.cascadePayout, 0));
        setCascadeCount(i);
        if (step.cascadePayout >= stake * 5) sfx.winBig();
        else sfx.winSmall();
        await new Promise(r => setTimeout(r, turboMode ? 100 : 280));
        setWinPositions(new Set());
        await engineRef.current!.playCascadeWin(
          new Set(step.winPositions),
          step.grid,
          turboMode
        );
        setGrid(step.grid);
        await new Promise(r => setTimeout(r, delay));
      }

      setTotalWin(result.totalWin);

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
    if (freeSpinMode && freeSpinsRemaining > 0 && !spinningRef.current && !showSplash && engineReady) {
      const t = setTimeout(() => performSpin(), 400);
      return () => clearTimeout(t);
    }
  }, [freeSpinMode, freeSpinsRemaining, performSpin, showSplash, engineReady]);

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🥊 Lucky Boxing King (WebGL)" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative" style={{ background: 'hsl(220, 60%, 5%)' }}>
        <div className="absolute inset-0 z-0 opacity-35" style={{
          backgroundImage: `url(${customBg || ringBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }} />

        <motion.div className="relative z-10 flex flex-col min-h-screen"
          animate={winTier === 'megawin' ? { x: [0, -6, 6, -4, 4, 0] } : winTier === 'bigwin' ? { x: [0, -3, 3, 0] } : {}}
          transition={winTier === 'megawin' ? { duration: 0.4, repeat: Infinity, repeatType: 'mirror' as const } : winTier === 'bigwin' ? { duration: 0.3, repeat: 3 } : {}}>

          {/* Header */}
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

          {/* Title */}
          <div className="text-center py-2">
            <h1 className="font-heading font-extrabold text-2xl md:text-3xl tracking-wider"
              style={{
                background: 'linear-gradient(180deg, hsl(45, 100%, 75%) 0%, hsl(35, 90%, 50%) 40%, hsl(25, 80%, 35%) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 3px 6px hsla(35, 80%, 30%, 0.8))',
              }}>
              🥊 BOXING KING 🥊
            </h1>
            <p className="text-[10px] text-amber-500/80 mt-0.5">WebGL • PixiJS</p>
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
                      className={`px-3.5 py-1 rounded-lg text-xs font-heading font-extrabold ${!isActive ? 'bg-secondary/50 text-muted-foreground' : 'text-primary-foreground'}`}
                      style={isActive ? { background: 'linear-gradient(135deg, hsl(0, 80%, 50%), hsl(35, 90%, 50%))' } : {}}>
                      x{m}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Boxer Hero */}
          <div className="flex justify-center -mb-4 relative z-20">
            <motion.img
              src={customMascot || boxerHero}
              alt="Lucky Boxing King"
              className="object-contain drop-shadow-[0_0_15px_hsla(0,80%,50%,0.5)]"
              style={{ mixBlendMode: 'screen', height: `${mascotSize || 80}px` }}
              animate={lastWin > 0 && !spinning ? { scale: [1, 1.15, 1.1], rotate: [0, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }} />
          </div>

          {/* PixiJS Game Canvas */}
          <div className="px-2 pb-1 flex-1 flex items-center justify-center">
            <div className="rounded-2xl p-2.5 w-full max-w-[min(95vw,480px)] mx-auto overflow-hidden relative"
              style={{
                background: 'linear-gradient(180deg, hsl(220, 45%, 12%), hsl(220, 50%, 6%))',
                border: '3px solid hsl(38, 75%, 45%)',
                boxShadow: '0 0 40px hsla(38, 70%, 40%, 0.25), inset 0 0 60px hsla(220, 50%, 2%, 0.5)',
              }}>
              <div
                ref={canvasRef}
                className="w-full rounded-xl"
                style={{ aspectRatio: '4/3', minHeight: 240, maxHeight: 360 }}
              />

              {/* Win Overlay */}
              <AnimatePresence>
                {lastWin > 0 && !spinning && (winTier === 'none' || winTier === 'win') && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <div className="text-center px-8 py-4 rounded-2xl" style={{ background: 'hsla(0, 0%, 0%, 0.8)', backdropFilter: 'blur(6px)', border: '2px solid hsl(35, 70%, 40%)' }}>
                      <motion.p className="font-heading font-extrabold text-xl" style={{ color: 'hsl(0, 80%, 55%)' }}>🥊 WIN!</motion.p>
                      <motion.p className="font-heading font-extrabold text-3xl gold-text">৳{totalWin.toLocaleString()}</motion.p>
                      {multiplier > 1 && <p className="text-xs font-heading font-bold mt-1" style={{ color: 'hsl(45, 90%, 60%)' }}>x{multiplier} Cascading!</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Big Win */}
              <AnimatePresence>
                {winTier === 'bigwin' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                    <div className="text-center">
                      <motion.p className="font-heading font-extrabold text-3xl mb-1" style={{ color: 'hsl(0,80%,55%)' }}>🥊 BIG WIN! 🥊</motion.p>
                      <motion.p className="font-heading font-extrabold text-5xl" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{totalWin.toLocaleString()}</motion.p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mega Win */}
              <AnimatePresence>
                {winTier === 'megawin' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'hsla(0, 0%, 0%, 0.9)' }}>
                    <div className="text-center">
                      <motion.p className="font-heading font-extrabold text-4xl mb-2" style={{ color: 'hsl(0,80%,55%)' }}>✨ KNOCKOUT! ✨</motion.p>
                      <motion.p className="font-heading font-extrabold text-6xl" style={{ color: 'hsl(45, 95%, 65%)' }}>৳{totalWin.toLocaleString()}</motion.p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Free Spin Popup */}
              <AnimatePresence>
                {showFreeSpin && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'hsla(0, 0%, 0%, 0.85)' }}>
                    <div className="text-center">
                      <p className="font-heading font-extrabold text-3xl mb-2" style={{ color: 'hsl(0, 80%, 55%)' }}>✨ FREE SPINS! ✨</p>
                      <p className="font-heading font-extrabold text-6xl" style={{ color: 'hsl(45, 90%, 60%)' }}>10</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bonus Fight */}
              <AnimatePresence>
                {bonusFight && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'hsla(0, 0%, 0%, 0.92)' }}>
                    <div className="text-center">
                      <p className="font-heading font-extrabold text-2xl mb-1" style={{ color: 'hsl(0, 80%, 55%)' }}>🥊 BONUS FIGHT! 🥊</p>
                      <p className="font-heading font-extrabold text-4xl mb-2" style={{ color: 'hsl(45, 95%, 65%)' }}>{bonusFight.tier}!</p>
                      <p className="font-heading font-extrabold text-5xl" style={{ color: 'hsl(120, 60%, 50%)' }}>x{bonusFight.multiplier}</p>
                    </div>
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
              <span className="text-[10px] font-heading text-muted-foreground">Total Win</span>
              <motion.span className={`font-heading font-extrabold text-sm ${totalWin > 0 ? '' : 'text-muted-foreground'}`}
                style={totalWin > 0 ? { color: 'hsl(45, 90%, 60%)' } : {}}
                animate={totalWin > 0 ? { scale: [1, 1.15, 1] } : {}} key={totalWin}>
                ৳{totalWin.toLocaleString()}
              </motion.span>
            </div>
          </div>

          {/* Bottom Controls — Bet | Spin (center) | Turbo | Auto */}
          <div className="px-3 pb-3 space-y-2 mb-16">
            <div className="flex items-center justify-between gap-2">
              {/* Bet — left */}
              <div className="flex items-center gap-1 rounded-xl px-2 py-1.5 shrink-0" style={{ background: 'hsl(220, 35%, 12%)', border: '1px solid hsl(35, 50%, 30%)' }}>
                <span className="text-[10px] text-muted-foreground font-heading mr-1">BET</span>
                <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx > 0) setStake(stakeOptions[idx - 1]); }} disabled={spinning}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground font-bold text-sm disabled:opacity-50" style={{ background: 'hsl(220, 30%, 20%)' }}>−</button>
                <span className="min-w-[3rem] text-center font-heading font-bold text-sm" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{stake}</span>
                <button onClick={() => { sfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx < stakeOptions.length - 1) setStake(stakeOptions[idx + 1]); }} disabled={spinning}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground font-bold text-sm disabled:opacity-50" style={{ background: 'hsl(220, 30%, 20%)' }}>+</button>
              </div>
              {/* SPIN — center */}
              <motion.button onClick={() => { sfx.buttonClick(); if (autoSpin) { setAutoSpin(false); return; } performSpin(); }}
                disabled={spinning && !autoSpin}
                className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center disabled:opacity-70 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, hsl(120, 60%, 35%), hsl(120, 50%, 25%))',
                  border: '3px solid hsl(45, 70%, 45%)',
                  boxShadow: '0 0 20px hsla(120, 60%, 35%, 0.4)',
                }}
                whileTap={{ scale: 0.9 }}>
                <span className="font-heading font-extrabold text-primary-foreground text-xs">SPIN</span>
              </motion.button>
              {/* Turbo | Auto — right */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { sfx.buttonClick(); setTurboMode(!turboMode); }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-heading font-bold ${turboMode ? 'text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}
                  style={turboMode ? { background: 'linear-gradient(135deg, hsl(0, 70%, 45%), hsl(35, 80%, 45%))' } : {}}>
                  ⚡ TURBO
                </button>
                <button onClick={() => { sfx.buttonClick(); setAutoSpin(!autoSpin); if (!autoSpin && !spinning) { autoSpinRef.current = true; performSpin(); } }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-heading font-bold ${autoSpin ? 'bg-destructive text-destructive-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                  {autoSpin ? '⏹ Stop' : '🔄 Auto'}
                </button>
              </div>
            </div>
            <div className="flex justify-between px-3 py-1.5 rounded-xl" style={{ background: 'hsl(220, 40%, 10%)', border: '1px solid hsl(35, 50%, 25%)' }}>
              <span className="text-[10px] text-muted-foreground font-heading">BALANCE</span>
              <span className="font-heading font-bold text-sm" style={{ color: 'hsl(45, 90%, 60%)' }}>৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AuthGate>
  );
};

export default BoxingKingPixiGame;
