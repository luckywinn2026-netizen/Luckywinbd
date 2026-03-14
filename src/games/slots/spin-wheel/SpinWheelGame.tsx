import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import { playTick, playSpinStart, playLand, playWinCelebration, playLoss } from './SpinWheelSoundEngine';

// ─── Segment config ───
interface Segment {
  label: string;
  multiplier: number;
  icon: string;
  weight: number;
}

const SEGMENTS: Segment[] = [
  { label: '1.5x',     multiplier: 1.5,  icon: '💎', weight: 22 },
  { label: '0x',       multiplier: 0,    icon: '💀', weight: 28 },
  { label: '2x',       multiplier: 2,    icon: '🔥', weight: 18 },
  { label: '50x',      multiplier: 50,   icon: '💎', weight: 0 },   // never lands — display only
  { label: '0x',       multiplier: 0,    icon: '😢', weight: 28 },
  { label: '10x',      multiplier: 10,   icon: '🏆', weight: 3 },
  { label: '0.5x',     multiplier: 0.5,  icon: '🎯', weight: 20 },
  { label: '500x',     multiplier: 500,  icon: '👑', weight: 0 },   // never lands — display only
  { label: '5x',       multiplier: 5,    icon: '⭐', weight: 10 },
  { label: 'Jackpot',  multiplier: 100,  icon: '🔥', weight: 0.5 },
];

const NUM = SEGMENTS.length;
const SEG_ANGLE = 360 / NUM;
const NUM_BULBS = 40;

const FAKE_NAMES = ['Rafiq★', 'JoyBD', 'Sultan99', 'MasterX', 'LuckyAli', 'TigerKhan', 'Boss786', 'KingBD', 'ProPlayer', 'AceBet'];

// Map server outcome to a segment index
const outcomeToSegment = (outcome: string, maxWinAmount: number, betAmount: number): number => {
  if (outcome === 'loss') return Math.random() < 0.5 ? 1 : 4; // 0x segments
  const multiplier = betAmount > 0 ? maxWinAmount / betAmount : 0;
  if (multiplier >= 25) return 9;       // Jackpot
  if (multiplier >= 7) return 5;        // 10x
  if (multiplier >= 3.5) return 8;      // 5x
  if (multiplier >= 1.8) return 2;      // 2x
  if (multiplier >= 1) return 0;        // 1.5x
  return 6;                             // 0.5x
};

const pickWeighted = (): number => {
  const total = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < NUM; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 1;
};

// ─── LED Bulb ring component ───
const LedBulbs = ({ spinning }: { spinning: boolean }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setTick(t => t + 1), 200);
    return () => clearInterval(id);
  }, [spinning]);

  return (
    <>
      {Array.from({ length: NUM_BULBS }).map((_, i) => {
        const angle = (i / NUM_BULBS) * 360;
        const rad = (angle - 90) * (Math.PI / 180);
        const r = 97;
        const cx = 100 + r * Math.cos(rad);
        const cy = 100 + r * Math.sin(rad);
        const isLit = spinning ? (i + tick) % 3 === 0 : i % 2 === 0;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r="2"
            fill={isLit ? 'hsl(45, 100%, 85%)' : 'hsl(30, 40%, 35%)'}
            style={{
              filter: isLit ? 'drop-shadow(0 0 3px hsl(45, 100%, 70%))' : 'none',
              transition: 'fill 0.15s, filter 0.15s',
            }}
          />
        );
      })}
    </>
  );
};

const SpinWheelGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const { t } = useLanguage();
  const gameToast = useGameToast();

  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Segment | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [displayBalance, setDisplayBalance] = useState(balance);
  const [recentWinners, setRecentWinners] = useState<{ name: string; amount: number; multi: string }[]>([]);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number; size: number; emoji: string }[]>([]);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinningRef = useRef(false);

  useEffect(() => {
    setDisplayBalance(balance);
  }, [balance]);

  useEffect(() => {
    // Generate fake winners — include occasional 50x/500x hits for attraction
    const fakeHighMultis = ['50x', '500x', 'Jackpot'];
    const winners: { name: string; amount: number; multi: string }[] = [];
    // Add 2-3 fake big winners with 50x/500x
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const multi = fakeHighMultis[Math.floor(Math.random() * fakeHighMultis.length)];
      const bet = [100, 200, 500][Math.floor(Math.random() * 3)];
      const mVal = multi === '500x' ? 500 : multi === '50x' ? 50 : 100;
      winners.push({
        name: FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)],
        amount: bet * mVal,
        multi,
      });
    }
    // Fill rest with normal wins
    for (let i = 0; i < 6; i++) {
      const seg = SEGMENTS[pickWeighted()];
      if (seg.multiplier <= 0) continue;
      const bet = [50, 100, 200, 500][Math.floor(Math.random() * 4)];
      winners.push({
        name: FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)],
        amount: Math.round(bet * seg.multiplier),
        multi: seg.label,
      });
    }
    // Shuffle
    winners.sort(() => Math.random() - 0.5);
    setRecentWinners(winners.slice(0, 10));
  }, []);

  const spin = useCallback(async () => {
    if (spinningRef.current || spinning || !user) return;
    if (betAmount < 0.5) { gameToast.error('Minimum bet ৳0.5'); return; }
    if (betAmount > balance) { gameToast.error('Insufficient balance!'); return; }

    spinningRef.current = true;
    setSpinning(true);
    setResult(null);
    setWinAmount(0);

    // Play spin start sound + start tick loop
    playSpinStart();
    let tickSpeed = 60;
    let tickCount = 0;
    const startTicks = () => {
      tickTimerRef.current = setInterval(() => {
        tickCount++;
        // Slow down ticks over time (simulate deceleration)
        const pitch = 1 + Math.random() * 0.2;
        playTick(pitch);
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
          if (tickCount > 40) {
            if (tickTimerRef.current) clearInterval(tickTimerRef.current);
          }
        }, tickSpeed);
      }, tickSpeed);
    };
    startTicks();

    // Start wheel spinning immediately — don't wait for API
    const prelimSpins = 2 + Math.floor(Math.random() * 2);
    setRotation(prev => prev + prelimSpins * 360);

    let serverOutcome = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: betAmount, game_id: 'spin-wheel', game_name: 'Spin Wheel' });
      if (data) serverOutcome = data;
    } catch (e) {
      console.error('game-outcome fetch failed:', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      spinningRef.current = false;
      setSpinning(false);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      return;
    }

    const idx = outcomeToSegment(serverOutcome.outcome, serverOutcome.maxWinAmount, betAmount);
    const seg = SEGMENTS[idx];
    // Use backend amount as authoritative — avoids mismatch
    const backendWin = (serverOutcome as { winAmount?: number }).winAmount ?? serverOutcome.maxWinAmount;
    const actualWin = seg.multiplier > 0 ? (backendWin > 0 ? Math.round(backendWin) : Math.min(Math.round(betAmount * seg.multiplier), serverOutcome.maxWinAmount)) : 0;

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
        setTimeout(() => playWinCelebration(seg.multiplier >= 10), 300);
        setRecentWinners(prev => [{ name: 'You ⭐', amount: actualWin, multi: seg.label }, ...prev].slice(0, 10));
        const emojis = ['🪙', '💰', '✨', '⭐', '🏆'];
        setCoins(Array.from({ length: 30 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 0.8,
          size: 16 + Math.random() * 20,
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
        })));
        setShowWinPopup(true);
        setTimeout(() => { setShowWinPopup(false); setCoins([]); }, 800);
      } else {
        setTimeout(() => playLoss(), 200);
      }
    }, 1200);
  }, [spinning, user, betAmount, balance, rotation, applyAuthoritativeBalance]);

  // Alternating red/gold colors like reference image
  const segColors = [
    'hsl(0, 75%, 45%)',   // red - 1.5x
    'hsl(40, 90%, 50%)',  // gold - 0x
    'hsl(0, 75%, 45%)',   // red - 2x
    'hsl(280, 80%, 50%)', // purple - 50x ★
    'hsl(0, 75%, 45%)',   // red - 0x
    'hsl(40, 90%, 50%)',  // gold - 10x
    'hsl(0, 75%, 45%)',   // red - 0.5x
    'hsl(280, 60%, 35%)', // deep purple - 500x ★
    'hsl(0, 75%, 45%)',   // red - 5x
    'hsl(40, 100%, 45%)', // deep gold - Jackpot ★
  ];

  const GLOW_SEGMENTS = [3, 7]; // 50x and 500x indices
  const JACKPOT_SEGMENT = 9;

  return (
    <AuthGate>
      <div className="min-h-screen pb-20 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, hsl(0, 60%, 22%) 0%, hsl(0, 50%, 10%) 70%, hsl(0, 40%, 5%) 100%)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/slots')} className="p-2 rounded-lg bg-card/50">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <h1 className="font-heading font-bold text-lg gold-text">🎡 Spin the Wheel</h1>
          </div>
          <div className="bg-card rounded-xl px-4 py-2 gold-border">
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <motion.p key={displayBalance} className="font-heading font-bold text-sm gold-text" initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
              ৳{displayBalance.toLocaleString()}
            </motion.p>
          </div>
        </div>

        {/* Recent Winners Marquee */}
        <div className="overflow-hidden mb-3 mx-3 rounded-lg bg-card/30 py-1.5 gold-border">
          <div className="flex animate-[marquee_20s_linear_infinite] whitespace-nowrap gap-6 px-4">
            {[...recentWinners, ...recentWinners].map((w, i) => (
              <span key={i} className="text-xs font-heading inline-flex items-center gap-1">
                <span className="text-primary">🏆</span>
                <span className="text-foreground font-bold">{w.name}</span>
                <span className="text-muted-foreground">won</span>
                <span className="gold-text font-bold">৳{w.amount}</span>
                <span className="text-muted-foreground">({w.multi})</span>
              </span>
            ))}
          </div>
        </div>

        {/* 3D Casino Wheel */}
        <div className="flex justify-center px-4 my-2">
          <div className="relative" style={{ perspective: '1000px' }}>
            {/* Ambient glow behind wheel */}
            <div className="absolute inset-[-30px] rounded-full z-0" style={{
              background: 'radial-gradient(circle, hsl(40, 90%, 50%, 0.25) 0%, transparent 70%)',
            }} />

            {/* Golden pointer at top */}
            <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 z-30">
              <div style={{
                width: 0, height: 0,
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: '30px solid hsl(40, 90%, 50%)',
                filter: 'drop-shadow(0 0 8px hsl(40, 90%, 50%)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }} />
            </div>

            {/* Wheel container with 3D tilt */}
            <div
              className="w-[min(85vw,340px)] h-[min(85vw,340px)] sm:w-[min(90vw,340px)] sm:h-[min(90vw,340px)] rounded-full relative z-10 mx-auto"
              style={{
                transformStyle: 'preserve-3d',
                transform: 'rotateX(10deg)',
              }}
            >
              {/* Outer metallic ring */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'conic-gradient(from 0deg, hsl(38, 60%, 45%), hsl(45, 80%, 65%), hsl(38, 60%, 45%), hsl(45, 80%, 65%), hsl(38, 60%, 45%), hsl(45, 80%, 65%), hsl(38, 60%, 45%), hsl(45, 80%, 65%), hsl(38, 60%, 45%))',
                padding: '8px',
                boxShadow: '0 0 50px hsl(40, 80%, 50%, 0.35), 0 15px 40px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.3)',
              }}>
                <div className="w-full h-full rounded-full overflow-hidden relative" style={{
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
                }}>
                  {/* Spinning wheel SVG */}
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning ? 'transform 1.2s cubic-bezier(0.12, 0.6, 0.08, 1)' : 'none',
                    }}
                  >
                    {/* Segments */}
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
                      const tX = 100 + 68 * Math.cos(midA);
                      const tY = 100 + 68 * Math.sin(midA);
                      const textAngle = (startA + endA) / 2;
                      const fillColor = segColors[i];

                        const isGlow = GLOW_SEGMENTS.includes(i);
                        const isJackpot = i === JACKPOT_SEGMENT;

                        return (
                          <g key={i}>
                            <path
                              d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                              fill={fillColor}
                              stroke={isJackpot ? 'hsl(45, 100%, 70%)' : isGlow ? 'hsl(280, 100%, 75%)' : 'hsl(40, 70%, 40%)'}
                              strokeWidth={isGlow || isJackpot ? '1.5' : '0.8'}
                            />
                            <path
                              d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                              fill="url(#segShadow)"
                              opacity="0.3"
                            />
                            {/* Glow pulse overlay for 50x/500x */}
                            {isGlow && (
                              <path
                                d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                                fill="hsl(280, 100%, 80%)"
                                opacity="0.15"
                                className="animate-pulse"
                              />
                            )}
                            {/* Golden glow for Jackpot */}
                            {isJackpot && (
                              <path
                                d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                                fill="hsl(45, 100%, 75%)"
                                opacity="0.2"
                                className="animate-pulse"
                              />
                            )}
                            <text
                              x={tX} y={tY}
                              textAnchor="middle" dominantBaseline="middle"
                              transform={`rotate(${textAngle}, ${tX}, ${tY})`}
                              fill={isJackpot ? 'hsl(0, 0%, 10%)' : isGlow ? 'hsl(50, 100%, 95%)' : (i % 2 === 0 ? 'hsl(45, 100%, 80%)' : 'hsl(0, 60%, 25%)')}
                              fontWeight="900"
                              fontFamily="'Exo 2', sans-serif"
                              style={{
                                fontSize: seg.label === 'Jackpot' ? '5.5px' : (isGlow ? '7.5px' : '7px'),
                                textShadow: isJackpot ? '0 0 8px hsl(45, 100%, 70%), 0 0 16px hsl(40, 90%, 50%)' : isGlow ? '0 0 6px hsl(280, 100%, 80%), 0 0 12px hsl(280, 80%, 60%)' : '0 1px 2px rgba(0,0,0,0.6)',
                              }}
                            >
                              {seg.label}
                            </text>
                            {isGlow && (
                              <text
                                x={100 + 50 * Math.cos(midA)} y={100 + 50 * Math.sin(midA)}
                                textAnchor="middle" dominantBaseline="middle"
                                transform={`rotate(${textAngle}, ${100 + 50 * Math.cos(midA)}, ${100 + 50 * Math.sin(midA)})`}
                                style={{ fontSize: '6px' }}
                                className="animate-pulse"
                              >
                                ⭐
                              </text>
                            )}
                            {isJackpot && (
                              <text
                                x={100 + 50 * Math.cos(midA)} y={100 + 50 * Math.sin(midA)}
                                textAnchor="middle" dominantBaseline="middle"
                                transform={`rotate(${textAngle}, ${100 + 50 * Math.cos(midA)}, ${100 + 50 * Math.sin(midA)})`}
                                style={{ fontSize: '7px' }}
                                className="animate-pulse"
                              >
                                🔥
                              </text>
                            )}
                          </g>
                        );
                    })}

                    {/* LED bulbs ring */}
                    <LedBulbs spinning={spinning} />

                    {/* Center hub - metallic 3D with spinning diamond */}
                    <circle cx="100" cy="100" r="18" fill="url(#hubOuter)" stroke="hsl(40, 70%, 55%)" strokeWidth="2" filter="url(#hubGlow)" />
                    <circle cx="100" cy="100" r="12" fill="url(#hubInner)" />
                    {/* Spinning diamond */}
                    <g className="origin-center" style={{ transformOrigin: '100px 100px', animation: 'spin 3s linear infinite' }}>
                      <polygon
                        points="100,91 107,100 100,109 93,100"
                        fill="url(#diamondGrad)"
                        stroke="hsl(45, 100%, 75%)"
                        strokeWidth="0.6"
                        opacity="0.95"
                      />
                      {/* Diamond inner shine */}
                      <polygon
                        points="100,93 105,100 100,107 95,100"
                        fill="hsl(180, 80%, 85%)"
                        opacity="0.3"
                      />
                    </g>
                    {/* Hub highlight */}
                    <ellipse cx="98" cy="95" rx="6" ry="3" fill="white" opacity="0.12" />

                    <defs>
                      <radialGradient id="hubOuter">
                        <stop offset="0%" stopColor="hsl(40, 50%, 55%)" />
                        <stop offset="100%" stopColor="hsl(38, 40%, 30%)" />
                      </radialGradient>
                      <radialGradient id="hubInner">
                        <stop offset="0%" stopColor="hsl(40, 40%, 50%)" />
                        <stop offset="100%" stopColor="hsl(38, 35%, 25%)" />
                      </radialGradient>
                      <linearGradient id="diamondGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="hsl(180, 70%, 80%)" />
                        <stop offset="50%" stopColor="hsl(200, 90%, 95%)" />
                        <stop offset="100%" stopColor="hsl(280, 60%, 75%)" />
                      </linearGradient>
                      <filter id="hubGlow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feFlood floodColor="hsl(40, 90%, 60%)" floodOpacity="0.4" />
                        <feComposite in2="blur" operator="in" />
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <radialGradient id="segShadow">
                        <stop offset="0%" stopColor="black" stopOpacity="0" />
                        <stop offset="100%" stopColor="black" stopOpacity="0.35" />
                      </radialGradient>
                      <style>{`
                        @keyframes spin {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Win Popup Overlay with Coin Rain */}
        <AnimatePresence>
          {showWinPopup && result && result.multiplier > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              onClick={() => { setShowWinPopup(false); setCoins([]); }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

              {/* Coin rain */}
              {coins.map(c => (
                <motion.span
                  key={c.id}
                  initial={{ y: -60, x: `${c.x}vw`, opacity: 1, rotate: 0 }}
                  animate={{ y: '110vh', rotate: 720, opacity: [1, 1, 0.5] }}
                  transition={{ duration: 2.5 + Math.random(), delay: c.delay, ease: 'easeIn' }}
                  className="absolute top-0 pointer-events-none"
                  style={{ fontSize: c.size, left: 0 }}
                >
                  {c.emoji}
                </motion.span>
              ))}

              {/* Win card */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: [0, 1.15, 1], rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 12 }}
                className="relative z-10 bg-card rounded-3xl p-6 gold-border text-center max-w-[280px] w-full mx-4"
                style={{ boxShadow: '0 0 60px hsl(43 96% 56% / 0.4), 0 0 120px hsl(43 96% 56% / 0.15)' }}
                onClick={e => e.stopPropagation()}
              >
                <motion.span
                  className="text-6xl block mb-2"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  {result.icon}
                </motion.span>
                <p className="font-heading font-bold text-sm text-muted-foreground mb-1">
                  {result.multiplier >= 10 ? '🔥 MEGA WIN 🔥' : '✨ YOU WON! ✨'}
                </p>
                <p className="font-heading font-bold text-xl gold-text mb-1">{result.label}</p>
                <motion.p
                  className="font-heading font-bold text-4xl text-foreground"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.4, 1] }}
                  transition={{ delay: 0.3, type: 'spring' }}
                >
                  ৳{winAmount.toLocaleString()}
                </motion.p>
                <p className="text-xs text-muted-foreground mt-3">Tap anywhere to close</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Controls */}
        <div className="px-4 mt-4 max-w-xs mx-auto space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-heading mb-1 block">Bet Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">৳</span>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(Math.max(0, Number(e.target.value)))}
                disabled={spinning}
                className="w-full bg-card rounded-xl pl-8 pr-3 py-3 text-foreground font-heading font-bold text-lg gold-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex justify-center">
          <button type="button" onClick={spin} disabled={spinning || !user || betAmount < 10}
            className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-heading font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 ${
              spinning ? 'bg-secondary text-muted-foreground' : 'gold-gradient text-primary-foreground animate-pulse-glow'
            }`}
          >
            <RotateCw size={16} className={spinning ? 'animate-spin' : ''} />
            {spinning ? '...' : 'SPIN'}
          </button>
          </div>
        </div>

        {/* Multiplier legend */}
        <div className="px-4 mt-5 max-w-xs mx-auto">
          <h3 className="font-heading font-bold text-sm gold-text mb-2">🎯 Multipliers</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {SEGMENTS.map((seg, i) => (
              <div key={i} className="bg-card rounded-lg p-2 text-center gold-border" style={{ borderLeftColor: segColors[i], borderLeftWidth: '3px' }}>
                <span className="text-lg block">{seg.icon}</span>
                <p className="text-xs font-heading font-bold">{seg.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </AuthGate>
  );
};

export default SpinWheelGame;
