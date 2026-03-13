import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthGate from '@/components/AuthGate';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getTodayTopPlayers, getWeekTopPlayers, getMonthTopPlayers, getFakeOnlineCount } from '../aviator/FakeLeaderboard';
import { useCrashRound } from '@/hooks/useCrashRound';
import { useCrashBetting } from '@/hooks/useCrashBetting';

type RoundPlayer = {
  id: string;
  username: string;
  bet_amount: number;
  status: 'playing' | 'cashed_out' | 'lost';
  cashout_multiplier?: number;
  win_amount?: number;
  isReal?: boolean;
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

// TURBO THEME: Electric blue & bright yellow/amber
const THEME = {
  name: 'Lucky Turbo Crash',
  emoji: '⚡',
  channelName: 'turbo-live',
  gameId: 'turbo',
  curveColor: '#facc15',
  curveGlow: 'rgba(250, 204, 21, 0.4)',
  gradientStart: 'rgba(250, 204, 21, 0.05)',
  gradientMid: 'rgba(250, 204, 21, 0.2)',
  gradientEnd: 'rgba(250, 204, 21, 0.4)',
  crashColor: '#ef4444',
  gridColor: 'rgba(59, 130, 246, 0.06)',
  titleClass: 'text-yellow-400',
  balanceBorder: 'border border-yellow-500/30',
  balanceText: 'text-yellow-400',
  canvasBorder: 'border border-blue-500/30',
  cardBorder: 'border border-blue-500/20',
  countdownColor: 'text-yellow-400',
  betBtnClass: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white',
  cashoutBtnClass: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
  historyHighClass: 'bg-yellow-500/15 text-yellow-400',
  tabActiveClass: 'bg-blue-500/20 text-blue-300',
  multiplierColor: (m: number) => m >= 5 ? 'text-green-400' : m >= 2 ? 'text-yellow-400' : 'text-foreground',
  bgGradient: 'bg-gradient-to-b from-[hsl(220,60%,10%)] to-[hsl(220,70%,5%)]',
  particleColor1: 'hsl(45, 93%, 53%)',
  particleColor2: 'hsl(217, 91%, 60%)',
  accentColor: 'blue',
};

const TurboCrashGame = () => {
  const navigate = useNavigate();
  useActivePlayer(THEME.gameId, THEME.name, 'crash', 0);

  // Server-synced round state
  const { gameState, multiplier, multiplierRef, countdown, history, elapsedTime, startTimeRef, gameStateRef, roundId, liveBets, refreshRound } = useCrashRound(THEME.gameId);
  const { balance, panels, panelBusy, updatePanel, handlePlaceBet, handleCancelBet, handleCashout, ownRoundBets, otherPlayerBets } = useCrashBetting({
    gameId: THEME.gameId,
    gameName: THEME.name,
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
  const panelsRef = useRef(panels);
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  useEffect(() => {
    const timer = setInterval(() => setOnlineCount(getFakeOnlineCount()), 30000);
    return () => clearInterval(timer);
  }, []);

  const generateFillerBots = useCallback((existingRealCount: number, cp?: number) => {
    const targetCount = 20 + Math.floor(Math.random() * 6);
    const botsNeeded = Math.max(0, targetCount - existingRealCount);
    if (botsNeeded <= 0) { setFillerBots([]); return; }
    const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const bots: RoundPlayer[] = shuffled.slice(0, botsNeeded).map((name, i) => ({
      id: `bot-${i}-${Date.now()}`, username: name,
      bet_amount: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000][Math.floor(Math.random() * 9)],
      status: 'playing' as const, isReal: false,
    }));
    setFillerBots(bots);
    botCashoutTimersRef.current.forEach(t => clearTimeout(t));
    botCashoutTimersRef.current = [];
    bots.forEach(bot => {
      const willCashout = Math.random() < 0.6;
      if (!willCashout) return;
      let delay: number;
      if (cp) { const cashoutM = 1.1 + Math.random() * (cp - 1.1) * 0.9; if (cashoutM >= cp) return; delay = Math.log(cashoutM) / GROWTH_RATE + (Math.random() - 0.5) * 500; }
      else { delay = 2000 + Math.random() * 20000; }
      const timer = setTimeout(() => {
        if (gameStateRef.current !== 'flying') return;
        const currentM = multiplierRef.current;
        setFillerBots(prev => prev.map(b =>
          b.id === bot.id && b.status === 'playing' ? { ...b, status: 'cashed_out' as const, cashout_multiplier: Math.floor(currentM * 100) / 100, win_amount: Math.round(b.bet_amount * currentM) } : b
        ));
      }, delay);
      botCashoutTimersRef.current.push(timer);
    });
  }, []);

  // Crash point is now server-generated via useCrashRound

  // Canvas drawing
  const drawGraph = useCallback((currentMultiplier: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth, displayH = canvas.clientHeight;
    canvas.width = displayW * dpr; canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);
    const w = displayW, h = displayH;
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();

    const padL = 0, padB = 0, padT = 20, padR = 25;
    const graphW = w - padL - padR, graphH = h - padT - padB;

    ctx.strokeStyle = THEME.gridColor;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { const gy = h - padB - (i / 5) * graphH; ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke(); }

    const maxM = Math.max(currentMultiplier, 2);
    if (currentMultiplier <= 1.0) {
      ctx.font = '32px serif';
      ctx.fillText(THEME.emoji, padL + 5, h - padB - 10);
      ctx.restore(); return;
    }

    const elapsed = elapsedTime;
    const progress = Math.min(elapsed / 20000, 1);
    const tipX = padL + progress * graphW;
    const points: [number, number][] = [];
    for (let i = 0; i <= 150; i++) {
      const t = i / 150;
      const mAtPoint = Math.pow(Math.E, GROWTH_RATE * t * elapsed);
      const x = Math.min(padL + t * (tipX - padL), w - padR);
      const y = Math.max(padT, h - padB - ((mAtPoint - 1) / (maxM - 1)) * graphH);
      points.push([x, y]);
    }

    const grad = ctx.createLinearGradient(0, h, 0, 0);
    if (crashed) {
      grad.addColorStop(0, 'rgba(220, 38, 38, 0.05)');
      grad.addColorStop(0.5, 'rgba(220, 38, 38, 0.25)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0.4)');
    } else {
      grad.addColorStop(0, THEME.gradientStart);
      grad.addColorStop(0.5, THEME.gradientMid);
      grad.addColorStop(1, THEME.gradientEnd);
    }
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(points[0][0], h - padB);
    points.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(points[points.length - 1][0], h - padB);
    ctx.closePath(); ctx.fill();

    const lineColor = crashed ? THEME.crashColor : THEME.curveColor;
    ctx.strokeStyle = lineColor; ctx.lineWidth = 3;
    ctx.shadowColor = lineColor; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke(); ctx.shadowBlur = 0;

    if (!crashed) {
      const tip = points[points.length - 1];
      ctx.font = '28px serif';
      ctx.fillText(THEME.emoji, tip[0] - 14, tip[1] - 5);
    }
    if (crashed) {
      const tip = points[points.length - 1];
      ctx.font = '32px serif';
      ctx.fillText('💥', tip[0] - 16, tip[1] + 10);
    }
    ctx.restore();
  }, [elapsedTime]);

  useEffect(() => { drawGraph(multiplier, gameState === 'crashed'); }, [multiplier, gameState, drawGraph]);

  // --- State transitions (server-driven) ---
  const prevTurboStateRef = useRef<string>('waiting');
  useEffect(() => {
    if (prevTurboStateRef.current === gameState) return;
    const prev = prevTurboStateRef.current;
    prevTurboStateRef.current = gameState;

    if (gameState === 'flying') {
      const realCount = panelsRef.current.filter(p => p.hasBet).length + otherPlayerBets.length;
      generateFillerBots(realCount);
    }
    if (gameState === 'crashed') {
      botCashoutTimersRef.current.forEach(t => clearTimeout(t));
      setFillerBots(prev => prev.map(b => b.status === 'playing' ? { ...b, status: 'lost' as const } : b));
    }
    if (gameState === 'waiting' && prev === 'crashed') {
      setFillerBots([]);
    }
  }, [gameState]);

  // Auto cashout
  const totalRoundPlayers = onlineCount;
  const fakeTotalBaseBet = useRef(0);
  const [liveTotalBet, setLiveTotalBet] = useState(0);

  useEffect(() => {
    if (gameState === 'flying') {
      const total = Math.round(onlineCount * (150 + Math.random() * 150));
      fakeTotalBaseBet.current = total; setLiveTotalBet(total);
    }
  }, [gameState, onlineCount]);

  const allVisibleBets = [...ownRoundBets, ...otherPlayerBets, ...fillerBots];

  useEffect(() => {
    if (gameState === 'flying') {
      const cashedOutTotal = allVisibleBets.filter(b => b.status === 'cashed_out' && b.win_amount).reduce((s, b) => s + (b.win_amount || 0), 0);
      const scaleFactor = onlineCount / Math.max(allVisibleBets.length, 1);
      setLiveTotalBet(Math.max(0, fakeTotalBaseBet.current - Math.round(cashedOutTotal * scaleFactor * 0.3)));
    }
  }, [allVisibleBets.length, gameState, onlineCount]);

  const displayedRoundBets = activeTab === 'my' ? ownRoundBets : activeTab === 'top'
    ? [...allVisibleBets].sort((a, b) => (b.win_amount || 0) - (a.win_amount || 0)) : allVisibleBets;

  return (
    <AuthGate>
      <div className={`h-screen ${THEME.bgGradient} flex flex-col relative overflow-hidden`}>
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/crash')} className="p-1.5">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <span className="text-2xl">{THEME.emoji}</span>
            <span className={`font-bold text-lg ${THEME.titleClass}`}>{THEME.name}</span>
          </div>
          <div className={`flex items-center gap-1.5 ${THEME.balanceBorder} rounded-full px-3 py-1.5 bg-card`}>
            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px]">🪙</div>
            <span className={`${THEME.balanceText} font-bold text-sm`}>৳{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* History bar */}
        <div className="relative z-20 px-3 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
              {history.map((h, i) => (
                <span key={i} className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  h < 2 ? 'bg-secondary text-destructive' : `${THEME.historyHighClass}`
                }`}>{h.toFixed(2)}x</span>
              ))}
            </div>
            <button onClick={() => setHistoryOpen(!historyOpen)} className="flex-shrink-0 p-1.5 bg-secondary rounded-lg hover:bg-blue-500/20 transition-colors">
              <History size={16} className="text-muted-foreground" />
            </button>
          </div>
          {historyOpen && (
            <div className={`absolute left-3 right-3 top-full mt-1 bg-card rounded-xl ${THEME.cardBorder} p-3 max-h-[200px] overflow-y-auto shadow-lg z-30`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-bold text-xs">📜 Crash History</span>
                <button onClick={() => setHistoryOpen(false)} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span key={i} className={`text-xs font-bold px-2 py-1 rounded ${
                    h < 2 ? 'bg-destructive/15 text-destructive' : h >= 10 ? `${THEME.historyHighClass}` : 'bg-success/15 text-success'
                  }`}>{h.toFixed(2)}x</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Game canvas */}
        <div className={`relative z-10 mx-3 rounded-xl overflow-hidden bg-background ${THEME.canvasBorder}`} style={{ minHeight: 200 }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={`p-${i}`} className="absolute rounded-full" style={{
                width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`,
                top: `${(i * 41) % 90 + 5}%`,
                background: i % 3 === 0 ? THEME.particleColor1 : THEME.particleColor2,
                opacity: 0.3 + (i % 4) * 0.1,
                animation: `turboSkyFly ${3 + (i % 4) * 1.2}s linear infinite`,
                animationDelay: `${-(i * 0.5)}s`,
              }} />
            ))}
          </div>
          <style>{`@keyframes turboSkyFly { 0% { transform: translateX(calc(100% + 50px)); left: 100%; } 100% { transform: translateX(calc(-100% - 50px)); left: 0%; } }`}</style>
          <canvas ref={canvasRef} width={400} height={220} className="w-full h-[200px] relative z-[1]" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[3]">
            {gameState === 'waiting' && (
              <div className="text-center">
                <p className="text-muted-foreground text-sm">NEXT ROUND IN</p>
                <p className={`${THEME.countdownColor} font-bold text-4xl mt-1`}>{countdown}s</p>
                <p className={`${THEME.countdownColor} text-xs mt-1 animate-pulse font-bold`}>Place your bet!</p>
              </div>
            )}
            {gameState === 'flying' && (
              <p className={`font-extrabold text-5xl drop-shadow-lg ${THEME.multiplierColor(multiplier)}`}>{multiplier.toFixed(2)}x</p>
            )}
            {gameState === 'crashed' && (
              <div className="text-center">
                <p className="text-destructive font-extrabold text-4xl">CRASHED!</p>
                <p className="text-muted-foreground text-lg mt-1">{multiplier.toFixed(2)}x</p>
              </div>
            )}
          </div>
        </div>

        {/* Bet Panels */}
        <div className="relative z-10 px-3 mt-3 space-y-2 flex-1 overflow-y-auto pb-4">
          {([0, 1] as const).map(idx => (
            <div key={idx} className={`bg-card rounded-xl p-3 ${THEME.cardBorder}`}>
              <div className="flex gap-0 mb-2">
                <button onClick={() => updatePanel(idx, { mode: 'bet' })} className={`flex-1 py-1 text-xs font-bold rounded-l-md ${panels[idx].mode === 'bet' ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground'}`}>Bet</button>
                <button onClick={() => updatePanel(idx, { mode: 'auto' })} className={`flex-1 py-1 text-xs font-bold rounded-r-md ${panels[idx].mode === 'auto' ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground'}`}>Auto</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-background rounded-lg flex-1">
                  <button onClick={() => updatePanel(idx, { stake: String(Math.max(5, Number(panels[idx].stake) - 10).toFixed(2)) })} disabled={panels[idx].hasBet} className="px-2 py-2 text-muted-foreground text-lg font-bold disabled:opacity-30">−</button>
                  <input type="number" value={panels[idx].stake} onChange={e => updatePanel(idx, { stake: e.target.value })} disabled={panels[idx].hasBet}
                    className="w-full bg-transparent text-center text-foreground font-bold text-sm outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => updatePanel(idx, { stake: String((Number(panels[idx].stake) + 10).toFixed(2)) })} disabled={panels[idx].hasBet} className="px-2 py-2 text-muted-foreground text-lg font-bold disabled:opacity-30">+</button>
                </div>
                {!panels[idx].hasBet ? (
                  <button onClick={() => handlePlaceBet(idx)} disabled={panelBusy[idx]} className={`px-6 py-3 rounded-xl font-bold text-sm ${THEME.betBtnClass} active:scale-95 transition-transform min-w-[100px] disabled:opacity-60`}>
                    <div className="text-xs opacity-80">BET</div><div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : panels[idx].cashedOut ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm bg-success/20 text-success min-w-[100px]">✅ Won</button>
                ) : gameState === 'crashed' ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm bg-destructive/20 text-destructive min-w-[100px]">Lost</button>
                ) : gameState === 'waiting' ? (
                  <button onClick={() => handleCancelBet(idx)} disabled={panelBusy[idx]} className="px-6 py-3 rounded-xl font-bold text-sm bg-destructive text-destructive-foreground active:scale-95 transition-transform min-w-[100px] disabled:opacity-60">
                    <div className="text-xs opacity-80">CANCEL</div><div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : (
                  <button onClick={() => handleCashout(idx)} disabled={panelBusy[idx]} className="px-6 py-3 rounded-xl font-bold text-sm bg-success text-success-foreground active:scale-95 transition-transform min-w-[100px] disabled:opacity-60">
                    <div className="text-xs opacity-80">CASH OUT</div><div>৳{Math.round(Number(panels[idx].stake) * multiplier).toLocaleString()}</div>
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 mt-2">
                {[5, 50, 100, 500].map(v => (
                  <button key={v} onClick={() => updatePanel(idx, { stake: String(v.toFixed(2)) })} disabled={panels[idx].hasBet}
                    className="flex-1 py-1 text-[11px] font-bold bg-secondary hover:bg-blue-500/30 hover:text-blue-300 text-muted-foreground rounded transition-colors disabled:opacity-30">{v}</button>
                ))}
              </div>
              {panels[idx].mode === 'auto' && (
                <div className="mt-2">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Auto Cash Out (x)</label>
                  <input type="number" value={panels[idx].autoCashout} onChange={e => updatePanel(idx, { autoCashout: e.target.value })} disabled={panels[idx].hasBet}
                    className="w-full bg-background rounded-lg px-3 py-1.5 text-foreground text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              )}
            </div>
          ))}

          {/* All Bets / My Bets / Top */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs text-muted-foreground"><span className="text-blue-400 font-bold">{onlineCount.toLocaleString()}</span> online</span>
              </div>
            </div>
            <div className="flex gap-0 mb-2">
              {(['all', 'my', 'top'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-1.5 text-xs font-bold capitalize ${
                  activeTab === tab ? `${THEME.tabActiveClass} rounded-t-lg` : 'bg-muted text-muted-foreground'
                }`}>{tab === 'all' ? 'All Bets' : tab === 'my' ? 'My Bets' : 'Top'}</button>
              ))}
            </div>
            <div className={`bg-card rounded-b-xl ${THEME.cardBorder} p-2`}>
              {activeTab === 'top' ? (
                <>
                  <div className="flex gap-1 mb-2">
                    {(['today', 'week', 'month'] as const).map(st => (
                      <button key={st} onClick={() => setTopSubTab(st)} className={`flex-1 py-1 text-[10px] font-bold rounded-md ${
                        topSubTab === st ? 'bg-blue-500 text-white' : 'bg-secondary text-muted-foreground'
                      }`}>{st === 'today' ? 'Today' : st === 'week' ? 'This Week' : 'This Month'}</button>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex mb-1 px-1">
                    <span className="w-5">#</span><span className="flex-1">Player</span><span className="w-16 text-right">Max X</span><span className="w-20 text-right">Payout</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {(topSubTab === 'today' ? getTodayTopPlayers() : topSubTab === 'week' ? getWeekTopPlayers() : getMonthTopPlayers()).map((p, i) => (
                      <div key={p.id} className={`flex items-center py-1.5 px-1 text-xs border-b border-border last:border-0 ${i < 3 ? 'bg-blue-500/5' : ''}`}>
                        <span className={`w-5 font-bold ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                        <span className="flex-1 truncate text-foreground font-medium">{p.username}</span>
                        <span className="w-16 text-right text-yellow-400 font-bold">{p.maxMultiplier.toFixed(2)}x</span>
                        <span className="w-20 text-right text-success font-bold">৳{p.payout.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
                    <span className="text-foreground font-bold text-xs">{activeTab === 'all' ? 'ALL BETS' : 'MY BETS'} <span className="text-muted-foreground">{activeTab === 'all' ? totalRoundPlayers.toLocaleString() : displayedRoundBets.length}</span></span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground">👥 <span className="text-blue-400 font-bold">{totalRoundPlayers.toLocaleString()}</span></span>
                      <span className="text-[10px] text-muted-foreground">💰 <span className="text-success font-bold">৳{liveTotalBet.toLocaleString()}</span></span>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex mb-1 px-1">
                    <span className="flex-1">User</span><span className="w-16 text-right">Bet</span><span className="w-14 text-right">X</span><span className="w-20 text-right">Cash Out</span>
                  </div>
                  {displayedRoundBets.length === 0 && (
                    <p className="text-center text-muted-foreground text-xs py-3">{gameState === 'waiting' ? 'Waiting for next round...' : 'No bets'}</p>
                  )}
                  <div className="max-h-[250px] overflow-y-auto">
                    {displayedRoundBets.map((b) => (
                      <div key={b.id} className={`flex items-center py-1.5 px-1 text-xs border-b border-border last:border-0 ${
                        b.status === 'cashed_out' ? 'bg-success/5' : b.status === 'lost' ? 'bg-destructive/5' : ''
                      }`}>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-foreground ${b.isReal ? 'bg-blue-500' : 'bg-secondary'}`}>{b.isReal ? '⭐' : '👤'}</div>
                          <span className={`truncate max-w-[80px] ${b.isReal ? 'text-blue-400 font-bold' : 'text-muted-foreground'}`}>{b.username}</span>
                        </div>
                        <span className="w-16 text-right text-muted-foreground">৳{b.bet_amount.toLocaleString()}</span>
                        <span className={`w-14 text-right font-bold ${b.status === 'cashed_out' ? 'text-yellow-400' : b.status === 'lost' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {b.status === 'cashed_out' && b.cashout_multiplier ? `${b.cashout_multiplier.toFixed(2)}x` : b.status === 'lost' ? '✗' : '•••'}
                        </span>
                        <span className={`w-20 text-right font-bold ${b.status === 'cashed_out' ? 'text-success' : b.status === 'lost' ? 'text-destructive/60' : 'text-muted-foreground animate-pulse'}`}>
                          {b.status === 'cashed_out' && b.win_amount ? `+৳${b.win_amount.toLocaleString()}` : b.status === 'lost' ? `-৳${b.bet_amount.toLocaleString()}` : 'Playing...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default TurboCrashGame;
