import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';

import { GBSymbol, ALL_SYMBOLS, NORMAL_SYMBOLS, BOOK, getSymbolById } from './engine/SymbolConfig';
import { generateGrid, ROWS, COLS, REEL_HEIGHTS, isCellActive, pickWeightedSymbol, Grid } from './engine/ReelEngine';
import { evaluateWins, findScatters, getWinPositionSet, WinResult } from './engine/WinEvaluator';
import { gbSfx } from './engine/SoundEngine';
import PaytableModal from '@/components/PaytableModal';
import { GOLDEN_BOOK_PAYTABLE } from '@/config/paytableConfigs';

// Symbol images
import bookImg from './assets/book.png';
import princessImg from './assets/princess.png';
import princeImg from './assets/prince.png';
import tigerImg from './assets/tiger.png';
import palaceImg from './assets/palace.png';
import roseImg from './assets/rose.png';
import symAImg from './assets/sym-a.png';
import symKImg from './assets/sym-k.png';
import symQImg from './assets/sym-q.png';
import symJImg from './assets/sym-j.png';
import sym10Img from './assets/sym-10.png';

const IMG_MAP: Record<string, string> = {
  book: bookImg, princess: princessImg, prince: princeImg,
  tiger: tigerImg, palace: palaceImg, rose: roseImg,
  ace: symAImg, king: symKImg, queen: symQImg, jack: symJImg, ten: sym10Img,
};

const getSymImg = (sym: GBSymbol) => IMG_MAP[sym.id] || sym10Img;

// ─── Spinning Icon Component ───
const SpinningIcon = ({
  sym, spinning, colIndex, rowIndex, turbo,
}: {
  sym: GBSymbol; spinning: boolean; colIndex: number; rowIndex: number; turbo: boolean;
}) => {
  const [displaySym, setDisplaySym] = useState<GBSymbol>(sym);
  const [animState, setAnimState] = useState<'idle' | 'cycling' | 'landed'>('idle');
  const finalRef = useRef<GBSymbol>(sym);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { finalRef.current = sym; }, [sym]);
  useEffect(() => {
    if (animState === 'idle' || animState === 'landed') setDisplaySym(sym);
  }, [sym]);

  useEffect(() => {
    if (spinning) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const colDelay = colIndex * (turbo ? 40 : 70);
      const spinDuration = (turbo ? 80 : 150) + colIndex * (turbo ? 25 : 40);

      const t1 = setTimeout(() => setAnimState('cycling'), colDelay);
      const t2 = setTimeout(() => {
        setDisplaySym(finalRef.current);
        setAnimState('landed');
        gbSfx.reelStop(colIndex);
      }, colDelay + spinDuration);

      timersRef.current = [t1, t2];
      return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
    } else {
      setDisplaySym(finalRef.current);
      if (animState !== 'idle') setAnimState('idle');
    }
  }, [spinning, colIndex, turbo]);

  useEffect(() => {
    if (animState !== 'cycling') return;
    const interval = turbo ? 60 : 80;
    const normalSyms = NORMAL_SYMBOLS;
    const timer = setInterval(() => {
      setDisplaySym(normalSyms[Math.floor(Math.random() * normalSyms.length)]);
    }, interval);
    return () => clearInterval(timer);
  }, [animState, turbo]);

  const animate = animState === 'cycling'
    ? { y: ['-60%', '60%'], opacity: [0.3, 0.8, 0.3], scale: 0.85 }
    : animState === 'landed'
      ? { y: ['-80%', '4%', '0%'], opacity: [0, 1, 1], scale: [0.85, 1.05, 1] }
      : { y: '0%', opacity: 1, scale: 1 };

  const transition: any = animState === 'cycling'
    ? { duration: turbo ? 0.15 : 0.2, repeat: Infinity, ease: 'linear' as const }
    : animState === 'landed'
      ? { duration: turbo ? 0.3 : 0.45, ease: [0.34, 1.56, 0.64, 1] as const, delay: rowIndex * 0.05 }
      : { duration: 0.2 };

  return (
    <motion.img
      src={getSymImg(displaySym)}
      alt={displaySym.label}
      draggable={false}
      className="absolute inset-0 w-full h-full object-contain p-[2px]"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4)) contrast(1.1) saturate(1.15)', imageRendering: 'crisp-edges' as any }}
      initial={false}
      animate={animate}
      transition={transition}
    />
  );
};

// ─── Coin Rain Effect ───
const CoinRain = ({ active, tier }: { active: boolean; tier: 'win' | 'bigwin' | 'megawin' }) => {
  const count = tier === 'megawin' ? 40 : tier === 'bigwin' ? 25 : 14;
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 1.2,
    dur: 1.2 + Math.random() * 1.5, size: tier === 'megawin' ? 14 + Math.random() * 10 : 8 + Math.random() * 8,
    wobble: (Math.random() - 0.5) * 60,
    emoji: ['🪙', '💰', '✨', '⭐'][i % 4],
  })), [tier]);
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {coins.map(c => (
        <motion.div key={c.id} className="absolute"
          style={{ left: `${c.x}%`, top: -30, fontSize: c.size }}
          initial={{ y: -30, opacity: 0, rotate: 0 }}
          animate={{ y: ['-10%', '120%'], opacity: [0, 1, 1, 0.5, 0], rotate: [0, 360], x: [0, c.wobble] }}
          transition={{ duration: c.dur, delay: c.delay, ease: 'easeIn' }}>
          {c.emoji}
        </motion.div>
      ))}
    </div>
  );
};

// ─── Win Particles (sparks) ───
const WinParticles = ({ active }: { active: boolean }) => {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i, angle: (i / 24) * 360,
    dist: 80 + Math.random() * 120, delay: Math.random() * 0.3,
    dur: 0.6 + Math.random() * 0.8, size: 2 + Math.random() * 4,
    color: ['hsl(45,95%,65%)', 'hsl(35,90%,55%)', 'hsl(25,85%,60%)', 'hsl(0,0%,100%)', 'hsl(30,100%,50%)'][i % 5],
  })), []);
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        return (
          <motion.div key={p.id} className="absolute rounded-full"
            style={{
              left: '50%', top: '50%', width: p.size, height: p.size, background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(rad) * p.dist, y: Math.sin(rad) * p.dist,
              opacity: [1, 1, 0], scale: [1, 0.5],
            }}
            transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }} />
        );
      })}
    </div>
  );
};

// ─── Count-Up Number ───
const CountUpNumber = ({ target, duration = 1.5 }: { target: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    const steps = 30;
    const inc = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(inc * step), target);
      setDisplay(current);
      if (step >= steps) clearInterval(timer);
    }, (duration * 1000) / steps);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{display.toLocaleString()}</>;
};

// ─── Main Game Component ───
const GoldenBookGame = () => {
  const navigate = useNavigate();
  const { balance, addWin, applyAuthoritativeBalance } = useWallet();
  const gameToast = useGameToast();

  const [stake, setStake] = useState(10);
  const [grid, setGrid] = useState<Grid>(() => generateGrid());
  const [spinning, setSpinning] = useState(false);
  const [reelsSpinning, setReelsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [winPositions, setWinPositions] = useState<Set<string>>(new Set());
  const [scatterPositions, setScatterPositions] = useState<Set<string>>(new Set());
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinMode, setFreeSpinMode] = useState(false);
  const [showFreeSpin, setShowFreeSpin] = useState(false);
  const [winTier, setWinTier] = useState<'none' | 'win' | 'bigwin' | 'megawin'>('none');
  const [showParticles, setShowParticles] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [turboMode, setTurboMode] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [muted, setMuted] = useState(false);

   // Gamble removed

  const autoSpinRef = useRef(false);
  const spinningRef = useRef(false);
  const spinCountRef = useRef(0);

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('golden-book', 'Lucky Golden Book', 'slot', stake);
  useEffect(() => { gbSfx.muted = muted; }, [muted]);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const stakeOptions = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];

  // ─── Perform Spin ───
  const performSpin = useCallback(async () => {
    if (spinningRef.current) return;

    if (!freeSpinMode) {
      if (balance < stake) {
        gameToast.error(`Low balance! You have ৳${balance.toLocaleString()}. Please deposit.`);
        return;
      }
    }

    spinningRef.current = true;
    spinCountRef.current++;
    gbSfx.spinStart();
    setSpinning(true);
    setReelsSpinning(true);
    setLastWin(0);
    setTotalWin(0);
    setWinPositions(new Set());
    setScatterPositions(new Set());
    setWinTier('none');
    setShowParticles(false);
    

    // Fire backend call and reel animation IN PARALLEL
    const outcomePromise = (
      freeSpinMode
        ? api.gameOutcome({ bet_amount: stake, game_type: 'slot', game_id: 'golden-book', is_free_spin: true })
        : api.sharedSlotSpin({ bet: stake, game_id: 'golden-book', game_name: 'Golden Book' })
    ).catch((error) => {
      console.error('Golden Book spin failed', error);
      throw error;
    });

    // Generate grid immediately
    const newGrid = generateGrid(freeSpinMode);
    setGrid(newGrid);

    // Wait for BOTH reel animation and backend response
    const spinTime = turboMode ? 120 : 200;
    let outcome: { outcome: string; maxWinAmount: number; newBalance?: number };
    try {
      [outcome] = await Promise.all([
        outcomePromise,
        new Promise(r => setTimeout(r, spinTime)),
      ]);
    } catch (error) {
      gameToast.error(error instanceof Error ? error.message : 'Spin failed');
      setReelsSpinning(false);
      setSpinning(false);
      spinningRef.current = false;
      return;
    }
    setReelsSpinning(false);

    if (outcome.outcome !== 'loss') {
      const pickSymbol = NORMAL_SYMBOLS[Math.floor(Math.random() * NORMAL_SYMBOLS.length)];
      const targetLength = outcome.outcome === 'mega_win' ? 5 : outcome.outcome === 'big_win' || outcome.outcome === 'medium_win' ? 4 : 3;
      for (let col = 0; col < targetLength; col++) {
        newGrid[0][col] = { ...pickSymbol };
      }
      setGrid(newGrid.map(row => row.map(cell => ({ ...cell }))));
    }

    // Evaluate wins
    const wins = evaluateWins(newGrid, stake);
    const scatters = findScatters(newGrid);

    // Show scatter positions
    if (scatters.length >= 3) {
      gbSfx.scatter();
      setScatterPositions(new Set(scatters.map(([r, c]) => `${r}-${c}`)));
    }

    // Use backend amount as authoritative — avoids mismatch
    let totalPayout = 0;
    if (outcome.maxWinAmount > 0 && wins.length > 0) {
      totalPayout = outcome.maxWinAmount;
    }
    const winMultiplier = totalPayout > 0 ? Math.round((totalPayout / stake) * 10) / 10 : 0;
    // If backend says win but grid has no matching symbols, no payout (no forced wins)

    // No win — instant reset
    if (totalPayout === 0 && scatters.length < 3) {
      if (!freeSpinMode) applyAuthoritativeBalance(outcome.newBalance ?? balance);
      if (freeSpinMode) {
        setFreeSpinsRemaining(prev => {
          const next = prev - 1;
          if (next <= 0) setFreeSpinMode(false);
          return next;
        });
      }
      setSpinning(false);
      spinningRef.current = false;
      // Auto-spin only for manual auto-spin; free spin auto-continue handled by useEffect
      if (autoSpinRef.current && !freeSpinMode) {
        setTimeout(() => performSpin(), 100);
      }
      return;
    }

    // Show win
    if (totalPayout > 0) {
      const winPosSet = getWinPositionSet(wins);
      setWinPositions(winPosSet);
      setLastWin(totalPayout);
      setTotalWin(totalPayout);
      if (freeSpinMode) addWin(totalPayout, 'Golden Book', 'slot', winMultiplier || 1, stake, 'golden-book');
      else applyAuthoritativeBalance(outcome.newBalance ?? balance);

      if (totalPayout >= stake * 20) {
        setWinTier('megawin');
        setShowParticles(true);
        gbSfx.winMega();
      } else if (totalPayout >= stake * 5) {
        setWinTier('bigwin');
        setShowParticles(true);
        gbSfx.winBig();
      } else {
        setWinTier('win');
        gbSfx.winSmall();
      }

    }

    // Free spins trigger
    if (scatters.length >= 3) {
      gbSfx.freeSpinTrigger();
      setFreeSpinMode(true);
      setFreeSpinsRemaining(prev => prev + 10);
      setShowFreeSpin(true);
      setTimeout(() => setShowFreeSpin(false), 500);
    } else if (freeSpinMode) {
      setFreeSpinsRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) setFreeSpinMode(false);
        return next;
      });
    }

    // Wait for win animation to finish before showing gamble
    const localWinTier = totalPayout >= stake * 20 ? 'megawin' : totalPayout >= stake * 5 ? 'bigwin' : 'win';
    const winAnimDuration = localWinTier === 'megawin' ? 600 : localWinTier === 'bigwin' ? 500 : 400;
    const waitTime = totalPayout > 0 ? winAnimDuration : (turboMode ? 50 : 150);
    await new Promise(r => setTimeout(r, waitTime));
    setShowParticles(false);
    setWinPositions(new Set());
    setWinTier('none');


    setSpinning(false);
    spinningRef.current = false;

    if (autoSpinRef.current && !freeSpinMode) {
      setTimeout(() => performSpin(), 100);
    }
  }, [stake, turboMode, freeSpinMode, addWin, applyAuthoritativeBalance, balance]);

  // Auto free spin trigger
  useEffect(() => {
    if (freeSpinMode && freeSpinsRemaining > 0 && !spinningRef.current && !showSplash) {
      const t = setTimeout(() => performSpin(), 200);
      return () => clearTimeout(t);
    }
  }, [freeSpinMode, freeSpinsRemaining, performSpin, showSplash]);

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="📕 Lucky Golden Book" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative"
        style={{ background: 'linear-gradient(180deg, hsl(30, 35%, 12%) 0%, hsl(25, 40%, 6%) 50%, hsl(35, 30%, 10%) 100%)' }}>

        {/* Ancient theme overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, hsl(45, 70%, 40%) 0%, transparent 60%)' }} />

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 relative z-10">
          <button onClick={() => navigate('/slots')} className="p-1.5">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1" />
          <PaytableModal gameName="Lucky Golden Book" betAmount={stake} {...GOLDEN_BOOK_PAYTABLE} />
          <button onClick={() => setMuted(!muted)} className="p-1.5 mr-1">
            {muted ? <VolumeX size={18} className="text-muted-foreground" /> : <Volume2 size={18} className="text-primary" />}
          </button>
          <div className="gold-border rounded-full px-2.5 py-0.5">
            <span className="text-xs font-heading font-bold text-primary">৳{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center pb-1 relative z-10">
          <h1 className="font-heading font-extrabold text-2xl tracking-wider"
            style={{
              background: 'linear-gradient(180deg, hsl(45, 100%, 70%) 0%, hsl(35, 90%, 50%) 40%, hsl(25, 80%, 35%) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px hsla(35, 80%, 30%, 0.6)) drop-shadow(0 0 12px hsla(45, 90%, 55%, 0.3))',
            }}>
            📕 GOLDEN BOOK
          </h1>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-[10px] font-heading text-muted-foreground">576 WAYS</span>
            <div className="h-[2px] w-20 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, hsl(45, 90%, 55%), transparent)' }} />
            <span className="text-[10px] font-heading text-muted-foreground">5×4 REELS</span>
          </div>
        </div>

        {/* Free Spin Bar */}
        {freeSpinMode && (
          <div className="px-3 mb-1 relative z-10">
            <motion.div className="text-center py-1 rounded-xl"
              style={{ background: 'linear-gradient(135deg, hsl(25, 50%, 15%), hsl(35, 40%, 12%))' }}
              animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <span className="text-xs font-heading text-primary">✨ FREE SPINS</span>
              <span className="ml-2 text-lg font-heading font-extrabold text-primary">{freeSpinsRemaining}</span>
            </motion.div>
          </div>
        )}

        {/* Game Grid — 4-3-4-3-4 pattern */}
        <div className="px-2 pb-1 flex-1 flex items-center justify-center relative z-10">
          <div className="rounded-2xl p-2 relative overflow-hidden w-full"
            style={{
              background: 'linear-gradient(180deg, hsl(30, 25%, 18%), hsl(25, 30%, 12%))',
              border: '2px solid hsl(35, 60%, 30%)',
              boxShadow: '0 0 30px hsla(45, 80%, 40%, 0.15), inset 0 0 20px rgba(0,0,0,0.4)',
            }}>
            <WinParticles active={showParticles} />
            <CoinRain active={showParticles} tier={winTier === 'none' ? 'win' : winTier} />

            <div className="grid grid-cols-5 gap-1 relative z-10">
              {Array.from({ length: COLS }, (_, ci) => {
                const reelHeight = REEL_HEIGHTS[ci];
                return (
                  <div key={ci} className="flex flex-col gap-1 justify-center"
                    style={{ paddingTop: reelHeight === 3 ? 'calc((100% + 4px) / 8)' : '0', paddingBottom: reelHeight === 3 ? 'calc((100% + 4px) / 8)' : '0' }}>
                    {Array.from({ length: reelHeight }, (_, ri) => {
                      const posKey = `${ri}-${ci}`;
                      const sym = grid[ri]?.[ci];
                      if (!sym) return null;

                      const isWin = winPositions.has(posKey);
                      const isScatter = scatterPositions.has(posKey);
                      const isBook = sym.isScatter;

                      return (
                        <div key={ri}
                          className={`relative overflow-hidden rounded-lg ${isWin ? 'z-20' : ''} ${isScatter ? 'z-20' : ''}`}
                          style={{
                            paddingBottom: '100%',
                            border: `1.5px solid ${isBook ? 'hsl(45, 70%, 45%)' : 'hsl(30, 40%, 25%)'}`,
                            boxShadow: isWin
                              ? '0 0 16px hsla(45, 90%, 55%, 0.8), 0 0 30px hsla(45, 80%, 50%, 0.3)'
                              : '0 1px 3px rgba(0,0,0,0.3)',
                            background: isBook
                              ? 'linear-gradient(135deg, hsl(35, 50%, 25%), hsl(25, 40%, 18%))'
                              : 'linear-gradient(180deg, hsl(30, 20%, 20%), hsl(25, 25%, 14%))',
                          }}>
                          <SpinningIcon
                            sym={sym}
                            spinning={reelsSpinning}
                            colIndex={ci}
                            rowIndex={ri}
                            turbo={turboMode}
                          />
                          {isWin && (
                            <>
                              <motion.div className="absolute inset-0 rounded-lg pointer-events-none"
                                animate={{ opacity: [0, 0.6, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                                style={{ background: 'radial-gradient(circle, hsla(45, 90%, 60%, 0.6), transparent)' }} />
                              <motion.div className="absolute inset-[-2px] rounded-lg pointer-events-none"
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                style={{ border: '2px solid hsl(45, 95%, 60%)', boxShadow: '0 0 8px hsl(45, 90%, 55%)' }} />
                              <motion.div className="absolute inset-0 pointer-events-none"
                                animate={{ scale: [1, 1.08, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }} />
                            </>
                          )}
                          {isScatter && (
                            <motion.div className="absolute inset-0 rounded-lg pointer-events-none"
                              animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.05, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ background: 'radial-gradient(circle, hsla(45, 100%, 50%, 0.5), transparent)', border: '2px solid hsl(45, 100%, 60%)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Small win - no overlay, just bottom bar shows amount */}

            {/* Big Win */}
            <AnimatePresence>
              {winTier === 'bigwin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
                  style={{ background: 'hsla(0, 0%, 0%, 0.88)' }}>
                  <CoinRain active tier="bigwin" />
                  <motion.div className="text-center relative z-10" initial={{ scale: 0, y: 30 }}
                    animate={{ scale: [0, 1.3, 1], y: [30, -5, 0] }} transition={{ duration: 0.6 }}>
                    <motion.p className="font-heading font-extrabold text-4xl mb-2"
                      animate={{ color: ['hsl(45,90%,60%)', 'hsl(35,85%,50%)', 'hsl(45,90%,60%)'], textShadow: ['0 0 20px hsla(45,90%,55%,0.6)', '0 0 40px hsla(45,90%,55%,0.9)', '0 0 20px hsla(45,90%,55%,0.6)'] }}
                      transition={{ duration: 0.8, repeat: Infinity }}>
                      📕 BIG WIN! 📕
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-5xl gold-text"
                      animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                      ৳<CountUpNumber target={totalWin} duration={1.5} />
                    </motion.p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mega Win */}
            <AnimatePresence>
              {winTier === 'megawin' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
                  style={{ background: 'hsla(0, 0%, 0%, 0.92)' }}>
                  <CoinRain active tier="megawin" />
                  {/* Radial light burst */}
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 50%, hsla(45, 90%, 55%, 0.15), transparent 70%)' }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  {/* Confetti sparks */}
                  {Array.from({ length: 30 }, (_, i) => (
                    <motion.div key={i} className="absolute rounded-full"
                      style={{
                        width: 3 + Math.random() * 5, height: 3 + Math.random() * 5,
                        background: ['hsl(45,95%,60%)', 'hsl(0,90%,60%)', 'hsl(280,90%,65%)', 'hsl(120,80%,55%)', 'hsl(200,90%,60%)'][i % 5],
                        left: '50%', top: '50%',
                      }}
                      animate={{
                        x: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 300],
                        y: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 350],
                        opacity: [0, 1, 1, 0], rotate: [0, 720],
                      }}
                      transition={{ duration: 2.5 + Math.random(), repeat: Infinity, delay: Math.random() * 2 }}
                    />
                  ))}
                  <motion.div className="text-center relative z-10" initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: [0, 1.4, 1], rotate: [-15, 5, 0] }} transition={{ duration: 0.7 }}>
                    <motion.p className="font-heading font-extrabold text-5xl mb-2"
                      animate={{ color: ['hsl(45,95%,65%)', 'hsl(30,95%,55%)', 'hsl(0,90%,60%)', 'hsl(45,95%,65%)'] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ textShadow: '0 0 30px hsla(45, 90%, 60%, 0.8), 0 0 60px hsla(45, 80%, 50%, 0.4)' }}>
                      ✨ MEGA WIN! ✨
                    </motion.p>
                    <motion.p className="font-heading font-extrabold text-7xl gold-text"
                      animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      ৳<CountUpNumber target={totalWin} duration={2} />
                    </motion.p>
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
                      style={{ color: 'hsl(45, 90%, 60%)', textShadow: '0 0 15px hsla(45, 90%, 60%, 0.5)' }}
                      animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                      📕 FREE SPINS! 📕
                    </motion.p>
                    <motion.p className="text-primary font-heading font-extrabold text-6xl"
                      initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}>
                      10
                    </motion.p>
                    <motion.p className="text-sm text-muted-foreground mt-3 font-heading"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      3+ Scatter = Retrigger!
                    </motion.p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Gamble removed */}

        {/* Bottom Controls */}
        <div className="px-3 pb-3 space-y-2 mb-16 relative z-10">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] text-muted-foreground font-heading">WIN</span>
            <motion.span className={`font-heading font-extrabold text-sm ${totalWin > 0 ? 'text-primary' : 'text-muted-foreground'}`}
              animate={totalWin > 0 ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }} key={totalWin}>
              ৳{totalWin.toLocaleString()}
            </motion.span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1 bg-secondary/50 rounded-xl px-2 py-1.5">
                <span className="text-[10px] text-muted-foreground font-heading mr-1">Bet</span>
                <button onClick={() => { gbSfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx > 0) setStake(stakeOptions[idx - 1]); }}
                  disabled={spinning}
                  className="w-7 h-7 rounded-lg bg-card flex items-center justify-center text-foreground font-bold text-sm active:scale-90 transition-transform disabled:opacity-50">−</button>
                <span className="flex-1 text-center font-heading font-bold text-sm text-primary">৳{stake}</span>
                <button onClick={() => { gbSfx.buttonClick(); const idx = stakeOptions.indexOf(stake); if (idx < stakeOptions.length - 1) setStake(stakeOptions[idx + 1]); }}
                  disabled={spinning}
                  className="w-7 h-7 rounded-lg bg-card flex items-center justify-center text-foreground font-bold text-sm active:scale-90 transition-transform disabled:opacity-50">+</button>
              </div>
            </div>

            <motion.button onClick={() => { gbSfx.buttonClick(); if (autoSpin) { setAutoSpin(false); return; } performSpin(); }}
              disabled={spinning && !autoSpin}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, hsl(35, 85%, 50%), hsl(25, 80%, 40%))' }}
              whileTap={{ scale: 0.9 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(40, 90%, 55%), hsl(30, 85%, 45%))' }}>
                <span className="font-heading font-extrabold text-primary-foreground text-xs">
                  {spinning ? '...' : 'SPIN'}
                </span>
              </div>
            </motion.button>

            <div className="flex-1 flex justify-end gap-1">
              <button onClick={() => { gbSfx.buttonClick(); setTurboMode(!turboMode); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold transition-colors ${turboMode ? 'gold-gradient text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                ⚡ Turbo
              </button>
              <button onClick={() => { gbSfx.buttonClick(); setAutoSpin(!autoSpin); if (!autoSpin && !spinning) { autoSpinRef.current = true; performSpin(); } }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-heading font-bold transition-colors ${autoSpin ? 'bg-destructive text-destructive-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                {autoSpin ? '⏹ Stop' : '🔄 Auto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default GoldenBookGame;
