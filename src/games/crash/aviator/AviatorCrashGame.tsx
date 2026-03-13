import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, History } from 'lucide-react';
import aviatorIcon from '@/games/crash/aviator/assets/aviator-icon.png';
import aviatorPlane from '@/games/crash/aviator/assets/aviator-plane.png';
import { useNavigate } from 'react-router-dom';
import AuthGate from '@/components/AuthGate';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getTodayTopPlayers, getWeekTopPlayers, getMonthTopPlayers, getFakeOnlineCount } from './FakeLeaderboard';
import { useCrashRound } from '@/hooks/useCrashRound';
import { useCrashBetting } from '@/hooks/useCrashBetting';

// Types, constants, BOT_NAMES
type RoundPlayer = {
  id: string;
  user_id?: string;
  username: string;
  bet_amount: number;
  status: 'playing' | 'cashed_out' | 'lost';
  cashout_multiplier?: number;
  win_amount?: number;
  isReal?: boolean;
};

type MyBetEntry = {
  id: string;
  roundId: string;
  bet_amount: number;
  status: 'playing' | 'cashed_out' | 'lost';
  cashout_multiplier?: number;
  win_amount?: number;
  crashPoint?: number;
  timestamp: number;
};

type PastRound = {
  id: string;
  crashPoint: number;
  players: RoundPlayer[];
  totalBet: number;
  totalWon: number;
  timestamp: number;
};

type BetPanel = {
  stake: string;
  autoCashout: string;
  hasBet: boolean;
  cashedOut: boolean;
  mode: 'bet' | 'auto';
};

const GROWTH_RATE = 0.00006;

const BOT_NAMES = ['Rakib_77', 'FarhanBD', 'ShadowKing', 'LuckyAce', 'TigerBet', 'Nayeem99', 'JoyBD', 'GamerZone', 'RifatPro', 'KaziStar', 'SultanBet', 'RaselPlay', 'ShakibFan', 'MahiGold', 'TasnimBD', 'ArifulWin', 'NabilX', 'SamirBet', 'ImranLuck', 'TonoyPro', 'PavelBD', 'ShohelMax', 'DidarPro', 'MasudGold', 'BiplabWin', 'AlaminBet', 'HasanLuck', 'TuhinX', 'RobiStar', 'SumonAce'];

const AviatorCrashGame = () => {
  const navigate = useNavigate();
  useActivePlayer('aviator', 'Lucky Aviator', 'crash', 0);

  // Server-synced round state
  const { gameState, multiplier, multiplierRef, countdown, history, elapsedTime, startTimeRef, gameStateRef, roundId, liveBets, refreshRound } = useCrashRound('aviator');
  const { balance, panels, panelBusy, updatePanel, handlePlaceBet, handleCancelBet, handleCashout, ownRoundBets, otherPlayerBets, user } = useCrashBetting({
    gameId: 'aviator',
    gameName: 'Lucky Aviator',
    gameState,
    multiplier,
    roundId,
    liveBets,
    refreshRound,
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'top'>('all');
  const [topSubTab, setTopSubTab] = useState<'today' | 'week' | 'month'>('today');
  const [onlineCount, setOnlineCount] = useState(getFakeOnlineCount());

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [fillerBots, setFillerBots] = useState<RoundPlayer[]>([]);
  const botCashoutTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Past rounds
  const [pastRounds, setPastRounds] = useState<PastRound[]>([]);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const panelsRef = useRef(panels);
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  // Update online count every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setOnlineCount(getFakeOnlineCount()), 30000);
    return () => clearInterval(timer);
  }, []);

  // --- Generate filler bots ---
  const generateFillerBots = useCallback((existingRealCount: number, cp?: number) => {
    const targetCount = 20 + Math.floor(Math.random() * 6);
    const botsNeeded = Math.max(0, targetCount - existingRealCount);
    if (botsNeeded <= 0) { setFillerBots([]); return; }

    const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const bots: RoundPlayer[] = shuffled.slice(0, botsNeeded).map((name, i) => ({
      id: `bot-${i}-${Date.now()}`,
      username: name,
      bet_amount: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000][Math.floor(Math.random() * 9)],
      status: 'playing' as const,
      isReal: false,
    }));
    setFillerBots(bots);

    botCashoutTimersRef.current.forEach(t => clearTimeout(t));
    botCashoutTimersRef.current = [];

    bots.forEach(bot => {
      const willCashout = Math.random() < 0.6;
      if (!willCashout) return;

      let delay: number;
      if (cp) {
        const cashoutM = 1.1 + Math.random() * (cp - 1.1) * 0.9;
        if (cashoutM >= cp) return;
        delay = Math.log(cashoutM) / GROWTH_RATE + (Math.random() - 0.5) * 500;
      } else {
        delay = 2000 + Math.random() * 20000;
      }

      const timer = setTimeout(() => {
        if (gameStateRef.current !== 'flying') return;
        const currentM = multiplierRef.current;
        setFillerBots(prev => prev.map(b =>
          b.id === bot.id && b.status === 'playing' ? {
            ...b,
            status: 'cashed_out' as const,
            cashout_multiplier: Math.floor(currentM * 100) / 100,
            win_amount: Math.round(b.bet_amount * currentM),
          } : b
        ));
      }, delay);
      botCashoutTimersRef.current.push(timer);
    });
  }, []);

  // Crash point is now server-generated via useCrashRound

  // --- Plane image loading ---
  const planeImgRef = useRef<HTMLImageElement | null>(null);
  const [planeLoaded, setPlaneLoaded] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = aviatorPlane;
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.width;
      offscreen.height = img.height;
      const octx = offscreen.getContext('2d');
      if (octx) {
        octx.drawImage(img, 0, 0);
        const imageData = octx.getImageData(0, 0, offscreen.width, offscreen.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r > 200 && g > 200 && b > 200) data[i + 3] = 0;
        }
        octx.putImageData(imageData, 0, 0);
        const processed = new Image();
        processed.src = offscreen.toDataURL();
        processed.onload = () => {
          planeImgRef.current = processed;
          setPlaneLoaded(true);
        };
      }
    };
  }, []);

  // --- Canvas drawing (REAL AVIATOR THEME: red curve, dark bg) ---
  const drawGraph = useCallback((currentMultiplier: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);
    const w = displayW;
    const h = displayH;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    const padL = 0, padB = 0, padT = 20, padR = 25;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    // Subtle grid lines - dark tone matching real Aviator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const gy = h - padB - (i / 5) * graphH;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();
    }

    const maxM = Math.max(currentMultiplier, 2);
    const planeImg = planeImgRef.current;

    if (currentMultiplier <= 1.0) {
      if (planeImg) {
        const iconW = 50, iconH = 32;
        ctx.save();
        ctx.translate(padL + 5, h - padB - 5);
        ctx.rotate(-0.3);
        ctx.drawImage(planeImg, -5, -iconH, iconW, iconH);
        ctx.restore();
      }
      return;
    }

    const elapsed = elapsedTime;
    const totalCrossTime = 20000;
    const progress = Math.min(elapsed / totalCrossTime, 1);
    const tipX = padL + progress * graphW;

    const points: [number, number][] = [];
    const steps = 150;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const timeAtPoint = t * elapsed;
      const mAtPoint = Math.pow(Math.E, GROWTH_RATE * timeAtPoint);
      const x = padL + t * (tipX - padL);
      const y = Math.max(padT, h - padB - ((mAtPoint - 1) / (maxM - 1)) * graphH);
      const clampedX = Math.min(x, w - padR);
      points.push([clampedX, y]);
    }

    // Fill gradient - RED theme (real Aviator style)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    if (crashed) {
      grad.addColorStop(0, 'rgba(220, 38, 38, 0.02)');
      grad.addColorStop(0.5, 'rgba(220, 38, 38, 0.15)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0.3)');
    } else {
      grad.addColorStop(0, 'rgba(231, 76, 60, 0.03)');
      grad.addColorStop(0.5, 'rgba(231, 76, 60, 0.15)');
      grad.addColorStop(1, 'rgba(231, 76, 60, 0.35)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0][0], h - padB);
    points.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(points[points.length - 1][0], h - padB);
    ctx.closePath();
    ctx.fill();

    // Curve line - RED (real Aviator uses red/pink curve)
    const lineColor = crashed ? '#9B2C2C' : '#E74C3C';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!crashed && planeImg) {
      const tip = points[points.length - 1];
      const prev = points[Math.max(0, points.length - 6)];
      const angle = Math.atan2(prev[1] - tip[1], tip[0] - prev[0]);
      const iconW = 52, iconH = 32;
      ctx.save();
      ctx.translate(tip[0], tip[1]);
      ctx.rotate(-angle);
      ctx.drawImage(planeImg, -iconW * 0.3, -iconH / 2, iconW, iconH);
      ctx.restore();
    }

    if (crashed) {
      const tip = points[points.length - 1];
      ctx.font = '32px serif';
      ctx.fillText('💥', tip[0] - 16, tip[1] + 10);
    }

    ctx.restore();
  }, [planeLoaded, elapsedTime]);

  useEffect(() => {
    drawGraph(multiplier, gameState === 'crashed');
  }, [multiplier, gameState, drawGraph]);

  // --- State transitions (server-driven) ---
  const prevAviatorStateRef = useRef<string>('waiting');
  useEffect(() => {
    if (prevAviatorStateRef.current === gameState) return;
    const prev = prevAviatorStateRef.current;
    prevAviatorStateRef.current = gameState;

    if (gameState === 'flying') {
      const realCount = panelsRef.current.filter(p => p.hasBet).length + otherPlayerBets.length;
      generateFillerBots(realCount);
    }

    if (gameState === 'crashed') {
      botCashoutTimersRef.current.forEach(t => clearTimeout(t));
      setFillerBots(prevBots => {
        const allBots = prevBots.map(b => b.status === 'playing' ? { ...b, status: 'lost' as const } : b);
        const settledOwn = ownRoundBets.map(b => b.status === 'playing' ? { ...b, status: 'lost' as const } : b);
        const settledOther = otherPlayerBets.map(b => b.status === 'playing' ? { ...b, status: 'lost' as const } : b);
        const roundPlayers = [...settledOwn, ...settledOther, ...allBots];
        const totalBet = roundPlayers.reduce((s, b) => s + b.bet_amount, 0);
        const totalWon = roundPlayers.filter(b => b.status === 'cashed_out').reduce((s, b) => s + (b.win_amount || 0), 0);
        setPastRounds(pr => [{ id: `round-${Date.now()}`, crashPoint: multiplier, players: roundPlayers, totalBet, totalWon, timestamp: Date.now() }, ...pr.slice(0, 19)]);
        return allBots;
      });
    }

    if (gameState === 'waiting' && prev === 'crashed') {
      setFillerBots([]);
    }
  }, [gameState, multiplier, otherPlayerBets, ownRoundBets]);

  // Auto cashout
  // --- Computed values ---
  const totalRoundPlayers = onlineCount;
  const fakeTotalBaseBet = useRef(0);
  const [liveTotalBet, setLiveTotalBet] = useState(0);

  useEffect(() => {
    if (gameState === 'flying') {
      const avgBet = 150 + Math.random() * 150;
      const total = Math.round(onlineCount * avgBet);
      fakeTotalBaseBet.current = total;
      setLiveTotalBet(total);
    }
  }, [gameState, onlineCount]);

  const allVisibleBets = [...ownRoundBets, ...otherPlayerBets, ...fillerBots];

  useEffect(() => {
    if (gameState === 'flying') {
      const cashedOutTotal = allVisibleBets
        .filter(b => b.status === 'cashed_out' && b.win_amount)
        .reduce((s, b) => s + (b.win_amount || 0), 0);
      const scaleFactor = onlineCount / Math.max(allVisibleBets.length, 1);
      const scaledCashout = Math.round(cashedOutTotal * scaleFactor * 0.3);
      setLiveTotalBet(Math.max(0, fakeTotalBaseBet.current - scaledCashout));
    }
  }, [allVisibleBets.length, gameState, onlineCount]);

  const displayedRoundBets = activeTab === 'my'
    ? ownRoundBets
    : activeTab === 'top'
    ? [...allVisibleBets].sort((a, b) => (b.win_amount || 0) - (a.win_amount || 0))
    : allVisibleBets;

  const myBetEntries = useMemo<MyBetEntry[]>(() => {
    const liveEntries: MyBetEntry[] = ownRoundBets.map((bet) => ({
      id: bet.id,
      roundId: roundId || 'live-round',
      bet_amount: bet.bet_amount,
      status: bet.status,
      cashout_multiplier: bet.cashout_multiplier,
      win_amount: bet.win_amount,
      crashPoint: gameState === 'crashed' ? multiplier : undefined,
      timestamp: Date.now(),
    }));

    const historyEntries: MyBetEntry[] = pastRounds.flatMap((round) =>
      round.players
        .filter((player) => player.user_id && player.user_id === user?.id)
        .map((player, idx) => ({
          id: `${round.id}-${player.id}-${idx}`,
          roundId: round.id,
          bet_amount: player.bet_amount,
          status: player.status,
          cashout_multiplier: player.cashout_multiplier,
          win_amount: player.win_amount,
          crashPoint: round.crashPoint,
          timestamp: round.timestamp,
        }))
    );

    const merged = [...liveEntries, ...historyEntries];
    const unique = new Map<string, MyBetEntry>();
    merged.forEach((entry) => {
      const key = `${entry.roundId}-${entry.id}-${entry.status}-${entry.bet_amount}`;
      if (!unique.has(key)) {
        unique.set(key, entry);
      }
    });

    return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [gameState, multiplier, ownRoundBets, pastRounds, roundId, user?.id]);

  // History chip color helper matching real Aviator
  const getHistoryChipStyle = (val: number) => {
    if (val < 2) return 'bg-[#2c3640] text-[#59b6f8]'; // blue for low
    if (val < 10) return 'bg-[#2c3640] text-[#9f5fff]'; // purple for medium
    return 'bg-[#2c3640] text-[#e74c3c]'; // red for high
  };

  return (
    <AuthGate>
      <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: '#0F1923' }}>

        {/* Header - dark Aviator style */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2" style={{ background: '#1a2c38' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/crash')} className="p-1.5">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <img src={aviatorIcon} alt="Aviator" className="w-10 h-10 rounded" />
            <span className="font-bold text-lg italic text-[#E74C3C]" style={{ fontFamily: 'cursive' }}>Lucky Aviator</span>
          </div>
          <div className="rounded-full px-3 py-1.5 flex items-center gap-1.5" style={{ background: '#0f1923', border: '1px solid #2c3640' }}>
            <div className="w-5 h-5 rounded-full bg-[#28a909] flex items-center justify-center text-[10px]">🪙</div>
            <span className="text-white font-bold text-sm">৳{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* History bar - real Aviator style */}
        <div className="relative z-20 px-3 mb-2 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
              {history.map((h, i) => (
                <span key={i} className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${getHistoryChipStyle(h)}`}>
                  {h.toFixed(2)}x
                </span>
              ))}
            </div>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#2c3640] transition-colors"
              style={{ background: '#1a2c38' }}
            >
              <History size={16} className="text-gray-400" />
            </button>
          </div>
          {historyOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 rounded-xl p-3 max-h-[200px] overflow-y-auto shadow-lg z-30" style={{ background: '#1a2c38', border: '1px solid #2c3640' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-xs">📜 Crash History</span>
                <button onClick={() => setHistoryOpen(false)} className="text-gray-500 text-xs hover:text-white">✕</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`text-xs font-bold px-2 py-1 rounded-full ${getHistoryChipStyle(h)}`}>
                    {h.toFixed(2)}x
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Game canvas area - dark charcoal like real Aviator */}
        <div className="relative z-10 rounded-xl overflow-hidden w-[min(95vw,480px)] mx-auto" style={{ minHeight: 200, background: '#101a22', border: '1px solid #1e2d3a' }}>
          {/* Sky particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={`star-${i}`} className="absolute rounded-full"
                style={{
                  width: `${2 + (i % 3)}px`,
                  height: `${2 + (i % 3)}px`,
                  top: `${(i * 41) % 90 + 5}%`,
                  background: i % 5 === 0 ? '#E74C3C' : 'rgba(255,255,255,0.3)',
                  opacity: 0.3 + (i % 4) * 0.08,
                  animation: `skyFlyLeft ${3 + (i % 4) * 1.2}s linear infinite`,
                  animationDelay: `${-(i * 0.5)}s`,
                }}
              />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`streak-${i}`} className="absolute"
                style={{
                  top: `${10 + i * 11}%`,
                  width: `${40 + (i % 3) * 20}px`,
                  height: '1.5px',
                  borderRadius: '2px',
                  background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)`,
                  opacity: 0.25,
                  animation: `skyFlyLeft ${2 + (i % 3) * 0.7}s linear infinite`,
                  animationDelay: `${-(i * 0.7)}s`,
                }}
              />
            ))}
          </div>
          <style>{`
            @keyframes skyFlyLeft {
              0% { transform: translateX(calc(100% + 50px)); left: 100%; }
              100% { transform: translateX(calc(-100% - 50px)); left: 0%; }
            }
          `}</style>
          <canvas ref={canvasRef} width={400} height={220} className="w-full h-[200px] relative z-[1]" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[3]">
            {gameState === 'waiting' && (
              <div className="text-center">
                <p className="text-gray-400 text-sm">NEXT ROUND IN</p>
                <p className="text-white font-bold text-4xl mt-1">
                  {countdown}s
                </p>
                <p className="text-[#28a909] text-xs mt-1 animate-pulse font-bold">Place your bets!</p>
              </div>
            )}
            {gameState === 'flying' && (
              <p className="font-extrabold text-5xl drop-shadow-lg text-white">
                {multiplier.toFixed(2)}x
              </p>
            )}
            {gameState === 'crashed' && (
              <div className="text-center">
                <p className="text-[#E74C3C] font-extrabold text-4xl">FLEW AWAY!</p>
                <p className="text-gray-400 text-lg mt-1">{multiplier.toFixed(2)}x</p>
              </div>
            )}
          </div>
        </div>

        {/* Dual Bet Panels - Aviator green/dark theme */}
        <div className="relative z-10 px-3 mt-3 space-y-2">
          {([0, 1] as const).map(idx => (
            <div key={idx} className="rounded-xl p-3" style={{ background: '#1a2c38', border: '1px solid #2c3640' }}>
              <div className="flex gap-0 mb-2">
                <button
                  onClick={() => updatePanel(idx, { mode: 'bet' })}
                  className={`flex-1 py-1 text-xs font-bold rounded-l-md transition-colors ${
                    panels[idx].mode === 'bet' ? 'bg-[#2c3640] text-white' : 'bg-[#0f1923] text-gray-500'
                  }`}
                >
                  Bet
                </button>
                <button
                  onClick={() => updatePanel(idx, { mode: 'auto' })}
                  className={`flex-1 py-1 text-xs font-bold rounded-r-md transition-colors ${
                    panels[idx].mode === 'auto' ? 'bg-[#2c3640] text-white' : 'bg-[#0f1923] text-gray-500'
                  }`}
                >
                  Auto
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg flex-1" style={{ background: '#0f1923' }}>
                  <button
                    onClick={() => updatePanel(idx, { stake: String(Math.max(10, Number(panels[idx].stake) - 10).toFixed(2)) })}
                    disabled={panels[idx].hasBet}
                    className="px-2 py-2 text-gray-400 text-lg font-bold disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={panels[idx].stake}
                    onChange={e => updatePanel(idx, { stake: e.target.value })}
                    disabled={panels[idx].hasBet}
                    className="w-full bg-transparent text-center text-white font-bold text-sm outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updatePanel(idx, { stake: String((Number(panels[idx].stake) + 10).toFixed(2)) })}
                    disabled={panels[idx].hasBet}
                    className="px-2 py-2 text-gray-400 text-lg font-bold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                {!panels[idx].hasBet ? (
                  <button
                    onClick={() => handlePlaceBet(idx)}
                    disabled={panelBusy[idx]}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform min-w-[100px] disabled:opacity-60"
                    style={{ background: '#28a909' }}
                  >
                    <div className="text-xs opacity-80">BET</div>
                    <div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : panels[idx].cashedOut ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm min-w-[100px]" style={{ background: 'rgba(40,169,9,0.2)', color: '#28a909' }}>
                    ✅ Won
                  </button>
                ) : gameState === 'crashed' ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm min-w-[100px]" style={{ background: 'rgba(231,76,60,0.2)', color: '#E74C3C' }}>
                    Lost
                  </button>
                ) : gameState === 'waiting' ? (
                  <button
                    onClick={() => handleCancelBet(idx)}
                    disabled={panelBusy[idx]}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform min-w-[100px] disabled:opacity-60"
                    style={{ background: '#E74C3C' }}
                  >
                    <div className="text-xs opacity-80">CANCEL</div>
                    <div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleCashout(idx)}
                    disabled={panelBusy[idx]}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform min-w-[100px] disabled:opacity-60"
                    style={{ background: '#D4770C' }}
                  >
                    <div className="text-xs opacity-80">CASH OUT</div>
                    <div>৳{Math.round(Number(panels[idx].stake) * multiplier).toLocaleString()}</div>
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 mt-2">
                {[5, 50, 100, 500].map(v => (
                  <button
                    key={v}
                    onClick={() => updatePanel(idx, { stake: String(v.toFixed(2)) })}
                    disabled={panels[idx].hasBet}
                    className="flex-1 py-1 text-[11px] font-bold rounded transition-colors disabled:opacity-30 text-gray-400 hover:text-white"
                    style={{ background: '#2c3640' }}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {panels[idx].mode === 'auto' && (
                <div className="mt-2">
                  <label className="text-[10px] text-gray-500 block mb-0.5">Auto Cash Out (x)</label>
                  <input
                    type="number"
                    value={panels[idx].autoCashout}
                    onChange={e => updatePanel(idx, { autoCashout: e.target.value })}
                    disabled={panels[idx].hasBet}
                    className="w-full rounded-lg px-3 py-1.5 text-white text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ background: '#0f1923' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* All Bets / My Bets / Top tabs - Aviator dark theme */}
        <div className="relative z-10 px-3 mt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#28a909] animate-pulse" />
              <span className="text-xs text-gray-400">
                <span className="text-[#28a909] font-bold">{onlineCount.toLocaleString()}</span> online
              </span>
            </div>
          </div>

          <div className="flex gap-0 mb-2">
            {(['all', 'my', 'top'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-bold capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-white rounded-t-lg'
                    : 'text-gray-500'
                }`}
                style={{ background: activeTab === tab ? '#2c3640' : '#0f1923' }}
              >
                {tab === 'all' ? 'All Bets' : tab === 'my' ? 'My Bets' : 'Top'}
              </button>
            ))}
          </div>
          <div className="rounded-b-xl p-2" style={{ background: '#1a2c38', border: '1px solid #2c3640' }}>
            {activeTab === 'top' ? (
              <>
                <div className="flex gap-1 mb-2">
                  {(['today', 'week', 'month'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => setTopSubTab(st)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${
                        topSubTab === st ? 'bg-[#28a909] text-white' : 'bg-[#2c3640] text-gray-400'
                      }`}
                    >
                      {st === 'today' ? 'Today' : st === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-gray-500 flex mb-1 px-1">
                  <span className="w-5">#</span>
                  <span className="flex-1">Player</span>
                  <span className="w-16 text-right text-[#9f5fff] font-bold">Max X</span>
                  <span className="w-20 text-right text-[#28a909] font-bold">৳Payout</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {(topSubTab === 'today' ? getTodayTopPlayers() : topSubTab === 'week' ? getWeekTopPlayers() : getMonthTopPlayers()).map((p, i) => (
                    <div key={p.id} className={`flex items-center py-1.5 px-1 text-xs border-b last:border-0 ${
                      i < 3 ? 'bg-[#28a909]/5' : ''
                    }`} style={{ borderColor: '#2c3640' }}>
                      <span className={`w-5 font-bold ${i < 3 ? 'text-[#28a909]' : 'text-gray-500'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      <span className="flex-1 truncate text-white font-medium">{p.username}</span>
                      <span className="w-16 text-right text-[#9f5fff] font-bold">{p.maxMultiplier.toFixed(2)}x</span>
                      <span className="w-20 text-right text-[#28a909] font-bold">৳{p.payout.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : activeTab === 'my' ? (
              <>
                <div className="flex items-center justify-between mb-2 pb-1" style={{ borderBottom: '1px solid #2c3640' }}>
                  <span className="text-white font-bold text-xs">
                    MY BETS <span className="text-gray-500">{myBetEntries.length}</span>
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Win <span className="text-[#28a909] font-bold">green</span> • Loss <span className="text-[#E74C3C] font-bold">red</span>
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 flex mb-1 px-1">
                  <span className="w-14 text-left">Bet</span>
                  <span className="flex-1 text-left">Result</span>
                  <span className="w-20 text-right">Crash</span>
                </div>
                {myBetEntries.length === 0 && (
                  <p className="text-center text-gray-500 text-xs py-3">No bets yet</p>
                )}
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {myBetEntries.map((bet) => (
                    <div
                      key={bet.id}
                      className={`rounded-lg px-2 py-2 text-xs border ${
                        bet.status === 'cashed_out'
                          ? 'bg-[#28a909]/8 border-[#28a909]/20'
                          : bet.status === 'lost'
                            ? 'bg-[#E74C3C]/8 border-[#E74C3C]/20'
                            : 'bg-[#0f1923] border-[#2c3640]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">৳{bet.bet_amount.toLocaleString()}</span>
                        <span
                          className={`font-bold ${
                            bet.status === 'cashed_out'
                              ? 'text-[#28a909]'
                              : bet.status === 'lost'
                                ? 'text-[#E74C3C]'
                                : 'text-[#59b6f8]'
                          }`}
                        >
                          {bet.status === 'cashed_out'
                            ? `Won ৳${Number(bet.win_amount || 0).toLocaleString()}`
                            : bet.status === 'lost'
                              ? `Lost ৳${bet.bet_amount.toLocaleString()}`
                              : 'Running'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span
                          className={`${
                            bet.status === 'cashed_out'
                              ? 'text-[#9f5fff]'
                              : bet.status === 'lost'
                                ? 'text-[#E74C3C]'
                                : 'text-gray-400'
                          }`}
                        >
                          {bet.status === 'cashed_out' && bet.cashout_multiplier
                            ? `Cashout ${bet.cashout_multiplier.toFixed(2)}x`
                            : bet.status === 'lost'
                              ? 'Did not cash out'
                              : 'Waiting...'}
                        </span>
                        <span className={`${bet.status === 'lost' ? 'text-[#E74C3C]' : 'text-gray-400'}`}>
                          {bet.crashPoint ? `Crash @ ${bet.crashPoint.toFixed(2)}x` : '--'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 pb-1" style={{ borderBottom: '1px solid #2c3640' }}>
                  <span className="text-white font-bold text-xs">
                    {activeTab === 'all' ? 'ALL BETS' : 'MY BETS'}{' '}
                    <span className="text-gray-500">{activeTab === 'all' ? totalRoundPlayers.toLocaleString() : displayedRoundBets.length}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400">
                      👥 <span className="text-[#59b6f8] font-bold">{totalRoundPlayers.toLocaleString()}</span> players
                    </span>
                    <span className="text-[10px] text-gray-400">
                      💰 <span className="text-[#28a909] font-bold">৳{liveTotalBet.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 flex mb-1 px-1">
                  <span className="flex-1">User</span>
                  <span className="w-16 text-right">Bet</span>
                  <span className="w-14 text-right">X</span>
                  <span className="w-20 text-right">Cash Out</span>
                </div>
                {displayedRoundBets.length === 0 && (
                  <p className="text-center text-gray-500 text-xs py-3">
                    {gameState === 'waiting' ? 'Waiting for next round...' : 'No bets'}
                  </p>
                )}
                <div className="max-h-[250px] overflow-y-auto">
                  {displayedRoundBets.map((b) => (
                    <div key={b.id} className={`flex items-center py-1.5 px-1 text-xs last:border-0 ${
                      b.status === 'cashed_out' ? 'bg-[#28a909]/5' : b.status === 'lost' ? 'bg-[#E74C3C]/5' : ''
                    }`} style={{ borderBottom: '1px solid #1e2d3a' }}>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white ${
                          b.isReal ? 'bg-[#28a909]' : 'bg-[#2c3640]'
                        }`}>
                          {b.isReal ? '⭐' : '👤'}
                        </div>
                        <span className={`truncate max-w-[80px] ${b.isReal ? 'text-[#59b6f8] font-bold' : 'text-gray-400'}`}>
                          {b.username}
                        </span>
                      </div>
                      <span className="w-16 text-right text-gray-400">৳{b.bet_amount.toLocaleString()}</span>
                      <span className={`w-14 text-right font-bold ${
                        b.status === 'cashed_out' ? 'text-[#9f5fff]' :
                        b.status === 'lost' ? 'text-[#E74C3C]' : 'text-gray-500'
                      }`}>
                        {b.status === 'cashed_out' && b.cashout_multiplier ? `${b.cashout_multiplier.toFixed(2)}x` :
                         b.status === 'lost' ? '✗' : '•••'}
                      </span>
                      <span className={`w-20 text-right font-bold ${
                        b.status === 'cashed_out' ? 'text-[#28a909]' :
                        b.status === 'lost' ? 'text-[#E74C3C]/60' :
                        'text-gray-500 animate-pulse'
                      }`}>
                        {b.status === 'cashed_out' && b.win_amount ? `+৳${b.win_amount.toLocaleString()}` :
                         b.status === 'lost' ? `-৳${b.bet_amount.toLocaleString()}` :
                         'Playing...'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </AuthGate>
  );
};

export default AviatorCrashGame;
