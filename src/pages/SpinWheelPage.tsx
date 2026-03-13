import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCw, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import AuthGate from '@/components/AuthGate';

interface Prize {
  label: string;
  value: number;
  type: 'points' | 'cashback' | 'freebet' | 'nothing';
  color: string;
  icon: string;
  weight: number; // probability weight
}

const PRIZES: Prize[] = [
  { label: 'Try Again', value: 0, type: 'nothing', color: 'hsl(216,50%,25%)', icon: '😢', weight: 25 },
  { label: '৳100 Free Bet', value: 100, type: 'freebet', color: 'hsl(142,76%,46%)', icon: '🎲', weight: 0.15 },
  { label: 'Better Luck!', value: 0, type: 'nothing', color: 'hsl(216,45%,30%)', icon: '💨', weight: 25 },
  { label: '৳500 Cashback', value: 500, type: 'cashback', color: 'hsl(0,84%,60%)', icon: '💰', weight: 0.05 },
  { label: 'No Prize', value: 0, type: 'nothing', color: 'hsl(216,55%,22%)', icon: '🫠', weight: 25 },
  { label: '৳50 Free Bet', value: 50, type: 'freebet', color: 'hsl(25,90%,50%)', icon: '🎯', weight: 0.3 },
  { label: 'Almost!', value: 0, type: 'nothing', color: 'hsl(216,60%,20%)', icon: '😅', weight: 24 },
  { label: '৳200 Cashback', value: 200, type: 'cashback', color: 'hsl(320,70%,50%)', icon: '🔥', weight: 0.5 },
];

const SEGMENT_ANGLE = 360 / PRIZES.length;

// Weighted random pick
const pickWeightedIndex = (): number => {
  const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < PRIZES.length; i++) {
    rand -= PRIZES[i].weight;
    if (rand <= 0) return i;
  }
  return 0; // fallback to "Try Again"
};

const SpinWheelPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addWin } = useWallet();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState('');
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [shaking, setShaking] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const apiAllowedRef = useRef<boolean | null>(null);

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  useEffect(() => {
    const checkEligibility = async () => {
      if (!user) { setCanSpin(false); setNextSpinAt(null); setCheckingEligibility(false); return; }
      try {
        const status = await api.getDailySpinStatus();
        if (status) {
          setCanSpin(status.canSpin);
          setNextSpinAt(status.nextSpinAt ? new Date(status.nextSpinAt) : null);
          setCheckingEligibility(false);
          return;
        }
      } catch {}
      const { data } = await supabase.from('user_vip_data').select('last_spin_at').eq('user_id', user.id).single();
      if (!data || !data.last_spin_at) {
        setCanSpin(true);
        setNextSpinAt(null);
      } else {
        const lastSpin = new Date(data.last_spin_at).getTime();
        const can = Date.now() - lastSpin >= TWENTY_FOUR_HOURS_MS;
        setCanSpin(can);
        if (!can) setNextSpinAt(new Date(lastSpin + TWENTY_FOUR_HOURS_MS));
      }
      setCheckingEligibility(false);
    };
    checkEligibility();
  }, [user]);

  useEffect(() => {
    if (!nextSpinAt || canSpin) {
      setCountdown('');
      return;
    }
    const tick = () => {
      const now = Date.now();
      const diff = nextSpinAt.getTime() - now;
      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinAt(null);
        setCountdown('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextSpinAt, canSpin]);

  const spin = useCallback(async () => {
    if (spinning || !canSpin || !user) return;

    // Start spin animation immediately — don't wait for API
    setSpinning(true);
    setShaking(true);
    setResult(null);
    apiAllowedRef.current = null;

    const idx = pickWeightedIndex();
    const prize = PRIZES[idx];

    const targetAngle = 360 - (idx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const fullSpins = 6 + Math.floor(Math.random() * 4);
    const totalRotation = rotation + fullSpins * 360 + targetAngle - (rotation % 360);

    setRotation(totalRotation);

    // Check API in parallel — wheel spins while we verify
    (async () => {
      try {
        const allowed = await api.rpc('try_daily_spin', { p_user_id: user.id });
        apiAllowedRef.current = !!allowed;
      } catch {
        try {
          const { data } = await supabase.rpc('try_daily_spin', { p_user_id: user.id });
          apiAllowedRef.current = !!data;
        } catch {
          apiAllowedRef.current = false;
        }
      }
      if (apiAllowedRef.current === false) {
        const { data } = await supabase.from('user_vip_data').select('last_spin_at').eq('user_id', user.id).single();
        if (data?.last_spin_at) setNextSpinAt(new Date(new Date(data.last_spin_at).getTime() + TWENTY_FOUR_HOURS_MS));
      }
    })();

    setTimeout(() => {
      setSpinning(false);
      setShaking(false);
      setCanSpin(false);
      setNextSpinAt(new Date(Date.now() + TWENTY_FOUR_HOURS_MS));

      const allowed = apiAllowedRef.current;
      if (allowed === false) {
        toast.error('You already spun today!');
        return;
      }

      setResult(prize);
      if (prize.type === 'nothing') {
        toast('😢 No prize this time! Try again tomorrow!', { duration: 4000 });
      } else {
        if (prize.type === 'cashback' || prize.type === 'freebet') {
          addWin(prize.value, `Spin Wheel: ${prize.label}`, 'bonus');
        }
        if (prize.type === 'points') {
          api.rpc('add_vip_points', { p_user_id: user.id, p_points: prize.value, p_bet_amount: 0 }).catch((e) => console.error('Spin wheel VIP points RPC failed:', e));
        }
        toast.success(`🎉 You won ${prize.label}!`, { duration: 5000 });
      }
    }, 5000);
  }, [spinning, canSpin, rotation, addWin, user]);

  return (
    <AuthGate>
    <div className="min-h-screen navy-gradient pb-8">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/')} className="p-2">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg gold-text">🎡 Daily Spin</h1>
      </div>

      <div className="flex flex-col items-center px-4">
        <p className="text-sm text-muted-foreground mb-4 font-heading text-center">
          Spin the wheel once every day for free prizes!
        </p>

        {/* 3D Wheel Container */}
        <div className="relative" style={{ perspective: '800px' }}>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-primary drop-shadow-[0_0_10px_hsl(43,96%,56%)]" />
          </div>

          {/* Outer glow ring */}
          <div className="absolute inset-[-8px] rounded-full bg-gradient-to-br from-primary/40 via-transparent to-primary/40 blur-md z-0" />

          {/* 3D Wheel */}
          <div
            ref={wheelRef}
            className="w-[min(85vw,320px)] h-[min(85vw,320px)] rounded-full relative overflow-hidden shadow-[0_0_40px_hsl(43,96%,56%/0.3),0_10px_30px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.1)] z-10"
            style={{
              transform: `rotateX(12deg) rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.15, 0.6, 0.1, 1)' : 'none',
              border: '3px solid hsl(43 96% 56% / 0.6)',
              transformStyle: 'preserve-3d',
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
              {PRIZES.map((prize, i) => {
                const startAngle = i * SEGMENT_ANGLE;
                const endAngle = startAngle + SEGMENT_ANGLE;
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                const x1 = 100 + 100 * Math.cos(startRad);
                const y1 = 100 + 100 * Math.sin(startRad);
                const x2 = 100 + 100 * Math.cos(endRad);
                const y2 = 100 + 100 * Math.sin(endRad);
                const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;
                const midAngle = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                const textX = 100 + 62 * Math.cos(midAngle);
                const textY = 100 + 62 * Math.sin(midAngle);
                const iconX = 100 + 42 * Math.cos(midAngle);
                const iconY = 100 + 42 * Math.sin(midAngle);
                const textAngle = (startAngle + endAngle) / 2;

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={prize.color}
                      stroke="hsl(43,96%,56%)"
                      strokeWidth="0.5"
                      strokeOpacity="0.4"
                    />
                    <text
                      x={textX} y={textY}
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                      className="fill-white font-bold"
                      style={{ fontSize: '5.5px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      {prize.label}
                    </text>
                    <text
                      x={iconX} y={iconY}
                      textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: '13px' }}
                    >
                      {prize.icon}
                    </text>
                  </g>
                );
              })}
              {/* Center hub - 3D effect */}
              <circle cx="100" cy="100" r="20" fill="url(#hubGrad)" stroke="hsl(43,96%,56%)" strokeWidth="2" />
              <circle cx="100" cy="100" r="14" fill="hsl(216,72%,14%)" stroke="hsl(43,96%,56%)" strokeWidth="1" opacity="0.8" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '16px' }}>🎰</text>
              <defs>
                <radialGradient id="hubGrad">
                  <stop offset="0%" stopColor="hsl(216,55%,22%)" />
                  <stop offset="100%" stopColor="hsl(216,72%,10%)" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mt-6 bg-card rounded-2xl p-5 gold-border card-glow text-center w-full max-w-xs"
          >
            <span className="text-4xl block mb-2">{result.icon}</span>
            {result.type === 'nothing' ? (
              <>
                <p className="font-heading font-bold text-xl text-destructive mb-1">No Prize!</p>
                <p className="text-sm text-muted-foreground">Try again tomorrow 💪</p>
              </>
            ) : (
              <>
                <p className="font-heading font-bold text-xl gold-text mb-1">You Won!</p>
                <p className="font-heading font-bold text-2xl text-foreground">{result.label}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {result.type === 'points' && 'Points added to your VIP balance!'}
                  {result.type === 'cashback' && 'Cashback added to your wallet!'}
                  {result.type === 'freebet' && 'Free bet credit added to your wallet!'}
                </p>
              </>
            )}
          </motion.div>
        )}

        <button
          onClick={spin}
          disabled={spinning || !canSpin || checkingEligibility}
          className={`mt-6 w-full max-w-xs py-4 rounded-2xl font-heading font-bold text-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
            canSpin && !spinning ? 'gold-gradient text-primary-foreground animate-pulse-glow' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <RotateCw size={22} className={spinning ? 'animate-spin' : ''} />
          {checkingEligibility ? 'Checking...' : spinning ? 'Spinning...' : canSpin ? 'SPIN NOW!' : 'Come Back Tomorrow'}
        </button>

        {!canSpin && !spinning && !checkingEligibility && (
          <div className="mt-2 flex flex-col items-center gap-1">
            <p className="text-xs text-muted-foreground font-heading">Next free spin in</p>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <span className="font-mono font-bold text-lg text-primary tabular-nums">
                {countdown || '--:--:--'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 w-full">
          <h2 className="font-heading font-bold text-sm gold-text mb-3">🎁 Possible Prizes</h2>
          <div className="grid grid-cols-2 gap-2">
            {PRIZES.filter(p => p.type !== 'nothing').map((p, i) => (
              <div key={i} className="bg-card rounded-lg p-2.5 gold-border flex items-center gap-2">
                <span className="text-lg">{p.icon}</span>
                <div>
                  <p className="text-xs font-heading font-bold">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{p.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </AuthGate>
  );
};

export default SpinWheelPage;
