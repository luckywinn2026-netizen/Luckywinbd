import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import PaytableModal from '@/components/PaytableModal';
import { SPIN_WHEEL_PAYTABLE } from '@/config/paytableConfigs';
import { playTick, playSpinStart, playLand, playWinCelebration, playLoss } from './LuckySpinSoundEngine';

// ─── Segment config (matching reference image) ───
interface Segment {
  label: string;
  multiplier: number;
  icon: string;
  color: string;
  weight: number;
}

const SEGMENTS: Segment[] = [
  { label: 'x2',   multiplier: 2,    icon: '⭐', color: 'hsl(130, 55%, 38%)', weight: 22 },
  { label: 'x50',  multiplier: 50,   icon: '👑', color: 'hsl(45, 80%, 42%)',  weight: 0 },  // bait — never lands
  { label: 'x5',   multiplier: 5,    icon: '🍀', color: 'hsl(130, 60%, 32%)', weight: 12 },
  { label: 'x10',  multiplier: 10,   icon: '💎', color: 'hsl(130, 55%, 38%)', weight: 6 },
  { label: 'x500', multiplier: 500,  icon: '🔥', color: 'hsl(0, 70%, 45%)',   weight: 0 },  // bait — never lands
  { label: 'x5',   multiplier: 5,    icon: '🎁', color: 'hsl(130, 60%, 32%)', weight: 12 },
  { label: 'x0',   multiplier: 0,    icon: '💀', color: 'hsl(130, 55%, 38%)', weight: 32 },
  { label: 'x20',  multiplier: 20,   icon: '🏆', color: 'hsl(280, 50%, 40%)', weight: 2 },
  { label: 'x10',  multiplier: 10,   icon: '❤️', color: 'hsl(130, 60%, 32%)', weight: 6 },
  { label: 'x50',  multiplier: 50,   icon: '💰', color: 'hsl(45, 80%, 42%)',  weight: 0 },  // bait — never lands
  { label: 'x2',   multiplier: 2,    icon: '🌟', color: 'hsl(130, 55%, 38%)', weight: 22 },
  { label: 'x12',  multiplier: 12,   icon: '💠', color: 'hsl(130, 60%, 32%)', weight: 4 },
];

const NUM = SEGMENTS.length;
const SEG_ANGLE = 360 / NUM;

// Map backend multiplier to a matching segment index
const multiplierToSegment = (multiplier: number): number => {
  if (multiplier <= 0) return 6; // x0 (loss)
  // Find all segments with matching multiplier and pick one randomly
  const matches = SEGMENTS
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.multiplier === multiplier);
  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)].i;
  }
  // Fallback: find closest multiplier (never bait segments with weight 0)
  const validSegs = SEGMENTS
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.weight > 0 && seg.multiplier > 0);
  validSegs.sort((a, b) => Math.abs(a.seg.multiplier - multiplier) - Math.abs(b.seg.multiplier - multiplier));
  return validSegs[0]?.i ?? 6;
};

// ─── Fake game history data ───
const FAKE_NAMES = [
  'Rahim_77', 'Sakib★', 'TigerBD', 'Nisha✨', 'Arif_Pro', 'JoyBD', 'Rumi❤️',
  'King_Farhan', 'Mitu_88', 'Sumon💎', 'Fahim_X', 'Liza_BD', 'Rocky★', 'Tania_99',
  'Shanto_Pro', 'Jannat✨', 'Kabir_77', 'Puja💰', 'Hero_BD', 'Moyna_11',
  'Shakil★', 'Riya_BD', 'Nasir_Pro', 'Lemon✨', 'Rubel_88', 'Sumi💎',
];
const FAKE_GAMES = ['Lucky Spin'];
const WIN_TYPES: { label: string; color: string; minBet: number; maxBet: number; minMul: number; maxMul: number }[] = [
  { label: 'WIN', color: 'hsl(130, 60%, 50%)', minBet: 50, maxBet: 200, minMul: 2, maxMul: 5 },
  { label: 'BIG WIN', color: 'hsl(45, 90%, 55%)', minBet: 100, maxBet: 500, minMul: 5, maxMul: 15 },
  { label: 'MEGA WIN', color: 'hsl(0, 80%, 55%)', minBet: 200, maxBet: 1000, minMul: 15, maxMul: 50 },
];

let fakeIdCounter = 0;
const generateOneEntry = () => {
  const wt = WIN_TYPES[Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2];
  const bet = Math.round((wt.minBet + Math.random() * (wt.maxBet - wt.minBet)) / 10) * 10;
  const mul = wt.minMul + Math.random() * (wt.maxMul - wt.minMul);
  const win = Math.round(bet * mul);
  return {
    id: fakeIdCounter++,
    name: FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)],
    game: 'Lucky Spin',
    winLabel: wt.label,
    winColor: wt.color,
    amount: win,
    timeAgo: `${Math.floor(1 + Math.random() * 58)}m ago`,
  };
};
const generateFakeHistory = () => Array.from({ length: 20 }, () => generateOneEntry());

const LuckySpinGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Segment | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number; size: number; emoji: string }[]>([]);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinningRef = useRef(false);
  const [fakeHistory, setFakeHistory] = useState(() => generateFakeHistory());

  // Auto-add new entry every 3-6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFakeHistory(prev => [generateOneEntry(), ...prev.slice(0, 19)]);
    }, 3000 + Math.random() * 3000);
    return () => clearInterval(timer);
  }, []);
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);

  useActivePlayer('lucky-spin', 'Lucky Spin', 'slot', betAmount);

  const spin = useCallback(async () => {
    if (spinningRef.current || spinning || !user) return;
    if (betAmount < 10) { gameToast.error('Minimum bet ৳10'); return; }
    if (betAmount > balance) { gameToast.error('Insufficient balance!'); return; }

    spinningRef.current = true;
    setSpinning(true);
    setResult(null);
    setWinAmount(0);
    playSpinStart();

    // Tick sound loop
    let tickCount = 0;
    let tickSpeed = 60;
    const startTicks = () => {
      tickTimerRef.current = setInterval(() => {
        tickCount++;
        playTick(1 + Math.random() * 0.2);
        if (tickCount > 15) tickSpeed = 120;
        if (tickCount > 25) tickSpeed = 200;
        if (tickCount > 35) tickSpeed = 350;
        if (tickCount > 40) {
          if (tickTimerRef.current) clearInterval(tickTimerRef.current);
          return;
        }
        if (tickTimerRef.current) clearInterval(tickTimerRef.current);
        tickTimerRef.current = setInterval(() => {
          playTick(1 + Math.random() * 0.15);
          tickCount++;
          if (tickCount > 40 && tickTimerRef.current) clearInterval(tickTimerRef.current);
        }, tickSpeed);
      }, tickSpeed);
    };
    startTicks();

    // Start wheel spinning immediately — don't wait for API
    const prelimSpins = 2 + Math.floor(Math.random() * 2);
    setRotation(prev => prev + prelimSpins * 360);

    let serverOutcome: { outcome: string; maxWinAmount: number; multiplier?: number; newBalance: number } = { outcome: 'loss', maxWinAmount: 0, multiplier: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: betAmount, game_id: 'lucky-spin', game_name: 'Lucky Spin' });
      if (data) serverOutcome = data;
    } catch (e) {
      console.error('game-outcome failed:', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      spinningRef.current = false;
      setSpinning(false);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      return;
    }

    // Backend returns exact multiplier for Lucky Spin
    const serverMultiplier = serverOutcome.multiplier ?? 0;
    const idx = multiplierToSegment(serverMultiplier);
    const seg = SEGMENTS[idx];
    const actualWin = serverMultiplier > 0 ? Math.round(betAmount * serverMultiplier) : 0;

    const targetAngle = 360 - (idx * SEG_ANGLE + SEG_ANGLE / 2);
    const fullSpins = 5 + Math.floor(Math.random() * 4);
    const totalRotation = rotation + fullSpins * 360 + targetAngle - (rotation % 360);
    setRotation(totalRotation);

    setTimeout(() => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      playLand();
      spinningRef.current = false;
      setSpinning(false);
      setResult(seg);
      setWinAmount(actualWin);
      applyAuthoritativeBalance(serverOutcome.newBalance);

      if (actualWin > 0) {
        setTimeout(() => playWinCelebration(serverMultiplier >= 10), 300);
        const emojis = ['🪙', '💰', '✨', '🍀', '💎'];
        setCoins(Array.from({ length: 30 }, (_, i) => ({
          id: i, x: Math.random() * 100, delay: Math.random() * 0.8,
          size: 16 + Math.random() * 20, emoji: emojis[Math.floor(Math.random() * emojis.length)],
        })));
        setShowWinPopup(true);
        setTimeout(() => { setShowWinPopup(false); setCoins([]); }, 800);
      } else {
        setTimeout(() => playLoss(), 200);
      }
    }, 1200);
  }, [spinning, user, betAmount, balance, rotation, applyAuthoritativeBalance]);

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🍀 Lucky Spin" onComplete={handleLoadingComplete} />

      <div className="h-screen flex flex-col overflow-hidden" style={{
        background: 'radial-gradient(ellipse at center, hsl(130, 60%, 18%) 0%, hsl(130, 50%, 8%) 70%, hsl(130, 40%, 4%) 100%)',
      }}>
        {/* Header — like other slots */}
        <div className="flex items-center gap-3 p-4 pt-2">
          <button onClick={() => navigate('/slots')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="font-heading font-bold text-lg gold-text">🍀 Lucky Spin</h1>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Spin" betAmount={betAmount} {...SPIN_WHEEL_PAYTABLE} />
            <div className="gold-border rounded-full px-3 py-1">
              <span className="text-sm font-heading font-bold">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Coin rain */}
        <AnimatePresence>
          {coins.map(c => (
            <motion.div key={c.id} className="fixed pointer-events-none z-50"
              style={{ left: `${c.x}%`, top: '-40px', fontSize: c.size }}
              initial={{ y: -50, opacity: 1, rotate: 0 }}
              animate={{ y: '110vh', opacity: 0, rotate: 720 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, delay: c.delay, ease: 'easeIn' }}>
              {c.emoji}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Centered wheel + base + bet panel */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Wheel container — clips bottom half */}
          <div className="relative w-full flex justify-center" style={{ height: '230px', overflow: 'hidden' }}>
            {/* Ambient glow */}
            <div className="absolute z-0" style={{
              width: '440px', height: '440px', top: '-20px',
              background: 'radial-gradient(circle, hsl(40, 90%, 50%, 0.15) 0%, transparent 60%)',
              borderRadius: '50%',
              left: '50%', transform: 'translateX(-50%)',
            }} />

            {/* Pointer at top */}
            <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 z-30">
              <div style={{
                width: 0, height: 0,
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: '28px solid hsl(40, 90%, 55%)',
                filter: 'drop-shadow(0 0 8px hsl(40, 90%, 50%)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }} />
            </div>

            {/* Full wheel positioned so only top half shows */}
            <div className="absolute z-10" style={{ width: '380px', height: '380px', top: '5px' }}>
              <div className="absolute inset-0 rounded-full" style={{
                background: 'conic-gradient(from 0deg, hsl(38, 60%, 45%), hsl(45, 80%, 60%), hsl(38, 60%, 45%), hsl(45, 80%, 60%), hsl(38, 60%, 45%), hsl(45, 80%, 60%), hsl(38, 60%, 45%))',
                padding: '10px',
                boxShadow: '0 0 50px hsl(40, 80%, 50%, 0.3), 0 15px 40px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3)',
              }}>
                <div className="w-full h-full rounded-full overflow-hidden relative" style={{
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
                }}>
                  <svg viewBox="0 0 200 200" className="w-full h-full" style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: 'transform 1.2s cubic-bezier(0.12, 0.6, 0.08, 1)',
                  }}>
                    <defs>
                      <radialGradient id="lsSegShadow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
                      </radialGradient>
                    </defs>
                    {SEGMENTS.map((seg, i) => {
                      const startA = i * SEG_ANGLE;
                      const endA = startA + SEG_ANGLE;
                      const sR = (startA - 90) * (Math.PI / 180);
                      const eR = (endA - 90) * (Math.PI / 180);
                      const x1 = 100 + 95 * Math.cos(sR);
                      const y1 = 100 + 95 * Math.sin(sR);
                      const x2 = 100 + 95 * Math.cos(eR);
                      const y2 = 100 + 95 * Math.sin(eR);
                      const midA = ((startA + endA) / 2 - 90) * (Math.PI / 180);
                      const tX = 100 + 72 * Math.cos(midA);
                      const tY = 100 + 72 * Math.sin(midA);
                      const lX = 100 + 52 * Math.cos(midA);
                      const lY = 100 + 52 * Math.sin(midA);
                      const textAngle = (startA + endA) / 2;
                      return (
                        <g key={i}>
                          <path d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                            fill={seg.color} stroke="hsl(40, 70%, 40%)" strokeWidth="0.8" />
                          <path d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                            fill="url(#lsSegShadow)" opacity="0.2" />
                          <text x={tX} y={tY} textAnchor="middle" dominantBaseline="middle"
                            transform={`rotate(${textAngle}, ${tX}, ${tY})`}
                            style={{ fontSize: '16px' }}>{seg.icon}</text>
                          <text x={lX} y={lY} textAnchor="middle" dominantBaseline="middle"
                            transform={`rotate(${textAngle}, ${lX}, ${lY})`}
                            fill="white" fontWeight="800" fontFamily="'Exo 2', sans-serif"
                            style={{ fontSize: '8px', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{seg.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* TAP button with golden arch — like reference image */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-20" style={{ marginTop: '-8px' }}>
                {/* Golden arch behind */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[72px] h-[80px] rounded-t-[36px]" style={{
                  background: 'linear-gradient(180deg, hsl(40, 85%, 55%) 0%, hsl(35, 70%, 40%) 60%, hsl(25, 50%, 28%) 100%)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  border: '2px solid hsl(40, 80%, 60%)',
                  borderBottom: 'none',
                }} />
                <button type="button" onClick={spin} disabled={spinning}
                  className="relative z-10 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70"
                  style={{
                    background: spinning
                      ? 'radial-gradient(circle at 40% 35%, hsl(130, 40%, 45%), hsl(130, 50%, 25%))'
                      : 'radial-gradient(circle at 40% 35%, hsl(130, 70%, 60%), hsl(130, 60%, 35%))',
                    border: '3px solid hsl(40, 80%, 55%)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.3), 0 0 15px hsl(130, 60%, 40%, 0.3)',
                  }}>
                  <span className="font-heading font-black text-white text-base" style={{
                    textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                  }}>{spinning ? '...' : 'TAP'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Wooden base — covers bottom half of wheel */}
          <div className="relative z-20 w-full flex justify-center" style={{ marginTop: '-4px' }}>
            <div className="relative" style={{
              width: '100%', maxWidth: '420px', height: '60px',
              background: 'linear-gradient(180deg, hsl(25, 50%, 28%) 0%, hsl(20, 45%, 18%) 50%, hsl(18, 40%, 12%) 100%)',
              borderRadius: '0 0 20px 20px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), inset 0 2px 0 hsl(30, 50%, 35%), inset 0 -2px 4px rgba(0,0,0,0.3)',
              borderTop: '3px solid hsl(35, 55%, 40%)',
            }}>
              {/* Wood grain lines */}
              <div className="absolute inset-0 overflow-hidden rounded-b-[20px]" style={{ opacity: 0.08 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="absolute w-full" style={{
                    height: '1px', top: `${12 + i * 10}px`,
                    background: 'linear-gradient(90deg, transparent 5%, hsl(30, 40%, 50%) 30%, hsl(30, 40%, 50%) 70%, transparent 95%)',
                  }} />
                ))}
              </div>
              {/* Coin & Gem counters */}
              <div className="absolute inset-0 flex items-center justify-between px-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🪙</span>
                  <span className="font-heading font-bold text-sm" style={{
                    color: 'hsl(45, 90%, 65%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}>৳{balance.toLocaleString()}</span>
                </div>
                <span className="font-heading font-black text-xs tracking-widest" style={{
                  color: 'hsl(40, 80%, 55%)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}>🍀</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">💎</span>
                  <span className="font-heading font-bold text-sm" style={{
                    color: 'hsl(200, 80%, 70%)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}>{winAmount > 0 ? `+${winAmount.toLocaleString()}` : '0'}</span>
                </div>
              </div>
              {/* Corner nails */}
              {[16, -16].map((x, i) => (
                <div key={i} className="absolute top-3 w-3 h-3 rounded-full" style={{
                  [i === 0 ? 'left' : 'right']: '16px',
                  background: 'radial-gradient(circle at 35% 35%, hsl(40, 70%, 65%), hsl(35, 50%, 30%))',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
              ))}
            </div>
          </div>

          {/* Win overlay on wheel area */}
          <AnimatePresence>
            {winAmount > 0 && !spinning && !showWinPopup && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute top-[60px] left-0 right-0 flex items-center justify-center z-30 pointer-events-none" style={{ height: '200px' }}>
                <div className="text-center">
                  <p className="text-success font-heading font-extrabold text-3xl">🎉 WIN!</p>
                  <p className="font-heading font-bold text-2xl gold-text">৳{winAmount.toLocaleString()}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet controls — gold bordered, attached to wooden base */}
          <div className="relative z-20 w-full flex justify-center" style={{ marginTop: '6px' }}>
            <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl" style={{
              background: 'linear-gradient(180deg, hsl(25, 40%, 16%) 0%, hsl(20, 35%, 10%) 100%)',
              border: '1.5px solid hsl(40, 70%, 45%)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 hsl(30, 40%, 25%)',
              maxWidth: '380px', width: '100%',
            }}>
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 min-w-[80px]" style={{
                background: 'hsl(20, 30%, 12%)',
                border: '1px solid hsl(40, 50%, 30%)',
              }}>
                <span className="text-[10px] font-bold" style={{ color: 'hsl(40, 80%, 60%)' }}>৳</span>
                <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-sm text-foreground font-heading outline-none"
                  disabled={spinning} />
              </div>
            </div>
          </div>

          {/* Fake game history — right after bet panel */}
          <div className="w-full px-4 pt-2">
            <p className="text-[10px] font-heading font-bold mb-1.5 tracking-wider" style={{ color: 'hsl(40, 70%, 55%)' }}>
              🏆 RECENT WINNERS
            </p>
            <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: '180px', contain: 'layout style' }}>
              {fakeHistory.map(h => {
                const avatarColors = ['hsl(40,70%,50%)', 'hsl(130,50%,40%)', 'hsl(200,60%,50%)', 'hsl(280,50%,50%)', 'hsl(0,60%,50%)'];
                const avatarColor = avatarColors[h.name.charCodeAt(0) % avatarColors.length];
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-1 animate-fade-in"
                    style={{
                      background: 'hsl(130, 40%, 10%)',
                      border: '1px solid hsl(130, 30%, 18%)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ background: avatarColor }}>
                        {h.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-heading font-bold text-foreground truncate max-w-[70px]">{h.name}</span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[55px]">{h.game}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-heading font-black px-1.5 py-0.5 rounded" style={{
                        color: 'white', background: h.winColor,
                      }}>{h.winLabel}</span>
                      <span className="text-xs font-heading font-bold" style={{ color: 'hsl(45, 90%, 65%)' }}>
                        ৳{h.amount.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{h.timeAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom space */}
        <div className="h-2 shrink-0" />
        <AnimatePresence>
          {showWinPopup && winAmount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              onClick={() => setShowWinPopup(false)}
            >
              <div className="absolute inset-0 bg-black/60" />
              <motion.div className="relative rounded-3xl p-8 text-center" style={{
                background: 'linear-gradient(135deg, hsl(130, 50%, 25%), hsl(130, 60%, 15%))',
                border: '3px solid hsl(40, 80%, 55%)',
                boxShadow: '0 0 60px hsl(40, 80%, 50%, 0.3), 0 20px 60px rgba(0,0,0,0.5)',
              }}
                initial={{ y: 50 }} animate={{ y: 0 }}>
                <p className="text-6xl mb-3">🍀</p>
                <p className="font-heading font-black text-3xl mb-1" style={{ color: 'hsl(40, 90%, 60%)' }}>WIN!</p>
                <p className="font-heading font-bold text-4xl" style={{ color: 'hsl(45, 100%, 70%)' }}>৳{winAmount.toLocaleString()}</p>
                {result && (
                  <p className="font-heading text-sm mt-2" style={{ color: 'hsl(130, 40%, 70%)' }}>
                    {result.icon} {result.label} Multiplier
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthGate>
  );
};

export default LuckySpinGame;
