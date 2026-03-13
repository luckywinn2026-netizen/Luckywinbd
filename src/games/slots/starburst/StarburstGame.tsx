import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import PaytableModal from '@/components/PaytableModal';
import SlotControlPanel from '@/components/SlotControlPanel';
import { SIMPLE_3REEL_PAYTABLE } from '@/config/paytableConfigs';
import { StarburstSound } from './StarburstSoundEngine';

// ─── Cosmic Gem Symbols ───
const SYMBOLS = ['⭐', '💎', '🟡', '🟢', '🔵', '🟣', '🔴', '🌟', '💫', '✨'];

const SYMBOL_WEIGHTS: Record<number, number> = {
  0: 5, 1: 6, 2: 10, 3: 10, 4: 12, 5: 12, 6: 12, 7: 7, 8: 8, 9: 12,
};
const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);

const pickSymbol = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) { r -= SYMBOL_WEIGHTS[i]; if (r <= 0) return i; }
  return 4;
};

const getTriplePayout = (idx: number): number => {
  if (idx === 0) return 100 + Math.floor(Math.random() * 401); // ⭐ Star
  if (idx === 1) return 50 + Math.floor(Math.random() * 201);  // 💎 Diamond
  if (idx === 7) return 30 + Math.floor(Math.random() * 71);   // 🌟 Glow Star
  if (idx === 8) return 20 + Math.floor(Math.random() * 31);   // 💫 Dizzy
  if (idx === 2) return 10 + Math.floor(Math.random() * 21);   // 🟡
  if (idx === 3) return 10 + Math.floor(Math.random() * 21);   // 🟢
  if (idx === 4) return 5 + Math.floor(Math.random() * 11);    // 🔵
  if (idx === 5) return 3 + Math.floor(Math.random() * 5);     // 🟣
  if (idx === 6) return 2; // 🔴
  if (idx === 9) return 2; // ✨
  return 1;
};

const CoinParticle = ({ delay }: { delay: number }) => {
  const s = 18 + Math.random() * 10;
  const x = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 100;
  const dur = 1.8 + Math.random() * 1.2;
  return (
    <motion.div className="absolute pointer-events-none" style={{ left: `${x}%`, top: -s, width: s, height: s, zIndex: 60, fontSize: s * 0.7 }}
      initial={{ opacity: 1, y: 0, x: 0 }} animate={{ opacity: [1, 1, 0], y: [0, 300, 550], x: [0, drift * 0.5, drift], rotate: [0, 360] }}
      transition={{ duration: dur, delay, ease: 'easeIn' }}>⭐</motion.div>
  );
};

// ─── 3D Cylinder Reel ───
const CELL_H = 56;
const NUM_FACES = 10;
const FACE_ANGLE = 360 / NUM_FACES;
const CYLINDER_RADIUS = (CELL_H / 2) / Math.tan(Math.PI / NUM_FACES);

const CylinderReel = ({ finalIdx, spinning, reelIndex, onStop, soundEnabled, isWin, spinId }: {
  finalIdx: number; spinning: boolean; reelIndex: number; onStop: () => void; soundEnabled: boolean; isWin: boolean; spinId: number;
}) => {
  const [rotationX, setRotationX] = useState(-(finalIdx * FACE_ANGLE));
  const animRef = useRef<number>();
  const currentAngleRef = useRef(-(finalIdx * FACE_ANGLE));
  const SPIN_DURATION = 150 + reelIndex * 50;
  const landingTriggered = useRef(false);
  const lastSpinIdRef = useRef(0);

  useEffect(() => {
    if (!spinning) return;
    landingTriggered.current = false;
    const speed = 14 + reelIndex * 2;
    const animate = () => { currentAngleRef.current -= speed; setRotationX(currentAngleRef.current); animRef.current = requestAnimationFrame(animate); };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinning]);

  useEffect(() => {
    if (!spinning || landingTriggered.current) return;
    if (spinId === lastSpinIdRef.current) return;
    lastSpinIdRef.current = spinId;
    landingTriggered.current = true;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const startAngle = currentAngleRef.current;
    const fullRotations = 3 + reelIndex;
    const targetAngle = startAngle - (fullRotations * 360 + (((-finalIdx * FACE_ANGLE) - startAngle) % 360 + 360) % 360);
    const totalDelta = targetAngle - startAngle;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / SPIN_DURATION, 1);
      let eased: number;
      if (progress < 0.5) { eased = progress / 0.5 * 0.7; }
      else { const t = (progress - 0.5) / 0.5; eased = 0.7 + 0.3 * (1 - Math.pow(1 - t, 4)) + Math.sin(t * Math.PI * 1.2) * 0.01 * (1 - t); }
      eased = Math.min(Math.max(eased, 0), 1.003);
      const currentAngle = startAngle + totalDelta * eased;
      currentAngleRef.current = currentAngle;
      setRotationX(currentAngle);
      if (soundEnabled) {
        const prevFace = Math.floor(Math.abs(startAngle + totalDelta * Math.max(0, eased - 0.02)) / FACE_ANGLE);
        const curFace = Math.floor(Math.abs(currentAngle) / FACE_ANGLE);
        if (curFace !== prevFace) StarburstSound.tick();
      }
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        currentAngleRef.current = -(finalIdx * FACE_ANGLE);
        setRotationX(-(finalIdx * FACE_ANGLE));
        if (soundEnabled) StarburstSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 200;
  const faces = SYMBOLS.map((symbol, i) => (
    <div key={i} className="absolute w-full flex items-center justify-center"
      style={{ height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`, transform: `rotateX(${i * FACE_ANGLE}deg) translateZ(${CYLINDER_RADIUS}px)`, backfaceVisibility: 'hidden' }}>
      <span className="select-none" style={{ fontSize: 36, filter: i === finalIdx && !spinning && isWin ? 'drop-shadow(0 0 25px #00ccff)' : 'none' }}>{symbol}</span>
    </div>
  ));

  return (
    <div className="relative flex-shrink-0" style={{ width: 100, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #000520 0%, #001040 6%, #002080 12%, #8090c0 16%, #a0b0d8 25%, #c0d0f0 40%, #d8e4ff 50%, #c0d0f0 60%, #a0b0d8 75%, #8090c0 84%, #002080 88%, #001040 94%, #000520 100%)',
        border: '3px solid #00aaff', boxShadow: '0 0 0 2px #004488, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,170,255,0.1)',
      }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #66ddff, #0088cc)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #66ddff, #0088cc)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10" style={{ background: 'linear-gradient(180deg, #000310, #000820, #001550, rgba(0,21,80,0))', borderBottom: '2px solid #00aaff', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10" style={{ background: 'linear-gradient(0deg, #000310, #000820, #001550, rgba(0,21,80,0))', borderTop: '2px solid #00aaff', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>{faces}</div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10" style={{ background: 'linear-gradient(90deg, transparent 5%, #004488, #00aaff, #66ddff, #00aaff, #004488, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10" style={{ background: 'linear-gradient(90deg, transparent 5%, #004488, #00aaff, #66ddff, #00aaff, #004488, transparent 95%)' }} />
      </div>
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(0,170,255,0.9), inset 0 0 30px rgba(0,170,255,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game ───
const StarburstGame = () => {
  const navigate = useNavigate();
  const { balance, placeBet, addWin, logLoss } = useWallet();
  const gameToast = useGameToast();
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reelIdxs, setReelIdxs] = useState<number[]>([0, 1, 2]);
  const [stoppedReels, setStoppedReels] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winMult, setWinMult] = useState(0);
  const [showBigWin, setShowBigWin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const autoSpinRef = useRef(false);
  const spinRef = useRef<() => void>(() => {});
  const outcomeRef = useRef<{ outcome: string; maxWinAmount: number }>({ outcome: 'loss', maxWinAmount: 0 });

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('starburst', 'Lucky Starburst', 'slot', betAmount);
  useEffect(() => { autoSpinRef.current = autoSpin; }, [autoSpin]);

  const handleReelStop = useCallback(() => setStoppedReels(prev => prev + 1), []);

  useEffect(() => {
    if (stoppedReels < 3 || !spinning) return;
    setSpinning(false); setStoppedReels(0);
    const [d1, d2, d3] = reelIdxs;
    const oc = outcomeRef.current;
    if (d1 === d2 && d2 === d3) {
      let mult = getTriplePayout(d1);
      let winAmt = Math.round(betAmount * mult);
      if (oc.maxWinAmount > 0 && winAmt > oc.maxWinAmount) { winAmt = Math.round(oc.maxWinAmount); mult = Math.round((winAmt / betAmount) * 10) / 10; }
      setLastWin(winAmt); setWinMult(mult); setIsWin(true);
      if (oc.outcome === 'mega_win') { setShowBigWin(true); setShowConfetti(true); if (soundEnabled) StarburstSound.jackpot(); setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 800); }
      else if (oc.outcome === 'big_win') { setShowBigWin(true); setShowConfetti(true); if (soundEnabled) StarburstSound.bigWin(); setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600); }
      else { setShowConfetti(true); if (soundEnabled) StarburstSound.win(); setTimeout(() => setShowConfetti(false), 500); }
      addWin(winAmt, 'Starburst', 'slot', mult, betAmount, 'starburst');
      setSpinHistory(prev => [{ win: true, amount: winAmt }, ...prev.slice(0, 14)]);
    } else {
      setLastWin(0); setWinMult(0); setIsWin(false);
      if (soundEnabled) StarburstSound.loss();
      logLoss(betAmount, 'Starburst', 'slot', 'starburst');
      setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
    }
    if (autoSpinRef.current) setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
  }, [stoppedReels]);

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!placeBet(betAmount, 'Starburst', 'slot')) return;
    setLastWin(0); setWinMult(0); setIsWin(false); setSpinning(true); setStoppedReels(0);
    if (soundEnabled) StarburstSound.spin();

    let outcome: { outcome: string; maxWinAmount: number } = { outcome: 'loss', maxWinAmount: 0 };
    try {
      const data = await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'starburst' });
      if (data) outcome = data;
    } catch { outcome = { outcome: 'small_win', maxWinAmount: Math.round(betAmount * 0.4) }; }
    outcomeRef.current = outcome;

    let finalIdxs: number[];
    if (outcome.outcome === 'loss') {
      do { finalIdxs = [pickSymbol(), pickSymbol(), pickSymbol()]; } while (finalIdxs[0] === finalIdxs[1] && finalIdxs[1] === finalIdxs[2]);
    } else if (outcome.outcome === 'mega_win') {
      const s = [0, 1][Math.floor(Math.random() * 2)]; finalIdxs = [s, s, s];
    } else if (outcome.outcome === 'big_win') {
      const s = [0, 1, 7, 8][Math.floor(Math.random() * 4)]; finalIdxs = [s, s, s];
    } else {
      const s = pickSymbol(); finalIdxs = [s, s, s];
    }
    setReelIdxs(finalIdxs);
    setSpinId(prev => prev + 1);
  };
  spinRef.current = spin;

  const BET_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
  const adjustBet = (dir: number) => {
    if (spinning) return;
    const idx = BET_STEPS.indexOf(betAmount);
    setBetAmount(BET_STEPS[Math.max(0, Math.min(BET_STEPS.length - 1, idx + dir))]);
    if (soundEnabled) StarburstSound.buttonClick();
  };

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="⭐ Lucky Starburst" onComplete={handleLoadingComplete} />
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #000520 0%, #001050 30%, #002080 60%, #000520 100%)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2">
          <button onClick={() => navigate('/slots')} className="p-2"><ArrowLeft size={22} className="text-cyan-200" /></button>
          <h1 className="font-heading font-bold text-lg" style={{ color: '#00ccff', textShadow: '0 0 10px rgba(0,204,255,0.5)' }}>⭐ Lucky Starburst</h1>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Starburst" betAmount={betAmount} {...SIMPLE_3REEL_PAYTABLE} symbols={SYMBOLS.map(s => ({ label: s }))} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2">{soundEnabled ? <Volume2 size={18} className="text-cyan-200" /> : <VolumeX size={18} className="text-cyan-200/50" />}</button>
            <div className="rounded-full px-3 py-1" style={{ border: '2px solid #00aaff', background: 'rgba(0,170,255,0.15)' }}>
              <span className="text-sm font-heading font-bold text-cyan-200">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>


        {/* ═══ JILI-Style Machine Frame ═══ */}
        <div className="flex-1 mx-3 mb-2 relative">
          {/* Outer metallic frame with LED glow */}
          <div className="relative rounded-2xl p-[3px] animate-pulse-glow" style={{
            background: 'linear-gradient(180deg, #66ddff, #0088cc, #00aaff, #005577, #66ddff)',
          }}>
            {/* Inner dark frame border */}
            <div className="rounded-[13px] p-[2px]" style={{ background: '#000820' }}>
              {/* LED strip ring */}
              <div className="rounded-xl p-[2px] relative overflow-hidden" style={{
                background: 'linear-gradient(90deg, #00ccff, #0066ff, #cc66ff, #00ffcc, #0088ff, #00ccff)',
                backgroundSize: '200% 100%',
                animation: 'led-chase 2s linear infinite',
              }}>
                {/* Machine body */}
                <div className="rounded-[9px] relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]" style={{
                  background: 'linear-gradient(180deg, #001050, #001840, #000820)',
                }}>
                  {/* Top decorative arch */}
                  <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center" style={{
                    background: 'linear-gradient(180deg, rgba(0,170,255,0.12), transparent)',
                  }}>
                    <div className="flex gap-2">
                      {[0,1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                          background: `hsl(${180 + i * 20} 80% 60%)`,
                          boxShadow: `0 0 4px hsl(${180 + i * 20} 80% 60%)`,
                          animation: `led-blink 1.5s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Corner rivets */}
                  {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-3 h-3 rounded-full z-10`} style={{
                      background: 'radial-gradient(circle at 35% 35%, #88ddff, #0066aa)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,0.5)',
                    }} />
                  ))}

                  <div className="absolute top-3 left-1/2 -translate-x-1/2 text-3xl opacity-30">🌌</div>

                  {/* Reel Window */}
                  <div className="mt-6 mb-4 relative">
                    <div className="flex gap-2 p-3 rounded-xl relative" style={{
                      background: 'linear-gradient(180deg, #000510, #001030, #000510)',
                      boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.6), inset 0 -4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(0,170,255,0.08)',
                      border: '1px solid rgba(0,170,255,0.15)',
                    }}>
                      {/* Win line */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] z-10 pointer-events-none" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(0,170,255,0.6), #00aaff, rgba(0,170,255,0.6), transparent)',
                        boxShadow: '0 0 8px rgba(0,170,255,0.4)',
                      }} />
                      {reelIdxs.map((idx, i) => (
                        <CylinderReel key={i} finalIdx={idx} spinning={spinning} reelIndex={i} onStop={handleReelStop} soundEnabled={soundEnabled} isWin={isWin} spinId={spinId} />
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {lastWin > 0 && !spinning && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-center mb-2">
                        <motion.p className="font-heading font-extrabold text-2xl" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                          style={{ color: '#00ccff', textShadow: '0 0 20px rgba(0,204,255,0.6)' }}>
                          {showBigWin ? '🏆 MEGA WIN!' : '🎉 WIN!'}
                        </motion.p>
                        <p className="font-heading font-bold text-xl text-cyan-200">৳{lastWin.toLocaleString()} ({winMult}x)</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {showConfetti && Array.from({ length: 12 }).map((_, i) => <CoinParticle key={i} delay={i * 0.08} />)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <SlotControlPanel
          betAmount={betAmount}
          spinning={spinning}
          autoSpin={autoSpin}
          turboMode={turboMode}
          onSpin={spin}
          onAdjustBet={(d) => adjustBet(d)}
          onSetBet={(v) => setBetAmount(v)}
          onToggleAuto={() => { setAutoSpin(!autoSpin); if (soundEnabled) StarburstSound.buttonClick(); }}
          onToggleTurbo={() => { setTurboMode(!turboMode); if (soundEnabled) StarburstSound.buttonClick(); }}
          accentColor="00aaff"
          spinEmoji="⭐"
        />
      </div>
    </AuthGate>
  );
};

export default StarburstGame;
