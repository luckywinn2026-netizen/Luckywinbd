import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Volume2, VolumeX, HelpCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { supabase } from '@/integrations/supabase/client';

// Color mapping
const numberToColors = (num: number): string[] => {
  if (num === 0) return ['red', 'violet'];
  if (num === 5) return ['green', 'violet'];
  return num % 2 === 0 ? ['red'] : ['green'];
};

interface HistoryEntry {
  period: string;
  number: number;
  colors: string[];
  payout?: number;
  totalBet?: number;
  timestamp?: number;
}

interface StrategyRecord {
  wins: number;
  losses: number;
  streak: number;
  lastResults: ('W' | 'L')[];
}

interface LiveBet {
  id: string;
  username_snapshot: string | null;
  bet_type: string;
  bet_value: string;
  bet_amount: number;
  payout: number;
  created_at: string;
}

interface MyBetHistory {
  id: string;
  bet_type: string;
  bet_value: string;
  bet_amount: number;
  payout: number;
  is_win: boolean | null;
  period_id: string;
  created_at: string;
}

type TimerMode = 0.5 | 1 | 3 | 5;
type TabView = 'history' | 'mybets';

// 3D Orb component for number display
const NumberOrb = ({ num, size = 'md', selected = false, disabled = false, onClick }: {
  num: number; size?: 'sm' | 'md' | 'lg'; selected?: boolean; disabled?: boolean; onClick?: () => void;
}) => {
  const colors = numberToColors(num);
  const isDouble = colors.length === 2;
  const baseColor = isDouble
    ? 'from-[hsl(0,75%,55%)] via-[hsl(280,60%,50%)] to-[hsl(280,70%,45%)]'
    : colors[0] === 'red'
      ? 'from-[hsl(0,80%,60%)] via-[hsl(0,75%,50%)] to-[hsl(0,70%,40%)]'
      : 'from-[hsl(145,70%,55%)] via-[hsl(145,65%,45%)] to-[hsl(145,60%,35%)]';

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  // Decorative petals around the orb
  const petalColor = colors[0] === 'red' ? 'hsl(0, 75%, 55%)' : colors[0] === 'green' ? 'hsl(145, 65%, 50%)' : 'hsl(280, 60%, 50%)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group transition-all duration-200 active:scale-90 disabled:opacity-40 ${selected ? 'scale-110' : 'hover:scale-105'}`}
    >
      {/* Decorative ring petals - only for md/lg */}
      {size !== 'sm' && (
        <div className="absolute inset-[-6px] z-0">
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <div
              key={deg}
              className="absolute w-3 h-3 rounded-full opacity-40"
              style={{
                background: petalColor,
                top: '50%',
                left: '50%',
                transform: `rotate(${deg}deg) translate(${size === 'lg' ? 26 : 20}px) translate(-50%, -50%)`,
                filter: 'blur(1px)',
              }}
            />
          ))}
        </div>
      )}
      {/* Main orb */}
      <div className={`relative z-10 rounded-full bg-gradient-to-b ${baseColor} ${sizeClasses[size]} flex items-center justify-center font-heading font-extrabold text-white shadow-lg ${selected ? 'ring-3 ring-amber-400 ring-offset-2 ring-offset-background' : ''}`}
        style={{
          boxShadow: selected
            ? `0 0 20px ${petalColor}, 0 4px 12px rgba(0,0,0,0.4)`
            : '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
        }}
      >
        {/* Inner highlight */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[60%] h-[35%] bg-white/25 rounded-full blur-[1px]" />
        <span className="relative z-10 drop-shadow-lg">{num}</span>
      </div>
    </button>
  );
};

// Circular countdown with arc
const CircularCountdown = ({ seconds, totalSeconds }: { seconds: number; totalSeconds: number }) => {
  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="45"
          fill="none" stroke="hsl(0, 70%, 55%)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-extrabold text-2xl text-foreground">{seconds}</span>
      </div>
    </div>
  );
};

// Previous result card (diagonal split for dual colors, solid for single)
const ResultCard = ({ num, colors }: { num: number; colors: string[] }) => {
  const colorMap: Record<string, string> = { red: 'hsl(0, 75%, 55%)', green: 'hsl(145, 65%, 50%)', violet: 'hsl(280, 60%, 50%)' };
  const c1 = colors[0] ? colorMap[colors[0]] : 'hsl(0,0%,40%)';
  const c2 = colors[1] ? colorMap[colors[1]] : c1;
  const isSplit = colors.length >= 2;
  const bg = isSplit
    ? `linear-gradient(135deg, ${c1} 0%, ${c1} 50%, ${c2} 50%, ${c2} 100%)`
    : c1;
  return (
    <div
      className="w-20 h-20 rounded-xl overflow-hidden relative flex items-center justify-center"
      style={{
        background: bg,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <span className="font-heading font-extrabold text-3xl text-white drop-shadow-lg z-10">{num}</span>
    </div>
  );
};

// Color dot for history
const ColorDot = ({ color, size = 'sm' }: { color: string; size?: 'sm' | 'md' }) => {
  const cls = color === 'red'
    ? 'bg-[hsl(0,75%,55%)]'
    : color === 'green'
      ? 'bg-[hsl(145,65%,50%)]'
      : 'bg-[hsl(280,60%,50%)]';
  return <span className={`rounded-full inline-block ${size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5'} ${cls}`} />;
};

const PRESENCE_CHANNEL = 'color-prediction-viewers';

const ColorPredictionGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const [showSplash, setShowSplash] = useState(true);
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);

  const [timerMode, setTimerMode] = useState<TimerMode>(0.5);
  const [timeLeft, setTimeLeft] = useState(60);
  const [periodNumber, setPeriodNumber] = useState('');
  const [phase, setPhase] = useState<'betting' | 'waiting' | 'result'>('betting');
  const [betAmount, setBetAmount] = useState(0.5);
  const [betMultiplier, setBetMultiplier] = useState(1);
  const [result, setResult] = useState<{ number: number; colors: string[]; payout: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [myBetHistory, setMyBetHistory] = useState<MyBetHistory[]>([]);
  const [betLoading, setBetLoading] = useState(false);
  const [liveViewerCount, setLiveViewerCount] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showBetModal, setShowBetModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('history');
  const [lastWin, setLastWin] = useState(0);
  const betLockedRef = useRef(false);
  const lastPeriodRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [strategyRecords, setStrategyRecords] = useState<Record<string, StrategyRecord>>({
    ColorTrend: { wins: 0, losses: 0, streak: 0, lastResults: [] },
    NumberHunter: { wins: 0, losses: 0, streak: 0, lastResults: [] },
  });
  const lastPredictionsRef = useRef<Record<string, { type: string; value: string }>>({});

  useActivePlayer('color-prediction', 'Lucky Color Prediction', 'slot', betAmount * betMultiplier);

  // Helper: check if a strategy prediction was correct given a result number
  const checkStrategyPrediction = useCallback((pred: { type: string; value: string }, resultNum: number): boolean => {
    if (pred.type === 'color') {
      return numberToColors(resultNum).includes(pred.value);
    }
    if (pred.type === 'number') {
      return String(resultNum) === pred.value;
    }
    return false;
  }, []);

  const trackStrategies = useCallback((resultNum: number) => {
    const preds = lastPredictionsRef.current;
    if (Object.keys(preds).length === 0) return;

    setStrategyRecords(prev => {
      const next = { ...prev };
      for (const [name, pred] of Object.entries(preds)) {
        const won = checkStrategyPrediction(pred, resultNum);
        const rec = { ...(next[name] || { wins: 0, losses: 0, streak: 0, lastResults: [] }) };
        if (won) {
          rec.wins++;
          rec.streak = rec.streak >= 0 ? rec.streak + 1 : 1;
        } else {
          rec.losses++;
          rec.streak = rec.streak <= 0 ? rec.streak - 1 : -1;
        }
        rec.lastResults = [won ? 'W' : 'L', ...rec.lastResults.slice(0, 9)];
        next[name] = rec;
      }
      return next;
    });
  }, [checkStrategyPrediction]);

  const effectiveBet = betAmount * betMultiplier;

  const generatePeriodNumber = useCallback((mode: TimerMode) => {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const periodSeconds = mode * 60;
    const totalSecondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const seq = Math.floor(totalSecondsSinceMidnight / periodSeconds);
    return `${date}${String(seq).padStart(4, '0')}`;
  }, []);

  const calcTimeLeft = useCallback((mode: TimerMode) => {
    const now = new Date();
    const totalSeconds = now.getMinutes() * 60 + now.getSeconds();
    const periodSeconds = mode * 60;
    return periodSeconds - (totalSeconds % periodSeconds);
  }, []);

  useEffect(() => {
    const tick = () => {
      const remaining = calcTimeLeft(timerMode);
      const newPeriod = generatePeriodNumber(timerMode);

      if (remaining >= timerMode * 60 - 1 && phase !== 'betting') {
        const prevPeriod = lastPeriodRef.current;
        if (prevPeriod) {
          supabase
            .from('color_rounds')
            .select('winning_number, winning_color, winning_colors')
            .eq('period_id', prevPeriod)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.winning_number != null) {
                const winColors = Array.isArray(data.winning_colors) && data.winning_colors.length > 0
                  ? data.winning_colors
                  : numberToColors(data.winning_number);
                setHistory(prev => {
                  if (prev.some(h => h.period === prevPeriod)) return prev;
                  return [{
                    period: prevPeriod,
                    number: data.winning_number,
                    colors: winColors,
                    payout: 0,
                    timestamp: Date.now(),
                  }, ...prev.slice(0, 29)];
                });
              }
            })
            .catch(() => {});
        }
        lastPeriodRef.current = newPeriod;
        setPhase('betting');
        betLockedRef.current = false;
        setResult(null);
        setShowBigWin(false);
        setLastWin(0);
      }

      if (remaining <= 10 && phase === 'betting') {
        setPhase('waiting');
        betLockedRef.current = true;
      }

      lastPeriodRef.current = newPeriod;
      setTimeLeft(remaining);
      setPeriodNumber(newPeriod);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerMode, phase]);

  // Subscribe to live bets for current period
  useEffect(() => {
    if (!periodNumber) return;

    let isCancelled = false;

    const loadAndSubscribe = async () => {
      const { data } = await supabase
        .from('color_bets')
        .select('id, username_snapshot, bet_type, bet_value, bet_amount, payout, created_at, period_id')
        .eq('period_id', periodNumber)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isCancelled) {
        setLiveBets((data || []) as LiveBet[]);
      }

      const channel = supabase
        .channel(`color_bets_${periodNumber}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'color_bets', filter: `period_id=eq.${periodNumber}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newBet = payload.new as LiveBet;
              setLiveBets((prev) => [newBet, ...prev].slice(0, 50));
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as LiveBet;
              setLiveBets((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = loadAndSubscribe();

    return () => {
      isCancelled = true;
      // Ensure cleanup
      Promise.resolve(cleanupPromise).catch(() => {});
    };
  }, [periodNumber]);

  // Fetch my bet history when My Bets tab is active
  useEffect(() => {
    if (activeTab !== 'mybets' || !user?.id) return;
    supabase
      .from('color_bets')
      .select('id, bet_type, bet_value, bet_amount, payout, is_win, period_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMyBetHistory((data || []) as MyBetHistory[]);
      })
      .catch(() => {});
  }, [activeTab, user?.id]);

  // Subscribe to presence for live viewer count
  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setLiveViewerCount(count > 0 ? count : 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const placeBetImmediate = useCallback(async (type: string, value: string) => {
    if (betLockedRef.current || phase !== 'betting') {
      toast.error('Betting time is over!');
      return;
    }
    const amount = effectiveBet;
    if (amount < 0.5) { toast.error('Minimum bet ৳0.5'); return; }
    if (amount > balance) { toast.error('Insufficient balance'); return; }
    if (betLoading) return;

    setBetLoading(true);
    try {
      const data = await api.colorPredictionRound({
        period_id: periodNumber,
        timer_mode: timerMode,
        bets: [{ type, value, amount }],
      });

      const winNum = data.winning_number;
      const winColors = data.winning_colors || numberToColors(winNum);
      const totalPayout = Number(data.payout || 0);
      const totalBetAmount = Number(data.total_bet || amount);

      setResult({ number: winNum, colors: winColors, payout: totalPayout });
      setLastWin(totalPayout);
      trackStrategies(winNum);
      setHistory(prev => [{
        period: periodNumber,
        number: winNum,
        colors: winColors,
        payout: totalPayout,
        totalBet: totalBetAmount,
        timestamp: Date.now(),
      }, ...prev.slice(0, 29)]);
      applyAuthoritativeBalance(data.newBalance);

      toast.success(totalPayout > 0 ? `Won ৳${totalPayout.toLocaleString()}!` : `Bet placed: ৳${amount}`);
      if (totalPayout > 0 && totalPayout >= totalBetAmount * 4) setShowBigWin(true);

      if (user?.id) {
        supabase
          .from('color_bets')
          .select('id, bet_type, bet_value, bet_amount, payout, is_win, period_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(({ data }) => setMyBetHistory((data || []) as MyBetHistory[]))
          .catch(() => {});
      }
    } catch (e) {
      console.error('Color prediction failed', e);
      toast.error(e instanceof Error ? e.message : 'Failed to place bet');
    } finally {
      setBetLoading(false);
    }
  }, [phase, effectiveBet, balance, periodNumber, timerMode, betLoading, user?.id, applyAuthoritativeBalance, trackStrategies]);

  const handleColorBet = (color: string) => placeBetImmediate('color', color);
  const handleNumberBet = (num: number) => placeBetImmediate('number', String(num));

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🎨 Lucky Color Prediction" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2 gold-gradient">
          <button onClick={() => navigate('/slots')} className="p-1.5 rounded-lg bg-black/20">
            <ArrowLeft size={20} className="text-primary-foreground" />
          </button>
          <div className="flex-1 flex flex-col items-center">
            <h1 className="font-heading font-extrabold text-lg text-primary-foreground" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.2)' }}>
              Color Prediction
            </h1>
            <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded font-mono mt-0.5">{periodNumber || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHowToPlay(true)} className="p-1.5 rounded-lg bg-black/20">
              <HelpCircle size={16} className="text-primary-foreground" />
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg bg-black/20">
              {soundEnabled ? <Volume2 size={16} className="text-primary-foreground" /> : <VolumeX size={16} className="text-primary-foreground" />}
            </button>
          </div>
        </div>

        {/* Main Game Area: Result Card + Countdown */}
        <div className="mx-3 mt-3 flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
          {/* Left: Previous result card */}
          <div className="flex flex-col items-center gap-1">
            {history.length > 0 ? (
              <ResultCard num={history[0].number} colors={history[0].colors} />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-muted/50 flex items-center justify-center">
                <span className="text-2xl text-muted-foreground">—</span>
              </div>
            )}
            <p className="text-[9px] text-muted-foreground">Last Result</p>
          </div>

          {/* Right: Circular countdown */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] text-muted-foreground font-heading font-bold">Countdown</p>
            <CircularCountdown seconds={timeLeft} totalSeconds={timerMode * 60} />
          </div>
        </div>

        {/* Min/Max + Live players */}
        <div className="mx-3 mt-2 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Min 0.5 Max 100</p>
          <div className="flex items-center gap-1.5">
            <User size={14} className="text-muted-foreground" />
            <span className="text-xs font-heading font-bold text-foreground">{liveViewerCount}</span>
            <span className="text-[10px] text-muted-foreground">live</span>
          </div>
        </div>

        {/* Timer mode tabs */}
        <div className="flex gap-1 mx-3 mt-2">
          {([0.5, 1, 3, 5] as TimerMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setTimerMode(m); setPhase('betting'); betLockedRef.current = false; }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-heading font-bold transition-all ${timerMode === m ? 'gold-gradient text-primary-foreground shadow-md' : 'bg-card text-muted-foreground border border-border'}`}
            >
              {m === 0.5 ? '30s' : m === 1 ? '1min' : m === 3 ? '3min' : '5min'}
            </button>
          ))}
        </div>

        {/* Result Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              className="mx-3 mt-2 rounded-2xl p-3 text-center origin-top bg-card gold-border"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <NumberOrb num={result.number} size="lg" />
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">Result</p>
                  <div className="flex gap-1 mt-1">
                    {result.colors.map((c, i) => <ColorDot key={i} color={c} size="md" />)}
                  </div>
                  <p className="text-xs mt-1 font-heading text-muted-foreground">{result.colors.join(' + ')}</p>
                </div>
              </div>
              {result.payout > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.2, 1] }} className="flex items-center justify-center gap-2">
                  <p className="font-heading font-extrabold text-lg text-primary">
                    🎉 Won ৳{result.payout.toLocaleString()}!
                  </p>
                  <button onClick={() => setResult(null)} className="text-muted-foreground text-xs bg-secondary rounded-full px-2 py-0.5 hover:bg-secondary/80">✕</button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Big Win Overlay */}
        <AnimatePresence>
          {showBigWin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowBigWin(false)}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-center">
                <p className="text-6xl mb-2">🏆</p>
                <p className="text-amber-400 font-heading font-extrabold text-4xl">BIG WIN!</p>
                <p className="text-white font-heading font-bold text-2xl mt-2">৳{result?.payout.toLocaleString()}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color Buttons - with multipliers and live bet badges */}
        <div className="grid grid-cols-3 gap-2.5 px-3 mt-3">
          {[
            { color: 'green', label: 'Green', bg: 'hsl(145, 65%, 50%)', mult: 'x2.0 or x1.6' },
            { color: 'violet', label: 'Violet', bg: 'hsl(280, 55%, 50%)', mult: 'x4.8' },
            { color: 'red', label: 'Red', bg: 'hsl(0, 70%, 55%)', mult: 'x2.0 or x1.6' },
          ].map(({ color, label, bg, mult }) => {
            const liveCount = liveBets.filter(b => b.bet_type === 'color' && b.bet_value === color).length;
            const showBadge = liveCount > 0;
            return (
              <button
                key={color}
                onClick={() => handleColorBet(color)}
                disabled={phase !== 'betting' || betLoading}
                className={`relative py-3 rounded-xl font-heading font-bold text-white text-sm transition-all active:scale-95 disabled:opacity-40 flex flex-col items-center`}
                style={{
                  background: bg,
                  boxShadow: `0 4px 12px ${bg}55`,
                }}
              >
                {label}
                <span className="text-[10px] opacity-90 mt-0.5">{mult}</span>
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center bg-amber-400 text-black text-[9px] font-extrabold rounded-full px-1.5 shadow-md">
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Number Grid - with x9 multiplier and live bet badges */}
        <div className="px-3 mt-3">
          <p className="text-[10px] font-heading font-bold text-muted-foreground mb-1.5">Numbers <span className="text-primary">x9</span></p>
          <div className="grid grid-cols-5 gap-2 justify-items-center">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
              const liveCount = liveBets.filter(b => b.bet_type === 'number' && b.bet_value === String(n)).length;
              const showBadge = liveCount > 0;
              return (
                <div key={n} className="relative">
                  <NumberOrb
                    num={n}
                    size="md"
                    selected={false}
                    disabled={phase !== 'betting' || betLoading}
                    onClick={() => handleNumberBet(n)}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4 flex items-center justify-center bg-amber-400 text-black text-[8px] font-extrabold rounded-full px-1 shadow-md z-20">
                      {liveCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Balance + WIN + Action buttons */}
        <div className="mx-3 mt-3 flex items-center justify-between">
          <span className="text-xs font-heading text-muted-foreground">Balance: <span className="font-bold text-foreground">৳{balance.toLocaleString()}</span></span>
          <span className="text-xs font-heading text-muted-foreground">WIN: <span className="font-bold text-primary">৳{lastWin.toLocaleString()}</span></span>
        </div>
        <div className="mx-3 mt-2 flex justify-center">
          <button
            onClick={() => setShowBetModal(true)}
            className="py-2 px-6 rounded-lg border border-border text-muted-foreground text-[10px] font-heading font-bold flex items-center justify-center gap-1 bg-card hover:bg-secondary/50"
          >
            <Plus size={14} /> Bet ৳{betAmount}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-3 mt-4">
          {[
            { key: 'history' as TabView, label: 'History' },
            { key: 'mybets' as TabView, label: 'My Bets' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-heading font-bold rounded-t-xl transition-all ${activeTab === tab.key ? 'gold-gradient text-primary-foreground' : 'text-muted-foreground bg-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-3 pb-24 bg-card mx-3 rounded-b-xl mb-4 border border-border border-t-0">
          {activeTab === 'history' && (
            <div className="pt-2">
              {/* Live bets for current period */}
              <div className="mb-3">
                <p className="text-[10px] font-heading font-bold text-muted-foreground mb-1">👥 Live players this round</p>
                {liveBets.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2 text-center">No live bets yet</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-secondary/40">
                    {liveBets.map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-2.5 py-1.5 text-[11px] border-b border-border/60 last:border-b-0">
                        <div className="flex flex-col">
                          <span className="font-heading text-foreground">
                            {b.username_snapshot || 'Player'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {b.bet_type === 'color'
                              ? `Color: ${b.bet_value.toUpperCase()}`
                              : `Number: ${b.bet_value}`}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-heading font-bold text-foreground">৳{b.bet_amount}</p>
                          {b.payout > 0 && (
                            <p className="text-[10px] font-heading text-green-400">Win ৳{b.payout}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History table: Price, Result, Time, WIN, Fairness */}
              {history.length === 0 ? (
                <p className="text-center text-xs py-6 text-muted-foreground">No results yet</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-5 text-[10px] font-heading font-bold py-2 border-b border-border text-muted-foreground">
                    <span>Price</span>
                    <span className="text-center">Result</span>
                    <span className="text-center">Time</span>
                    <span className="text-center">WIN</span>
                    <span className="text-center">Fairness</span>
                  </div>
                  {history.slice(0, 15).map((h, i) => (
                    <motion.div
                      key={h.period + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-5 items-center py-2 border-b border-border text-[11px]"
                    >
                      <span className="font-mono text-muted-foreground truncate">{h.period.slice(-8)}</span>
                      <div className="flex justify-center items-center gap-1">
                        <span className="font-heading font-extrabold text-foreground">{h.number}</span>
                        <div className="flex gap-0.5">
                          {h.colors.map((c, ci) => <ColorDot key={ci} color={c} size="sm" />)}
                        </div>
                      </div>
                      <span className="text-center text-muted-foreground text-[10px]">
                        {h.timestamp ? new Date(h.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </span>
                      <span className={`text-center font-heading font-bold ${(h.payout ?? 0) > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                        ৳{h.payout ?? 0}
                      </span>
                      <span className="text-center text-muted-foreground text-[9px]">Provably Fair</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'mybets' && (
            <div className="pt-2">
              <p className="text-[10px] font-heading font-bold text-muted-foreground mb-2">💳 আপনার বেট হিস্টোরি</p>
              {myBetHistory.length === 0 ? (
                <p className="text-center text-xs py-6 text-muted-foreground">এখনো কোনো বেট নেই</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {myBetHistory.map(bet => (
                    <div key={bet.id} className="flex items-center justify-between bg-secondary rounded-lg px-2.5 py-2 border border-border">
                      <div>
                        <span className="text-[11px] font-heading text-foreground">
                          {bet.bet_type === 'color' ? `🎨 ${bet.bet_value.toUpperCase()}` : `🔢 Number ${bet.bet_value}`}
                          <span className="text-muted-foreground ml-1">৳{bet.bet_amount}</span>
                        </span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {new Date(bet.created_at).toLocaleString('bn-BD')}
                        </p>
                      </div>
                      <div className="text-right">
                        {bet.payout > 0 ? (
                          <span className="text-[11px] font-heading font-bold text-green-500">+৳{bet.payout}</span>
                        ) : (
                          <span className="text-[11px] font-heading text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Default Bet Modal */}
      <AnimatePresence>
        {showBetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowBetModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-xl w-full max-w-[min(95vw,320px)] p-4 shadow-2xl border border-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-sm text-foreground">Default Bet</h3>
                <button onClick={() => setShowBetModal(false)} className="text-muted-foreground hover:text-foreground text-lg font-bold">✕</button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">Select your default bet amount</p>
              <div className="grid grid-cols-5 gap-2">
                {[0.5, 1, 2, 5, 10, 20, 50, 100, 500].map(v => (
                  <button
                    key={v}
                    onClick={() => { setBetAmount(v); setShowBetModal(false); toast.success(`Default bet: ৳${v}`); }}
                    className={`py-2 rounded-lg text-xs font-heading font-bold transition-all ${betAmount === v ? 'gold-gradient text-primary-foreground shadow-md' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                  >
                    ৳{v}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* How to Play Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-card rounded-2xl w-full max-w-[min(95vw,400px)] max-h-[85vh] overflow-y-auto shadow-2xl border border-border"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card rounded-t-2xl px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
                <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <HelpCircle size={20} className="text-primary" /> How to Play
                </h2>
                <button onClick={() => setShowHowToPlay(false)} className="text-muted-foreground hover:text-foreground text-xl font-bold">✕</button>
              </div>

              <div className="p-5 space-y-5">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(0,75%,55%)] text-white flex items-center justify-center font-bold text-sm shrink-0">1</div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-foreground">Select a Timer</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Choose any mode: WinGo 30s, 1min, 3min or 5min.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(145,65%,50%)] text-white flex items-center justify-center font-bold text-sm shrink-0">2</div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-foreground">Place Your Bet</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Bet on Color (🔴 Red, 🟢 Green, 🟣 Violet) or Number (0-9).</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(280,60%,50%)] text-white flex items-center justify-center font-bold text-sm shrink-0">3</div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-foreground">See the Result</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">When the timer ends, a number from 0-9 appears. If your prediction is correct, you win!</p>
                  </div>
                </div>

                {/* Payout Table */}
                <div className="bg-secondary/50 rounded-xl p-4">
                  <h3 className="font-heading font-bold text-sm text-foreground mb-3">💰 Payout Chart</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-muted-foreground flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[hsl(0,75%,55%)] inline-block" /> Red</span>
                      <span className="font-bold text-foreground">2x</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-muted-foreground flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[hsl(145,65%,50%)] inline-block" /> Green</span>
                      <span className="font-bold text-foreground">2x</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-muted-foreground flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[hsl(280,60%,50%)] inline-block" /> Violet</span>
                      <span className="font-bold text-foreground">4.8x</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-muted-foreground">🔢 Exact Number</span>
                      <span className="font-bold text-foreground">9x</span>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-primary/10 rounded-xl p-4">
                  <h3 className="font-heading font-bold text-sm text-foreground mb-2">💡 Tips</h3>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li>Number 0 wins both Red+Violet (payout 1.5x)</li>
                    <li>Number 5 wins both Green+Violet (payout 1.5x)</li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="w-full py-3 rounded-xl font-heading font-bold text-sm text-primary-foreground gold-gradient card-glow"
                >
                  Got it, let's play! 🎮
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthGate>
  );
};

export default ColorPredictionGame;
