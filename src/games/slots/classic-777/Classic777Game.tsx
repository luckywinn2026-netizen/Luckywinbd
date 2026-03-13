import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Zap, Volume2, VolumeX, Crown, Info, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';
import PaytableModal from '@/components/PaytableModal';
import { CLASSIC_777_PAYTABLE } from '@/config/paytableConfigs';

// ─── Symbol definitions ───
const SYMBOLS = [
  { id: '777', label: '777' },
  { id: 'bar', label: 'BAR' },
  { id: 'cherry', label: '🍒' },
  { id: 'bell', label: '🔔' },
  { id: 'diamond', label: '💎' },
  { id: 'star', label: '⭐' },
  { id: 'crown', label: '👑' },
  { id: 'clover', label: '🍀' },
];

const REEL_SYMBOLS = SYMBOLS.map(s => s.id);
const BET_PRESETS = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];

// Default casino background when no custom asset
const CASINO_BG = 'https://images.unsplash.com/photo-1596838132731-3301c3fd3637?w=1200&q=80';

// Fake winners for leaderboard (random display)
const FAKE_NAMES = ['Rahim***', 'Karim***', 'Sultana***', 'Fatima***', 'Hasan***', 'Ayesha***', 'Rafiq***', 'Nargis***', 'Jamil***', 'Shabana***', 'Akram***', 'Nasrin***'];
const FAKE_AMOUNTS = [1250, 890, 2100, 450, 3200, 780, 1560, 990, 2340, 560, 1890, 410];

const getShuffledFakeWinners = () => {
  const combined = FAKE_NAMES.map((name, i) => ({ name, amount: FAKE_AMOUNTS[i] ?? FAKE_AMOUNTS[i % FAKE_AMOUNTS.length] }));
  return [...combined].sort(() => Math.random() - 0.5);
};

// Winner leaderboard — fake + real, scrollable
const WinnerLeaderboard = ({ spinHistory }: { spinHistory: { win: boolean; amount: number }[] }) => {
  const [fakeWinners, setFakeWinners] = useState(() => getShuffledFakeWinners());
  useEffect(() => {
    const t = setInterval(() => setFakeWinners(getShuffledFakeWinners()), 8000);
    return () => clearInterval(t);
  }, []);
  const realWins = spinHistory.filter(s => s.win && s.amount > 0).slice(0, 5);
  const displayList = [...realWins.map(r => ({ name: 'You', amount: r.amount, isReal: true })), ...fakeWinners.slice(0, 12 - realWins.length).map(f => ({ ...f, isReal: false }))];
  return (
    <div className="shrink-0 px-3 py-2">
      <div className="rounded-xl p-2 max-w-[min(95vw,480px)] mx-auto" style={{
        background: 'linear-gradient(180deg, rgba(26,15,10,0.9) 0%, rgba(15,8,5,0.95) 100%)',
        border: '1px solid rgba(212,168,67,0.4)',
      }}>
        <p className="text-[10px] font-bold text-center mb-2 uppercase tracking-wider" style={{ color: '#d4a843' }}>Recent Winners</p>
        <div className="space-y-1 overflow-y-auto max-h-[140px] overscroll-contain" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(212,168,67,0.5) transparent',
        }}>
          {displayList.map((w, i) => (
            <div key={i} className="flex justify-between items-center text-[11px] px-2 py-1 rounded" style={{ background: w.isReal ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)' }}>
              <span style={{ color: w.isReal ? '#22c55e' : 'rgba(255,255,255,0.7)' }}>{w.name}</span>
              <span className="font-bold" style={{ color: '#d4a843' }}>৳{w.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Cylinder geometry (bigger for visibility) ───
const NUM_FACES = SYMBOLS.length; // 8 faces
const CELL_H = 88;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

// ─── Symbol Rendering ───
const SymbolFace = ({ symbolId }: { symbolId: string }) => {
  const sym = SYMBOLS.find(s => s.id === symbolId) || SYMBOLS[0];

  if (sym.id === '777') {
    return (
      <span className="select-none font-black italic" style={{
        fontSize: 44,
        color: '#e11d48',
        textShadow: '0 0 15px rgba(225,29,72,0.8), 0 0 30px rgba(251,146,60,0.4), 2px 2px 0 #991b1b',
        fontFamily: 'serif',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}>
        777
      </span>
    );
  }

  if (sym.id === 'bar') {
    return (
      <div className="px-2 py-0.5 rounded" style={{
        background: 'linear-gradient(180deg, #1e3a5f 0%, #0f1d30 100%)',
        border: '2px solid #d4a843',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)',
      }}>
        <span className="font-black tracking-widest select-none" style={{
          fontSize: 22,
          color: '#f0e6d0',
          textShadow: '1px 1px 0 #000',
          fontFamily: 'serif',
        }}>
          BAR
        </span>
      </div>
    );
  }

  return <span className="select-none" style={{ fontSize: 40 }}>{sym.label}</span>;
};

// ─── 3D Cylinder Reel (Money Coming Style) ───
const CylinderReel = ({
  finalIdx, spinning, reelIndex, onStop, isWin, spinId, turbo,
}: {
  finalIdx: number; spinning: boolean; reelIndex: number; onStop: () => void;
  isWin: boolean; spinId: number; turbo: boolean;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIdx * FACE_ANGLE));
  const animRef = useRef<number>();
  const currentAngleRef = useRef(-(finalIdx * FACE_ANGLE));
  const startTimeRef = useRef(0);
  const SPIN_DURATION = turbo ? (100 + reelIndex * 30) : (150 + reelIndex * 50);
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  // Phase 1: Free spin (continuous rotation)
  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = turbo ? 14 : (8 + reelIndex * 1.5);
    const animate = () => {
      currentAngleRef.current -= speed;
      setRotationX(currentAngleRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning]);

  // Phase 2: Landing with easing + bounce
  useEffect(() => {
    if (!spinning || landingTriggered.current) return;
    if (spinId === lastSpinIdRef.current) return;
    lastSpinIdRef.current = spinId;
    landingTriggered.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startAngle = currentAngleRef.current;
    const fullRotations = turbo ? 1 : (1 + reelIndex * 0.5);
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.7) {
        eased = progress / 0.7 * 0.85;
      } else {
        const t = (progress - 0.7) / 0.3;
        const decel = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI * 1.5) * 0.015 * (1 - t);
        eased = 0.85 + 0.15 * decel + bounce;
      }
      eased = Math.min(Math.max(eased, 0), 1.005);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const finalAngle = -(finalIdx * FACE_ANGLE);
        currentAngleRef.current = finalAngle;
        setRotationX(finalAngle);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 280;

  const faces = SYMBOLS.map((sym, i) => (
    <div key={i} className="absolute w-full flex items-center justify-center"
      style={{
        height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`,
        transform: `rotateX(${i * FACE_ANGLE}deg) translateZ(${CYLINDER_RADIUS}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      <SymbolFace symbolId={sym.id} />
    </div>
  ));

  return (
    <div className="relative flex-1" style={{ height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #5a3010 0%, #7a4015 5%, #9a5520 10%, #1e1e3a 15%, #2a2a50 25%, #32326a 40%, #3a3a7a 50%, #32326a 60%, #2a2a50 75%, #1e1e3a 85%, #9a5520 90%, #7a4015 95%, #5a3010 100%)',
        border: '4px solid #ffd700',
        boxShadow: '0 0 0 3px #1a1a1a, 0 0 0 5px #ffd700, 0 12px 40px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.4), inset 0 0 30px rgba(255,215,0,0.08)',
      }}>
        {/* Polished gold rivets */}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 4, background: 'radial-gradient(circle at 35% 35%, #fff4cc, #e6c35c 40%, #b8860b 70%, #8b6914)', boxShadow: '0 1px 2px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[6px] h-[6px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 4, background: 'radial-gradient(circle at 35% 35%, #fff4cc, #e6c35c 40%, #b8860b 70%, #8b6914)', boxShadow: '0 1px 2px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)' }} />
        ))}

        {/* Gold bands top & bottom — polished */}
        <div className="absolute top-0 left-0 right-0 h-[32px] z-10"
          style={{ background: 'linear-gradient(180deg, #3d2817, #5a3d1a, #8b6914 40%, rgba(139,105,20,0.3) 100%)', borderBottom: '3px solid #ffd700', borderRadius: '48% 48% 0 0 / 100% 100% 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[32px] z-10"
          style={{ background: 'linear-gradient(0deg, #3d2817, #5a3d1a, #8b6914 40%, rgba(139,105,20,0.3) 100%)', borderTop: '3px solid #ffd700', borderRadius: '0 0 48% 48% / 0 0 100% 100%', boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.2)' }} />

        {/* 3D Cylinder viewport */}
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 34, bottom: 34 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>
              {faces}
            </div>
          </div>
          {/* Depth shadow — smoother gradient */}
          <div className="absolute inset-0 pointer-events-none z-10"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.02) 30%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, rgba(0,0,0,0.02) 70%, rgba(0,0,0,0.2) 85%, rgba(0,0,0,0.5) 100%)', borderRadius: '50% / 8%' }} />
        </div>

        {/* Gold ring trim — brighter highlight */}
        <div className="absolute left-0 right-0 top-[32px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 3%, #8b6914 15%, #ffd700 35%, #fff4cc 50%, #ffd700 65%, #8b6914 85%, transparent 97%)' }} />
        <div className="absolute left-0 right-0 bottom-[32px] h-[2px] z-10"
          style={{ background: 'linear-gradient(90deg, transparent 3%, #8b6914 15%, #ffd700 35%, #fff4cc 50%, #ffd700 65%, #8b6914 85%, transparent 97%)' }} />
      </div>

      {/* Win glow — polished */}
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 50px rgba(255,215,0,0.9), 0 0 80px rgba(255,191,0,0.4), inset 0 0 35px rgba(255,215,0,0.25)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game Component ───
const Classic777Game = () => {
  const navigate = useNavigate();
  const { balance, applyAuthoritativeBalance } = useWallet();
  const { user } = useAuth();
  const gameToast = useGameToast();
  const [stake, setStake] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const autoSpinRef = useRef(false);
  const spinIdRef = useRef(0);
  const [spinId, setSpinId] = useState(0);
  const stoppedCountRef = useRef(0);
  const pendingResultRef = useRef<{ winMultiplier: number; winAmount: number; newBalance: number | null }>({ winMultiplier: 0, winAmount: 0, newBalance: null });
  const pendingBetRef = useRef(0);
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('classic-777', 'Lucky Classic 777', 'slot', stake);
  const { background: customBg } = useGameAssets('classic-777');

  // Each reel stores its final symbol index (into SYMBOLS array)
  const [reelFinals, setReelFinals] = useState([0, 3, 0]); // initial display indices
  const [reelSpinning, setReelSpinning] = useState([false, false, false]);
  const [isWin, setIsWin] = useState(false);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [showBetModal, setShowBetModal] = useState(false);

  const adjustBet = (dir: number) => {
    const idx = BET_PRESETS.indexOf(stake);
    if (idx === -1) setStake(BET_PRESETS[0]);
    else {
      const next = idx + dir;
      if (next >= 0 && next < BET_PRESETS.length) setStake(BET_PRESETS[next]);
    }
  };

  const handleReelStop = useCallback((reelIndex: number) => {
    setReelSpinning(prev => {
      const next = [...prev];
      next[reelIndex] = false;
      return next;
    });
    stoppedCountRef.current++;

    // All 3 reels stopped
    if (stoppedCountRef.current >= 3) {
      const result = pendingResultRef.current;
      if (result.winMultiplier > 0) {
        setLastWin(result.winAmount);
        setIsWin(true);
        if (result.newBalance !== null) applyAuthoritativeBalance(result.newBalance);
        setSpinHistory(prev => [{ win: true, amount: result.winAmount }, ...prev.slice(0, 9)]);
      } else {
        setIsWin(false);
        if (result.newBalance !== null) applyAuthoritativeBalance(result.newBalance);
        setSpinHistory(prev => [{ win: false, amount: pendingBetRef.current }, ...prev.slice(0, 9)]);
      }
      setSpinning(false);

      // Auto spin
      if (autoSpinRef.current) {
        setTimeout(() => spin(), 200);
      }
    }
  }, []);

  const spin = async () => {
    if (spinning) return;
    const s = stake;
    if (s < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (s > balance) { gameToast.error('Insufficient balance'); return; }

    setSpinning(true);
    pendingBetRef.current = s;
    setLastWin(0);
    setIsWin(false);
    stoppedCountRef.current = 0;
    setReelSpinning([true, true, true]);

    // Get outcome
    let outcome: { outcome: string; maxWinAmount: number; newBalance: number } = { outcome: 'loss', maxWinAmount: 0, newBalance: balance };
    try {
      const data = await api.sharedSlotSpin({ bet: s, game_id: 'classic-777', game_name: 'Classic 777' });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed', e);
      gameToast.error(e instanceof Error ? e.message : 'Spin failed');
      setSpinning(false);
      setReelSpinning([false, false, false]);
      return;
    }

    // Pick final symbol indices for each reel
    const pick = () => Math.floor(Math.random() * NUM_FACES);
    const finals = [pick(), pick(), pick()];

    // Force center symbols based on outcome
    if (outcome.outcome === 'mega_win') {
      finals[0] = 0; finals[1] = 0; finals[2] = 0; // 777
    } else if (outcome.outcome === 'big_win') {
      // Pick any matching triple (all 8 symbols possible)
      const sym = pick();
      finals[0] = sym; finals[1] = sym; finals[2] = sym;
    } else if (outcome.outcome === 'small_win' || outcome.outcome === 'medium_win') {
      // Two matching + third different
      const sym = pick();
      finals[0] = sym; finals[1] = sym;
      finals[2] = (sym + 1 + Math.floor(Math.random() * (NUM_FACES - 1))) % NUM_FACES;
    } else {
      // loss - randomize but ensure no visual triple match
      // BAR has 3 variants (indices 1,2,3) that all LOOK the same
      const getLabel = (idx: number) => SYMBOLS[idx]?.label || '';
      let attempts = 0;
      do {
        finals[0] = pick();
        finals[1] = pick();
        finals[2] = pick();
        attempts++;
      } while (
        getLabel(finals[0]) === getLabel(finals[1]) && getLabel(finals[1]) === getLabel(finals[2]) && attempts < 20
      );
    }

    // Use backend amount as authoritative — avoids mismatch
    const winAmount = outcome.maxWinAmount > 0 ? outcome.maxWinAmount : 0;
    const displayMult = winAmount > 0 ? Math.round((winAmount / s) * 10) / 10 : 0;
    pendingResultRef.current = { winMultiplier: displayMult, winAmount, newBalance: outcome.newBalance };

    setReelFinals(finals);

    // Trigger landing via spinId (reels pick this up)
    spinIdRef.current++;
    setSpinId(spinIdRef.current);
  };

  useEffect(() => {
    autoSpinRef.current = autoSpin;
    if (autoSpin && !spinning) spin();
  }, [autoSpin]);

  const JACKPOT_WIN = 25000;

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🎰 Lucky Classic 777" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col relative">
        {/* Full game background — casino image */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `url(${customBg || CASINO_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} />
        <div className="absolute inset-0 z-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.5) 100%)',
        }} />
        <div className="relative z-10 flex flex-col min-h-screen">
        <style>{`
          @keyframes c7Lights { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        `}</style>

        {/* Top bar: compact */}
        <div className="flex items-center justify-between px-2 py-1.5 z-10 shrink-0">
          <button onClick={() => navigate('/slots')} className="p-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1" />
        </div>

        {/* Decorative casino title card */}
        <div className="flex flex-col items-center px-3 py-1 shrink-0">
          <div className="relative rounded-2xl px-6 py-4 w-full max-w-[min(95vw,400px)]" style={{
            background: 'linear-gradient(180deg, #6b0a0a 0%, #4a0505 30%, #3d0303 70%, #5c0808 100%)',
            border: '3px solid #d4a843',
            boxShadow: '0 0 20px rgba(212,168,67,0.4), 0 0 40px rgba(255,215,0,0.15), inset 0 2px 0 rgba(255,255,255,0.1)',
          }}>
            {/* Neon glow edges */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              boxShadow: 'inset 0 0 15px rgba(255,215,0,0.08), inset 0 0 30px rgba(0,191,255,0.05)',
            }} />
            {/* Crown — top center */}
            <div className="flex justify-center mb-1">
              <Crown size={28} style={{ color: '#d4a843', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.8))' }} />
            </div>
            {/* 777 JACKPOT — gold gradient, warm yellow neon */}
            <div className="flex items-baseline justify-center gap-1.5 flex-wrap">
              <span className="font-black text-2xl" style={{
                background: 'linear-gradient(180deg, #fff4cc 0%, #f5e6a3 30%, #d4a843 60%, #a67c2e 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                textShadow: '0 0 15px rgba(255,235,150,0.9), 0 0 25px rgba(255,215,0,0.5)',
                fontFamily: 'serif',
              }}>777 JACKPOT</span>
            </div>
            {/* SLOTS — neon cyan/blue */}
            <p className="text-center font-black text-xl tracking-widest mt-0.5" style={{
              color: '#00bfff',
              textShadow: '0 0 12px rgba(0,191,255,0.9), 0 0 24px rgba(0,191,255,0.6), 0 0 36px rgba(0,150,255,0.4)',
            }}>SLOTS</p>
            <p className="text-center text-xs font-bold mt-1" style={{ color: '#d4a843' }}>CLASSIC EDITION</p>
            {/* Credits & Win */}
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Coins size={14} style={{ color: '#d4a843' }} />
                <span className="text-sm font-bold" style={{ color: '#00bfff', textShadow: '0 0 6px rgba(0,191,255,0.6)' }}>
                  CREDITS: {balance.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-sm font-bold" style={{ color: '#d4a843' }}>WIN: {lastWin.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main slot area: reels only (no side panel) */}
        <div className="flex-1 flex justify-center items-start px-2 py-2 min-h-0 overflow-auto">
          <div className="flex flex-col max-w-[min(95vw,480px)] w-full">
              {/* Jackpot Win banner */}
              <div className="mx-auto mb-2 px-4 py-1.5 rounded" style={{
                background: 'linear-gradient(180deg, #2a1810 0%, #1a0f0a 100%)',
                border: '2px solid #d4a843',
                boxShadow: '0 0 12px rgba(212,168,67,0.3)',
              }}>
                <span className="font-black text-sm" style={{ color: '#d4a843' }}>JACKPOT WIN: {JACKPOT_WIN.toLocaleString()}</span>
              </div>

              {/* Cartoon-style frame — rounded, bold outline, playful */}
              <div className="relative rounded-2xl p-2 flex flex-col" style={{
                background: 'linear-gradient(145deg, #c41e1e 0%, #8b0000 25%, #5c0000 50%, #8b0000 75%, #c41e1e 100%)',
                boxShadow: '0 6px 0 #2a0a0a, 0 8px 25px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.3)',
                border: '4px solid #1a1a1a',
                outline: '2px solid #ffd700',
                outlineOffset: 2,
              }}>
                {/* Cartoon rivets/bolts on corners */}
                {[
                  { top: 6, left: 6 },
                  { top: 6, right: 6 },
                  { bottom: 6, left: 6 },
                  { bottom: 6, right: 6 },
                ].map((pos, i) => (
                  <div key={`rivet-${i}`} className="absolute z-30 w-6 h-6 rounded-full flex items-center justify-center" style={{
                    ...pos,
                    background: 'radial-gradient(circle at 30% 30%, #ffe066, #d4a843 50%, #8b6914 80%, #5a3d0a)',
                    border: '3px solid #1a1a1a',
                    boxShadow: '0 2px 0 rgba(255,255,255,0.4), 0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }} />
                ))}
                {/* Inner reel frame — cartoon metallic */}
                <div className="rounded-xl overflow-hidden" style={{
                  background: 'linear-gradient(180deg, #e0e0e0 0%, #c8c8c8 15%, #f0f0f0 45%, #d8d8d8 55%, #c8c8c8 85%, #e0e0e0 100%)',
                  boxShadow: 'inset 0 3px 10px rgba(255,255,255,0.5), inset 0 -2px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.2)',
                  border: '3px solid #1a1a1a',
                }}>
                  {/* Reel area with payline indicator */}
                  <div className="mx-1.5 mt-2 mb-1 relative">
                    {/* Blue "1" payline indicators */}
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 z-30 w-5 h-5 flex items-center justify-center rounded-sm" style={{ background: '#2563eb', color: 'white', fontSize: 10, fontWeight: 800 }}>1</div>
                    <div className="absolute top-1/2 right-0 -translate-y-1/2 z-30 w-5 h-5 flex items-center justify-center rounded-sm" style={{ background: '#2563eb', color: 'white', fontSize: 10, fontWeight: 800 }}>1</div>
                    <div className="absolute top-1/2 left-0 right-0 h-[2px] z-20 -translate-y-1/2" style={{ background: 'rgba(37,99,235,0.5)' }} />

                    <div className="flex gap-2 px-4">
                      {[0, 1, 2].map(reelIdx => (
                        <CylinderReel
                          key={reelIdx}
                          finalIdx={reelFinals[reelIdx]}
                          spinning={reelSpinning[reelIdx]}
                          reelIndex={reelIdx}
                          onStop={() => handleReelStop(reelIdx)}
                          isWin={isWin}
                          spinId={spinId}
                          turbo={turbo}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Win overlay */}
                <AnimatePresence>
                  {lastWin > 0 && !spinning && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 rounded-xl"
                      onClick={() => { setLastWin(0); setIsWin(false); }}
                    >
                      <div className="text-center">
                        <motion.p className="font-black text-3xl mb-1" style={{ color: '#f5e6a3', textShadow: '0 0 20px rgba(245,230,163,0.3)' }}
                          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                          🎉 WIN!
                        </motion.p>
                        <p className="font-bold text-2xl" style={{ color: '#d4a843' }}>৳{lastWin.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Control Panel: PAYTABLE | INFO | MUTE (top row) */}
                <div className="flex gap-1.5 px-2 py-2">
                  <PaytableModal gameName="Lucky Classic 777" betAmount={stake} {...CLASSIC_777_PAYTABLE} trigger={
                    <button className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase" style={{
                      background: 'linear-gradient(180deg, #3d2817 0%, #2a1810 100%)',
                      border: '1px solid #d4a843',
                      color: '#d4a843',
                    }}>Paytable</button>
                  } />
                  <PaytableModal gameName="Lucky Classic 777" betAmount={stake} {...CLASSIC_777_PAYTABLE} trigger={
                    <button className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1" style={{
                      background: 'linear-gradient(180deg, #3d2817 0%, #2a1810 100%)',
                      border: '1px solid #d4a843',
                      color: '#d4a843',
                    }}>
                      <Info size={12} />Info
                    </button>
                  } />
                  <button onClick={() => setSoundOn(!soundOn)} className="flex-1 py-1.5 rounded text-[10px] font-bold uppercase flex items-center justify-center gap-1" style={{
                    background: 'linear-gradient(180deg, #3d2817 0%, #2a1810 100%)',
                    border: '1px solid #d4a843',
                    color: '#d4a843',
                  }}>
                    {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}Mute
                  </button>
                </div>

                {/* Bottom row: AUTO SPIN | TURBO | BET | SPIN 777 — all in one row */}
                <div className="flex items-center justify-between gap-2 px-2 pb-3">
                  <button onClick={() => setAutoSpin(!autoSpin)}
                    className="px-2.5 py-2 rounded text-[10px] font-bold uppercase shrink-0"
                    style={{
                      background: autoSpin ? 'linear-gradient(180deg, #c2410c, #9a3412)' : 'linear-gradient(180deg, #3d2817, #2a1810)',
                      border: '1px solid #d4a843',
                      color: '#d4a843',
                    }}>
                    AUTO SPIN
                  </button>
                  <button onClick={() => setTurbo(!turbo)}
                    className="px-2.5 py-2 rounded text-[10px] font-bold uppercase flex items-center gap-1 shrink-0"
                    style={{
                      background: turbo ? 'linear-gradient(180deg, #c2410c, #9a3412)' : 'linear-gradient(180deg, #3d2817, #2a1810)',
                      border: '1px solid #d4a843',
                      color: '#d4a843',
                    }}>
                    <Zap size={10} /> TURBO
                  </button>
                  <button onClick={() => !spinning && setShowBetModal(true)}
                    className="flex items-center gap-1.5 shrink-0 px-2 py-1.5 rounded"
                    style={{ background: 'linear-gradient(180deg, #3d2817 0%, #2a1810 100%)', border: '1px solid #d4a843' }}
                    disabled={spinning}>
                    <Coins size={16} style={{ color: '#d4a843' }} />
                    <span className="font-bold text-sm" style={{ color: '#d4a843' }}>৳{stake}</span>
                  </button>
                  <button onClick={spin} disabled={spinning} className="relative disabled:opacity-60 shrink-0">
                    <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center" style={{
                      background: spinning ? 'linear-gradient(135deg, #666, #444)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                      border: '3px solid #fbbf24',
                    }}>
                      {spinning ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <RotateCcw size={22} style={{ color: 'rgba(255,255,255,0.9)' }} />
                        </motion.div>
                      ) : (
                        <>
                          <span className="font-black text-xs" style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>SPIN</span>
                          <span className="font-black text-[10px] italic" style={{ color: '#fbbf24', textShadow: '0 0 6px rgba(251,191,36,0.8)' }}>777</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Winner leaderboard — fake + real */}
        <WinnerLeaderboard spinHistory={spinHistory} />

        {/* Bet amount selection modal — choto */}
        <AnimatePresence>
          {showBetModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={() => setShowBetModal(false)}
            >
              <div className="absolute inset-0 bg-black/60" />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-[280px] rounded-xl p-4"
                style={{
                  background: 'linear-gradient(180deg, #2a1810 0%, #1a0f0a 100%)',
                  border: '2px solid #d4a843',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-center text-sm font-bold mb-3" style={{ color: '#d4a843' }}>Select Bet Amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {BET_PRESETS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => { setStake(amt); setShowBetModal(false); }}
                      className="py-2 rounded text-sm font-bold"
                      style={{
                        background: stake === amt ? 'linear-gradient(180deg, #d4a843, #a67c2e)' : 'linear-gradient(180deg, #3d2817, #2a1810)',
                        border: stake === amt ? 'none' : '1px solid #d4a843',
                        color: stake === amt ? '#1a0f0a' : '#d4a843',
                      }}
                    >
                      ৳{amt}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </AuthGate>
  );
};

export default Classic777Game;
