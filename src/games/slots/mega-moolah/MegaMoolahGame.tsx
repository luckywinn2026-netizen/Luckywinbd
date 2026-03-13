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
import { MegaMoolahSound } from './MegaMoolahSoundEngine';

// ─── Safari Symbols ───
const SYMBOLS = ['🦁', '🐘', '🦒', '🦓', '💎', '👑', '🦏', '🐆', '🌴', '🌅'];

const SYMBOL_WEIGHTS: Record<number, number> = {
  0: 5, 1: 7, 2: 8, 3: 10, 4: 6, 5: 5, 6: 10, 7: 8, 8: 12, 9: 12,
};
const TOTAL_WEIGHT = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);

const pickSymbol = (): number => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) { r -= SYMBOL_WEIGHTS[i]; if (r <= 0) return i; }
  return 3;
};

const getTriplePayout = (idx: number): number => {
  if (idx === 0) return 100 + Math.floor(Math.random() * 401); // 🦁 Lion
  if (idx === 5) return 80 + Math.floor(Math.random() * 221);  // 👑 Crown
  if (idx === 4) return 50 + Math.floor(Math.random() * 151);  // 💎 Diamond
  if (idx === 1) return 20 + Math.floor(Math.random() * 31);   // 🐘 Elephant
  if (idx === 2) return 15 + Math.floor(Math.random() * 21);   // 🦒 Giraffe
  if (idx === 7) return 10 + Math.floor(Math.random() * 16);   // 🐆 Leopard
  if (idx === 6) return 8 + Math.floor(Math.random() * 13);    // 🦏 Rhino
  if (idx === 3) return 5 + Math.floor(Math.random() * 6);     // 🦓 Zebra
  if (idx === 8) return 3; // 🌴
  if (idx === 9) return 2; // 🌅
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
      transition={{ duration: dur, delay, ease: 'easeIn' }}>🦁</motion.div>
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
        if (curFace !== prevFace) MegaMoolahSound.tick();
      }
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else {
        currentAngleRef.current = -(finalIdx * FACE_ANGLE);
        setRotationX(-(finalIdx * FACE_ANGLE));
        if (soundEnabled) MegaMoolahSound.reelStop(reelIndex);
        onStop();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [spinning, spinId]);

  const containerH = 200;
  const faces = SYMBOLS.map((symbol, i) => (
    <div key={i} className="absolute w-full flex items-center justify-center"
      style={{ height: CELL_H, top: `calc(50% - ${CELL_H / 2}px)`, transform: `rotateX(${i * FACE_ANGLE}deg) translateZ(${CYLINDER_RADIUS}px)`, backfaceVisibility: 'hidden' }}>
      <span className="select-none" style={{ fontSize: 36, filter: i === finalIdx && !spinning && isWin ? 'drop-shadow(0 0 25px #ff8800)' : 'none' }}>{symbol}</span>
    </div>
  ));

  return (
    <div className="relative flex-shrink-0" style={{ width: 100, height: containerH }}>
      <div className="absolute inset-0 overflow-hidden" style={{
        borderRadius: '50% / 14%',
        background: 'linear-gradient(180deg, #1a1000 0%, #3a2800 6%, #6b5000 12%, #d8c890 16%, #e8dcc0 25%, #f4f0e0 40%, #faf8f0 50%, #f4f0e0 60%, #e8dcc0 75%, #d8c890 84%, #6b5000 88%, #3a2800 94%, #1a1000 100%)',
        border: '3px solid #ff8800', boxShadow: '0 0 0 2px #884400, 0 8px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,136,0,0.1)',
      }}>
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`lt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, left: 3, background: 'radial-gradient(circle at 30% 30%, #ffcc66, #cc6600)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        {[8, 30, 50, 70, 92].map(pct => (
          <div key={`rt-${pct}`} className="absolute w-[5px] h-[5px] rounded-full z-20"
            style={{ top: `${pct}%`, right: 3, background: 'radial-gradient(circle at 30% 30%, #ffcc66, #cc6600)', boxShadow: '0 1px 3px rgba(0,0,0,0.6)' }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-[30px] z-10" style={{ background: 'linear-gradient(180deg, #0d0800, #2a1800, #5a3800, rgba(90,56,0,0))', borderBottom: '2px solid #ff8800', borderRadius: '48% 48% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[30px] z-10" style={{ background: 'linear-gradient(0deg, #0d0800, #2a1800, #5a3800, rgba(90,56,0,0))', borderTop: '2px solid #ff8800', borderRadius: '0 0 48% 48% / 0 0 100% 100%' }} />
        <div className="absolute left-0 right-0 overflow-hidden" style={{ top: 32, bottom: 32 }}>
          <div className="relative w-full h-full" style={{ perspective: '280px', perspectiveOrigin: '50% 50%' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${rotationX}deg)`, transformOrigin: '50% 50%' }}>{faces}</div>
          </div>
          <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 12%, rgba(0,0,0,0.05) 25%, rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.05) 75%, rgba(0,0,0,0.25) 88%, rgba(0,0,0,0.55) 100%)', borderRadius: '50% / 8%' }} />
        </div>
        <div className="absolute left-0 right-0 top-[31px] h-[2px] z-10" style={{ background: 'linear-gradient(90deg, transparent 5%, #884400, #ff8800, #ffaa00, #ff8800, #884400, transparent 95%)' }} />
        <div className="absolute left-0 right-0 bottom-[31px] h-[2px] z-10" style={{ background: 'linear-gradient(90deg, transparent 5%, #884400, #ff8800, #ffaa00, #ff8800, #884400, transparent 95%)' }} />
      </div>
      {isWin && !spinning && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50% / 14%' }}
          animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          <div className="w-full h-full" style={{ borderRadius: '50% / 14%', boxShadow: '0 0 40px rgba(255,136,0,0.9), inset 0 0 30px rgba(255,136,0,0.3)' }} />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Game ───
const MegaMoolahGame = () => {
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
  useActivePlayer('mega-moolah', 'Lucky Mega Moolah', 'slot', betAmount);
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
      if (oc.outcome === 'mega_win') { setShowBigWin(true); setShowConfetti(true); if (soundEnabled) MegaMoolahSound.jackpot(); setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 800); }
      else if (oc.outcome === 'big_win') { setShowBigWin(true); setShowConfetti(true); if (soundEnabled) MegaMoolahSound.bigWin(); setTimeout(() => { setShowBigWin(false); setShowConfetti(false); }, 600); }
      else { setShowConfetti(true); if (soundEnabled) MegaMoolahSound.win(); setTimeout(() => setShowConfetti(false), 500); }
      addWin(winAmt, 'Mega Moolah', 'slot', mult, betAmount, 'mega-moolah');
      setSpinHistory(prev => [{ win: true, amount: winAmt }, ...prev.slice(0, 14)]);
    } else {
      setLastWin(0); setWinMult(0); setIsWin(false);
      if (soundEnabled) MegaMoolahSound.loss();
      logLoss(betAmount, 'Mega Moolah', 'slot', 'mega-moolah');
      setSpinHistory(prev => [{ win: false, amount: betAmount }, ...prev.slice(0, 14)]);
    }
    if (autoSpinRef.current) setTimeout(() => { if (autoSpinRef.current) spinRef.current(); }, 200);
  }, [stoppedReels]);

  const spin = async () => {
    if (spinning) return;
    if (betAmount < 10) { gameToast.error('Min bet ৳10'); return; }
    if (!placeBet(betAmount, 'Mega Moolah', 'slot')) return;
    setLastWin(0); setWinMult(0); setIsWin(false); setSpinning(true); setStoppedReels(0);
    if (soundEnabled) MegaMoolahSound.spin();

    let outcome: { outcome: string; maxWinAmount: number } = { outcome: 'loss', maxWinAmount: 0 };
    try {
      const data = await api.gameOutcome({ bet_amount: betAmount, game_type: 'slot', game_id: 'mega-moolah' });
      if (data) outcome = data;
    } catch { outcome = { outcome: 'small_win', maxWinAmount: Math.round(betAmount * 0.4) }; }
    outcomeRef.current = outcome;

    let finalIdxs: number[];
    if (outcome.outcome === 'loss') {
      do { finalIdxs = [pickSymbol(), pickSymbol(), pickSymbol()]; } while (finalIdxs[0] === finalIdxs[1] && finalIdxs[1] === finalIdxs[2]);
    } else if (outcome.outcome === 'mega_win') {
      const s = [0, 5][Math.floor(Math.random() * 2)]; finalIdxs = [s, s, s];
    } else if (outcome.outcome === 'big_win') {
      const s = [0, 5, 4, 1][Math.floor(Math.random() * 4)]; finalIdxs = [s, s, s];
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
    if (soundEnabled) MegaMoolahSound.buttonClick();
  };

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🦁 Lucky Mega Moolah" onComplete={handleLoadingComplete} />
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #1a1000 0%, #2a1800 30%, #3a2200 60%, #1a1000 100%)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2">
          <button onClick={() => navigate('/slots')} className="p-2"><ArrowLeft size={22} className="text-amber-200" /></button>
          <h1 className="font-heading font-bold text-lg" style={{ color: '#ff8800', textShadow: '0 0 10px rgba(255,136,0,0.5)' }}>🦁 Lucky Mega Moolah</h1>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName="Lucky Mega Moolah" betAmount={betAmount} {...SIMPLE_3REEL_PAYTABLE} symbols={SYMBOLS.map(s => ({ label: s }))} />
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2">{soundEnabled ? <Volume2 size={18} className="text-orange-200" /> : <VolumeX size={18} className="text-orange-200/50" />}</button>
            <div className="rounded-full px-3 py-1" style={{ border: '2px solid #ff8800', background: 'rgba(255,136,0,0.15)' }}>
              <span className="text-sm font-heading font-bold text-orange-200">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>


        {/* ═══ JILI-Style Machine Frame ═══ */}
        <div className="flex-1 mx-3 mb-2 relative">
          {/* Outer metallic frame with LED glow */}
          <div className="relative rounded-2xl p-[3px] animate-pulse-glow" style={{
            background: 'linear-gradient(180deg, #ffcc44, #cc7700, #ff8800, #884400, #ffcc44)',
          }}>
            {/* Inner dark frame border */}
            <div className="rounded-[13px] p-[2px]" style={{ background: '#1a0800' }}>
              {/* LED strip ring */}
              <div className="rounded-xl p-[2px] relative overflow-hidden" style={{
                background: 'linear-gradient(90deg, #ff4400, #ffaa00, #44cc00, #ff8800, #ffcc00, #ff4400)',
                backgroundSize: '200% 100%',
                animation: 'led-chase 2s linear infinite',
              }}>
                {/* Machine body */}
                <div className="rounded-[9px] relative overflow-hidden flex flex-col items-center justify-center min-h-[280px]" style={{
                  background: 'linear-gradient(180deg, #2a1800, #1e1000, #0d0800)',
                }}>
                  {/* Top decorative arch */}
                  <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center" style={{
                    background: 'linear-gradient(180deg, rgba(255,136,0,0.12), transparent)',
                  }}>
                    <div className="flex gap-2">
                      {[0,1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                          background: `hsl(${20 + i * 15} 90% 55%)`,
                          boxShadow: `0 0 4px hsl(${20 + i * 15} 90% 55%)`,
                          animation: `led-blink 1.5s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Corner rivets */}
                  {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-3 h-3 rounded-full z-10`} style={{
                      background: 'radial-gradient(circle at 35% 35%, #ffcc66, #884400)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,0.5)',
                    }} />
                  ))}

                  <div className="absolute top-3 left-1/2 -translate-x-1/2 text-3xl opacity-30">🌍</div>

                  {/* Reel Window */}
                  <div className="mt-6 mb-4 relative">
                    <div className="flex gap-2 p-3 rounded-xl relative" style={{
                      background: 'linear-gradient(180deg, #0d0400, #1a0c00, #0d0400)',
                      boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.6), inset 0 -4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(255,136,0,0.08)',
                      border: '1px solid rgba(255,136,0,0.15)',
                    }}>
                      {/* Win line */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] z-10 pointer-events-none" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,100,0,0.6), #ff6600, rgba(255,100,0,0.6), transparent)',
                        boxShadow: '0 0 8px rgba(255,100,0,0.4)',
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
                          style={{ color: '#ff8800', textShadow: '0 0 20px rgba(255,136,0,0.6)' }}>
                          {showBigWin ? '🏆 MEGA WIN!' : '🎉 WIN!'}
                        </motion.p>
                        <p className="font-heading font-bold text-xl text-orange-200">৳{lastWin.toLocaleString()} ({winMult}x)</p>
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
          onToggleAuto={() => { setAutoSpin(!autoSpin); if (soundEnabled) MegaMoolahSound.buttonClick(); }}
          onToggleTurbo={() => { setTurboMode(!turboMode); if (soundEnabled) MegaMoolahSound.buttonClick(); }}
          accentColor="ff8800"
          spinEmoji="🦁"
        />
      </div>
    </AuthGate>
  );
};

export default MegaMoolahGame;
