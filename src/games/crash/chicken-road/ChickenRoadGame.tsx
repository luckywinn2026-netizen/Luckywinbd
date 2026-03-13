import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import AuthGate from '@/components/AuthGate';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { playStepSound, playCrashSound, playCashOutSound, playBigWinSound, playStartSound } from './ChickenRoadSoundEngine';

/* ─── Types ─── */
type GamePhase = 'idle' | 'playing' | 'crashed' | 'cashed_out';

interface Cell {
  id: number;
  hasTrap: boolean;
  trapType: 'car' | 'taxi' | 'police' | 'truck';
  revealed: boolean;
  safe: boolean | null;
  multiplier: number;
}

/* ─── Single mode config (90% RTP, 20 cells, 10% trap) ─── */
const GAME_CONFIG = {
  cells: 20,
  trapChance: 0.10,
  startMulti: 1.02,
  endMulti: 120.0,
};

const TRAP_VEHICLES = ['car', 'taxi', 'police', 'truck'] as const;
const BET_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];

/* ─── Component ─── */
const ChickenRoadGame = () => {
  const navigate = useNavigate();
  const { balance, placeBet, addWin, logLoss } = useWallet();
  const { user } = useAuth();
  useActivePlayer('chicken-road', 'Lucky Chicken Road', 'crash', 0);

  const [stake, setStake] = useState(10);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [currentCell, setCurrentCell] = useState(-1);
  const [multiplier, setMultiplier] = useState(1.0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [history, setHistory] = useState<{ multi: number; won: boolean }[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const roadRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number }>({ outcome: 'loss', maxWinAmount: 0 });

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const cfg = GAME_CONFIG;

  /* ─── Generate cells ─── */
  const generateCells = useCallback((): Cell[] => {
    return Array.from({ length: cfg.cells }, (_, i) => {
      const multi = Number((cfg.startMulti * Math.pow(cfg.endMulti / cfg.startMulti, i / (cfg.cells - 1))).toFixed(2));
      return {
        id: i,
        hasTrap: Math.random() < cfg.trapChance,
        trapType: TRAP_VEHICLES[Math.floor(Math.random() * TRAP_VEHICLES.length)],
        revealed: false,
        safe: null,
        multiplier: multi,
      };
    });
  }, []);

  /* ─── Backend outcome ─── */
  const fetchOutcome = useCallback(async (betAmount: number) => {
    try {
      const data = await api.gameOutcome({ bet_amount: betAmount, game_type: 'crash', game_id: 'chicken-road' });
      return data;
    } catch { return null; }
  }, []);

  /* ─── Start game ─── */
  const startGame = useCallback(async () => {
    if (stake > balance) {
      toast.error('Insufficient balance!');
      return;
    }
    if (!placeBet(stake, 'Chicken Road', 'crash')) return;

    const outcome = await fetchOutcome(stake);
    outcomeRef.current = outcome || { outcome: 'loss', maxWinAmount: 0 };
    const newCells = generateCells();

    if (outcome && outcome.outcome === 'loss') {
      const crashCell = Math.floor(Math.random() * Math.min(3, newCells.length));
      newCells[crashCell].hasTrap = true;
    } else if (outcome && (outcome.outcome === 'big_win' || outcome.outcome === 'mega_win')) {
      const safeCells = outcome.outcome === 'mega_win' ? newCells.length : Math.floor(newCells.length * 0.7);
      for (let i = 0; i < safeCells; i++) newCells[i].hasTrap = false;
    }

    setCells(newCells);
    setCurrentCell(-1);
    setMultiplier(1.0);
    setWinAmount(0);
    setPhase('playing');
    setShowCelebration(false);
    if (soundOn) playStartSound();
  }, [stake, balance, placeBet, generateCells, fetchOutcome, soundOn]);

  /* ─── Advance chicken ─── */
  const advanceChicken = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const nextCell = currentCell + 1;

    if (nextCell >= cells.length) {
      const finalMulti = cells[cells.length - 1].multiplier;
      let win = Math.round(stake * finalMulti);
      let displayMult = finalMulti;
      const oc = outcomeRef.current;
      if (oc.maxWinAmount > 0 && win > oc.maxWinAmount) {
        win = Math.round(oc.maxWinAmount);
        displayMult = Math.round((win / stake) * 100) / 100;
      }
      setMultiplier(displayMult);
      setWinAmount(win);
      setPhase('cashed_out');
      addWin(win, 'Chicken Road', 'crash', displayMult, stake, 'chicken-road');
      setHistory(prev => [{ multi: finalMulti, won: true }, ...prev.slice(0, 19)]);
      if (soundOn) { finalMulti >= 5 ? playBigWinSound() : playCashOutSound(); }
      if (finalMulti >= 5) setShowCelebration(true);
      return;
    }

    const cell = cells[nextCell];

    if (cell.hasTrap) {
      setCurrentCell(nextCell);
      setCells(prev => prev.map((c, i) => i === nextCell ? { ...c, revealed: true, safe: false } : c));
      setPhase('crashed');
      logLoss(stake, 'Chicken Road', 'crash', 'chicken-road');
      setHistory(prev => [{ multi: multiplier, won: false }, ...prev.slice(0, 19)]);
      if (soundOn) playCrashSound();
    } else {
      const newMulti = cell.multiplier;
      setCurrentCell(nextCell);
      setMultiplier(newMulti);
      setCells(prev => prev.map((c, i) => i === nextCell ? { ...c, revealed: true, safe: true } : c));
      if (soundOn) playStepSound();
    }
  }, [currentCell, cells, multiplier, stake, addWin, logLoss, soundOn]);

  /* ─── Cash out ─── */
  const cashOut = useCallback(() => {
    if (phase !== 'playing' || currentCell < 0) return;
    let win = Math.round(stake * multiplier);
    let displayMult = multiplier;
    const oc = outcomeRef.current;
    if (oc.maxWinAmount > 0 && win > oc.maxWinAmount) {
      win = Math.round(oc.maxWinAmount);
      displayMult = Math.round((win / stake) * 100) / 100;
    }
    setWinAmount(win);
    setPhase('cashed_out');
    addWin(win, 'Chicken Road', 'crash', displayMult, stake, 'chicken-road');
    setHistory(prev => [{ multi: multiplier, won: true }, ...prev.slice(0, 19)]);
    if (soundOn) { multiplier >= 5 ? playBigWinSound() : playCashOutSound(); }
    if (multiplier >= 5) setShowCelebration(true);
  }, [phase, currentCell, stake, multiplier, addWin, soundOn]);

  // Auto-scroll to chicken position
  useEffect(() => {
    if (roadRef.current && currentCell >= 0) {
      // +1 for the start zone element
      const el = roadRef.current.children[currentCell + 2] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentCell]);

  const trapEmoji = (type: string) => {
    switch (type) {
      case 'car': return '🚗';
      case 'taxi': return '🚕';
      case 'police': return '🚓';
      case 'truck': return '🚛';
      default: return '🚗';
    }
  };

  const nextCellMulti = useMemo(() => {
    if (phase !== 'playing' || currentCell + 1 >= cells.length) return null;
    return cells[currentCell + 1]?.multiplier;
  }, [phase, currentCell, cells]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#2d2d2d] text-foreground flex flex-col select-none">
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-b border-white/5 z-20">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-heading font-black text-base sm:text-lg tracking-wider">
              <span className="text-primary">CHICKEN</span>
              <span className="mx-0.5">🐔</span>
              <span className="text-primary">ROAD</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundOn(!soundOn)} className="p-1.5 rounded-lg bg-white/5">
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </button>
            <div className="px-3 py-1 rounded-full bg-[#333] border border-white/10">
              <span className="text-sm font-bold text-primary">৳{balance.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ═══ History Ticker ═══ */}
        {history.length > 0 && (
          <div className="flex gap-1 px-3 py-1.5 overflow-x-auto scrollbar-none bg-[#222]">
            {history.map((h, i) => (
              <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                h.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {h.multi.toFixed(2)}x
              </span>
            ))}
          </div>
        )}

        {/* ═══ Road Game Area ═══ */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 relative flex items-center" style={{
            background: 'linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 30%, #4a4a4a 70%, #5a5a5a 100%)',
          }}>
            {/* Road markings */}
            {[18, 82].map(pct => (
              <div key={pct} className="absolute left-0 right-0 flex gap-6 justify-center pointer-events-none" style={{ top: `${pct}%` }}>
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="w-1 h-4 bg-white/30 rounded-full shrink-0" />
                ))}
              </div>
            ))}

            {/* Scrollable road content */}
            <div
              ref={roadRef}
              className="flex items-center gap-1 w-full overflow-x-auto scrollbar-none px-3 py-6 relative z-10"
            >
              {/* ── Start Zone ── */}
              <div className="shrink-0 flex flex-col items-center justify-center w-20 sm:w-24 gap-1">
                <div className="flex gap-1">
                  <span className="text-xl sm:text-2xl">🚧</span>
                  <span className="text-xl sm:text-2xl">🚧</span>
                </div>

                {/* Chicken only shows here when at start or idle */}
                {(currentCell < 0 || phase === 'idle') && (
                  <motion.div
                    className="relative"
                    animate={phase === 'playing' ? { y: [0, -4, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
                  >
                    <span className="text-5xl sm:text-6xl block">🐔</span>
                    <span className="absolute -left-4 -bottom-1 text-2xl">🪙</span>
                  </motion.div>
                )}

                {/* Multiplier badge at start */}
                <AnimatePresence mode="wait">
                  {phase === 'idle' && (
                    <motion.div
                      className="px-3 py-1 rounded-lg font-heading font-black text-sm text-muted-foreground"
                      style={{ background: '#444' }}
                    >
                      START
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Lane Divider ── */}
              <div className="shrink-0 flex flex-col gap-2 mx-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-1 h-4 bg-white/40 rounded-full" />
                ))}
              </div>

              {/* ── Cells (Manhole Covers) ── */}
              {cells.map((cell, i) => {
                const isNext = i === currentCell + 1 && phase === 'playing';
                const isPassed = cell.safe === true;
                const isCrashed = cell.safe === false;
                const isChickenHere = i === currentCell && (phase === 'playing' || phase === 'crashed' || phase === 'cashed_out');

                return (
                  <div key={cell.id} className="shrink-0 flex flex-col items-center gap-1 relative">
                    {/* Top: obstacle or barricade indicator */}
                    <div className="h-10 sm:h-12 flex items-center justify-center">
                      {isCrashed && (
                        <motion.div
                          initial={{ y: -40, opacity: 0, rotate: -10 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                          className="text-3xl sm:text-4xl"
                        >
                          {trapEmoji(cell.trapType)}
                        </motion.div>
                      )}
                      {isPassed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-xl"
                        >
                          🚧
                        </motion.div>
                      )}
                    </div>

                    {/* Manhole cover button */}
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => isNext && advanceChicken()}
                      disabled={!isNext}
                      className={`
                        w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-full flex items-center justify-center
                        font-heading font-black text-xs sm:text-sm relative overflow-hidden
                        transition-all duration-200 border-2
                        ${isPassed
                          ? 'bg-green-700/40 border-green-500/60 text-green-300 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                          : isCrashed
                          ? 'bg-red-700/40 border-red-500/60 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                          : isNext
                          ? 'bg-[#555] border-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] cursor-pointer active:scale-90'
                          : 'bg-[#3e3e3e] border-[#4a4a4a] text-[#777]'
                        }
                      `}
                    >
                      {/* Grate pattern */}
                      <div className="absolute inset-0 rounded-full pointer-events-none">
                        <div className="absolute inset-2 rounded-full border border-white/5" />
                        <div className="absolute inset-0 flex flex-col justify-center gap-[3px] px-3 opacity-15">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <div key={j} className="w-full h-[1px] bg-white" />
                          ))}
                        </div>
                      </div>

                      {/* Multiplier text */}
                      <span className="relative z-10">
                        {cell.multiplier.toFixed(2)}x
                      </span>

                      {/* Pulse ring for next cell */}
                      {isNext && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-primary"
                          animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      )}
                    </motion.button>

                    {/* Chicken on current cell */}
                    {isChickenHere && (
                      <motion.div
                        className="absolute -bottom-6 z-20"
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ 
                          x: 0, 
                          opacity: 1,
                          y: phase === 'crashed' ? [0, -8, 0] : [0, -3, 0],
                        }}
                        transition={{ 
                          x: { type: 'spring', stiffness: 300, damping: 20 },
                          y: { repeat: phase === 'playing' ? Infinity : 0, duration: 0.5 }
                        }}
                      >
                        <span className={`text-3xl sm:text-4xl block ${phase === 'crashed' ? 'grayscale' : ''}`}>
                          {phase === 'crashed' ? '💀' : '🐔'}
                        </span>
                      </motion.div>
                    )}

                    {/* Cell number */}
                    <span className="text-[9px] text-white/30 font-medium">{i + 1}</span>
                  </div>
                );
              })}

              {/* ── Finish / Golden Egg ── */}
              <div className="shrink-0 ml-2 flex flex-col items-center justify-center gap-1 w-16">
                <motion.div
                  className="text-4xl"
                  animate={{ y: [0, -3, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  🥚
                </motion.div>
                <span className="text-[10px] text-yellow-400 font-bold">GOLDEN EGG</span>
              </div>
            </div>

            {/* Crashed overlay */}
            <AnimatePresence>
              {phase === 'crashed' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.15 }}
                    className="text-[120px] sm:text-[180px]"
                  >
                    💥
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ═══ Bottom Control Panel ═══ */}
        <div className="bg-[#1e1e1e] border-t border-white/10 px-3 py-3">
          {phase === 'idle' && (
            <div className="space-y-2.5">
              <div className="flex gap-2 sm:gap-3 items-center">
                {/* Bet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center bg-[#333] rounded-lg overflow-hidden mb-1.5">
                    <button
                      onClick={() => setStake(BET_OPTIONS[0])}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[#444] text-muted-foreground active:bg-[#555] transition-colors"
                    >
                      MIN
                    </button>
                    <span className="px-3 text-sm font-bold text-white min-w-[48px] text-center">{stake}</span>
                    <button
                      onClick={() => setStake(BET_OPTIONS[BET_OPTIONS.length - 1])}
                      className="px-2 py-1.5 text-[11px] font-bold bg-[#444] text-muted-foreground active:bg-[#555] transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {BET_OPTIONS.slice(0, 5).map(b => (
                      <button
                        key={b}
                        onClick={() => setStake(b)}
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition-all ${
                          stake === b
                            ? 'bg-primary/20 border-primary/50 text-primary'
                            : 'bg-[#333] border-[#444] text-muted-foreground'
                        }`}
                      >
                        ৳{b}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {cfg.cells} cells • up to {cfg.endMulti}x
                  </p>
                </div>

                {/* Play */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={startGame}
                  disabled={stake > balance}
                  className="px-5 sm:px-8 py-5 sm:py-6 rounded-xl font-heading font-black text-lg sm:text-xl bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
                >
                  Play
                </motion.button>
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 bg-[#333] rounded-lg px-2 py-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground">Bet</span>
                <span className="text-xs font-bold text-white">৳{stake}</span>
              </div>
              <div className="flex items-center gap-1 bg-[#333] rounded-lg px-2 py-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground">Step</span>
                <span className="text-xs font-bold text-white">{currentCell + 1}/{cfg.cells}</span>
              </div>
              <div className="flex items-center gap-1 bg-[#333] rounded-lg px-2 py-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground">Multi</span>
                <span className="text-xs font-bold text-primary">{multiplier.toFixed(2)}x</span>
              </div>

              <div className="flex-1" />

              {currentCell >= 0 && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={cashOut}
                  className="px-4 sm:px-6 py-3 rounded-xl font-heading font-black text-sm sm:text-base shadow-lg shrink-0 transition-colors"
                  style={{ background: 'linear-gradient(135deg, #d4a017, #b8860b)', color: '#000' }}
                >
                  CASH OUT<br />
                  <span className="text-xs sm:text-sm">৳{Math.round(stake * multiplier)}</span>
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={advanceChicken}
                className="px-5 sm:px-8 py-3 rounded-xl font-heading font-black text-lg sm:text-xl bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20 shrink-0 transition-colors"
              >
                GO
              </motion.button>
            </div>
          )}

          {(phase === 'crashed' || phase === 'cashed_out') && (
            <div className="flex gap-2 items-center">
              <div className="flex-1 text-center">
                {phase === 'crashed' ? (
                  <p className="text-red-400 font-heading font-bold text-base sm:text-lg">
                    💥 CRASHED at {multiplier.toFixed(2)}x — Step {currentCell + 1}/{cfg.cells}
                  </p>
                ) : (
                  <p className="text-green-400 font-heading font-bold text-base sm:text-lg">
                    🎉 Won ৳{winAmount} at {multiplier.toFixed(2)}x
                  </p>
                )}
              </div>
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => setPhase('idle')}
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading font-black text-base sm:text-lg bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20 shrink-0 transition-colors"
              >
                Play Again
              </motion.button>
            </div>
          )}
        </div>

        {/* ═══ Big Win Celebration ═══ */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setShowCelebration(false)}
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12 }}
                className="text-center"
              >
                <motion.p
                  className="text-7xl mb-4"
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  🎉🐔🎉
                </motion.p>
                <p className="font-heading font-black text-4xl sm:text-5xl text-primary mb-2">
                  {multiplier >= 20 ? 'MEGA WIN!' : 'BIG WIN!'}
                </p>
                <motion.p
                  className="font-heading font-bold text-5xl sm:text-6xl text-green-400"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  +৳{winAmount}
                </motion.p>
                <p className="text-muted-foreground text-sm mt-3">{multiplier.toFixed(2)}x multiplier</p>
                <p className="text-muted-foreground/50 text-xs mt-4">Tap to close</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthGate>
  );
};

export default ChickenRoadGame;
