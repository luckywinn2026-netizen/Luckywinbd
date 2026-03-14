import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins } from 'lucide-react';
import BetAmountModal from '@/components/BetAmountModal';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import WinCelebration from '@/components/WinCelebration';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useGameAssets } from '@/hooks/useGameAssets';
import PaytableModal from '@/components/PaytableModal';

interface SlotGameProps {
  gameName: string;
  gameId: string;
  emoji: string;
  symbols: string[];
  backPath?: string;
  thumbnail?: string;
}

const SlotGame = ({ gameName, gameId, emoji, symbols, backPath = '/slots', thumbnail }: SlotGameProps) => {
  const navigate = useNavigate();
  const { balance, placeBet, addWin, logLoss } = useWallet();
  const gameToast = useGameToast();
  const [stake, setStake] = useState('50');
  const [reels, setReels] = useState([symbols[0], symbols[1], symbols[2]]);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [lastWinMult, setLastWinMult] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [spinHistory, setSpinHistory] = useState<{ win: boolean; amount: number }[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [showBetModal, setShowBetModal] = useState(false);
  const SLOT_BET_PRESETS = [0.5, 1, 2, 5, 10, 20, 50, 100, 500, 1000];
  const spinCountRef = useRef(0);
  const spinningRef = useRef(false);
  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  const { mascot, mascotSize, background: customBg, backgroundZoom } = useGameAssets(gameId);
  useActivePlayer(gameId, gameName, 'slot', Number(stake));

  const spin = async () => {
    if (spinningRef.current) return;
    const s = Number(stake);
    if (s < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!placeBet(s, gameName, 'slot')) return;

    spinningRef.current = true;
    setSpinning(true);
    setLastWin(0);
    setShowCelebration(false);
    spinCountRef.current++;

    // Get profit-based outcome from backend
    let outcome: { outcome: string; maxWinAmount: number } = { outcome: 'loss', maxWinAmount: 0 };
    try {
      const data = await api.gameOutcome({ bet_amount: s, game_type: 'slot', game_id: gameId });
      if (data) outcome = data;
    } catch (e) {
      console.error('Outcome fetch failed, defaulting to loss', e);
      outcome = { outcome: 'loss', maxWinAmount: 0 };
    }

    const interval = setInterval(() => {
      setReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ]);
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      const finalReels = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
      ];
      setReels(finalReels);
      spinningRef.current = false;
      setSpinning(false);

      let winMultiplier = 0;
      if (outcome.outcome === 'loss') {
        winMultiplier = 0;
      } else if (outcome.outcome === 'mega_win') {
        winMultiplier = 8 + Math.random() * 7; // 8x-15x random
      } else if (outcome.outcome === 'big_win') {
        winMultiplier = 3 + Math.random() * 4; // 3x-7x random
      } else if (outcome.outcome === 'medium_win') {
        winMultiplier = 2 + Math.random() * 2; // 2x-4x random
      } else if (outcome.outcome === 'small_win') {
        winMultiplier = 1.5 + Math.random() * 1; // 1.5x-2.5x random
      } else if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
        winMultiplier = 5 + Math.random() * 5; // 5x-10x random
      } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2] || finalReels[0] === finalReels[2]) {
        winMultiplier = 1.5 + Math.random() * 1; // 1.5x-2.5x random
      }

      if (winMultiplier > 0) {
        winMultiplier = Math.round(winMultiplier * 10) / 10; // Round to 1 decimal
        let winAmount = Math.round(s * winMultiplier);
        let displayMult = winMultiplier;
        // Cap win at maxWinAmount from profit pool
        if (outcome.maxWinAmount > 0 && winAmount > outcome.maxWinAmount) {
          winAmount = Math.round(outcome.maxWinAmount);
          displayMult = Math.round((winAmount / s) * 10) / 10;
        }
        setLastWin(winAmount);
        setLastWinMult(displayMult);
        setShowCelebration(true);
        addWin(winAmount, gameName, 'slot', displayMult, s, gameId);
      } else {
        logLoss(s, gameName, 'slot', gameId);
      }

      setSpinHistory(prev => [{ win: winMultiplier > 0, amount: winMultiplier > 0 ? Math.round(s * winMultiplier) : s }, ...prev.slice(0, 9)]);
    }, 1500);
  };

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName={`${emoji} ${gameName}`} onComplete={handleLoadingComplete} />

      <div className="min-h-screen navy-gradient flex flex-col relative" style={customBg ? { background: `url(${customBg}) center/${backgroundZoom}% no-repeat` } : undefined}>
        <WinCelebration active={showCelebration} multiplier={lastWinMult} />
        {/* Header */}
        <div className="flex items-center gap-3 px-3 pt-2 pb-1">
          <button onClick={() => navigate(backPath)} className="p-2 rounded-full bg-secondary/60 hover:bg-secondary transition-colors">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="font-heading font-bold text-base gold-text truncate">{emoji} {gameName}</h1>
          <div className="ml-auto flex items-center gap-2">
            <PaytableModal gameName={gameName} betAmount={Number(stake)} symbols={symbols.map(s => ({ label: s }))} />
            <div className="relative rounded-full px-3 py-1" style={{ background: 'linear-gradient(135deg, hsl(43 96% 56% / 0.15), hsl(38 80% 40% / 0.1))', border: '1px solid hsl(43 96% 56% / 0.4)' }}>
              <span className="text-sm font-heading font-bold gold-text">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* History Strip */}
        <div className="flex gap-1 px-3 overflow-x-auto no-scrollbar mb-2">
          {spinHistory.map((h, i) => (
            <span key={i} className={`flex-shrink-0 text-[10px] font-heading font-bold px-2 py-0.5 rounded-full ${h.win ? 'bg-success/20 text-success' : 'bg-destructive/15 text-destructive/70'}`}>
              {h.win ? `+৳${h.amount}` : `-৳${h.amount}`}
            </span>
          ))}
        </div>

        {/* ═══ JILI-Style Slot Machine Frame ═══ */}
        <div className="flex-1 mx-3 mb-2 relative">
          {/* Outer metallic frame with LED glow */}
          <div className="relative rounded-2xl p-[3px] animate-pulse-glow" style={{
            background: 'linear-gradient(180deg, hsl(43 96% 70%), hsl(38 80% 45%), hsl(43 96% 56%), hsl(38 80% 35%), hsl(43 96% 65%))',
          }}>
            {/* Inner dark frame border */}
            <div className="rounded-[13px] p-[2px]" style={{ background: 'hsl(216 80% 8%)' }}>
              {/* LED strip ring */}
              <div className="rounded-xl p-[2px] relative overflow-hidden" style={{
                background: 'linear-gradient(90deg, hsl(0 84% 60%), hsl(43 96% 56%), hsl(142 76% 46%), hsl(200 80% 50%), hsl(280 70% 55%), hsl(0 84% 60%))',
                backgroundSize: '200% 100%',
                animation: 'led-chase 2s linear infinite',
              }}>
                {/* Machine body */}
                <div className="rounded-[9px] relative overflow-hidden flex flex-col items-center justify-center min-h-[min(50vw,260px)]" style={{
                  background: 'linear-gradient(180deg, hsl(216 72% 16%), hsl(216 72% 12%), hsl(216 80% 8%))',
                }}>
                  {/* Top decorative arch */}
                  <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center" style={{
                    background: 'linear-gradient(180deg, hsl(43 96% 56% / 0.12), transparent)',
                  }}>
                    <div className="flex gap-2">
                      {[0,1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                          background: `hsl(${i * 50} 80% 60%)`,
                          boxShadow: `0 0 4px hsl(${i * 50} 80% 60%)`,
                          animation: `led-blink 1.5s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Corner rivets */}
                  {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-3 h-3 rounded-full z-10`} style={{
                      background: 'radial-gradient(circle at 35% 35%, hsl(43 96% 75%), hsl(38 80% 40%))',
                      boxShadow: 'inset 0 1px 2px hsl(0 0% 100% / 0.4), 0 1px 3px hsl(0 0% 0% / 0.5)',
                    }} />
                  ))}

                  {/* Mascot */}
                  {mascot && (
                    <motion.img
                      src={mascot}
                      alt="Game Mascot"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="absolute -top-2 -right-2 z-20 drop-shadow-lg pointer-events-none"
                      style={{ width: mascotSize, height: mascotSize, objectFit: 'contain' }}
                    />
                  )}

                  {/* Reel Window */}
                  <div className="mt-6 mb-4 relative">
                    {/* Reel container with inner shadow */}
                    <div className="flex gap-2 p-3 rounded-xl relative" style={{
                      background: 'linear-gradient(180deg, hsl(216 80% 6%), hsl(216 72% 10%), hsl(216 80% 6%))',
                      boxShadow: 'inset 0 4px 12px hsl(0 0% 0% / 0.6), inset 0 -4px 12px hsl(0 0% 0% / 0.4), 0 0 20px hsl(43 96% 56% / 0.08)',
                      border: '1px solid hsl(43 96% 56% / 0.15)',
                    }}>
                      {/* Win line indicator */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] z-10 pointer-events-none" style={{
                        background: 'linear-gradient(90deg, transparent, hsl(0 84% 60% / 0.6), hsl(0 84% 60%), hsl(0 84% 60% / 0.6), transparent)',
                        boxShadow: '0 0 8px hsl(0 84% 60% / 0.4)',
                      }} />

                      {reels.map((symbol, i) => (
                        <motion.div
                          key={i}
                          className="w-[min(20vw,72px)] h-[min(20vw,72px)] sm:w-[80px] sm:h-[80px] rounded-lg flex items-center justify-center text-3xl sm:text-4xl md:text-5xl relative"
                          style={{
                            background: 'linear-gradient(180deg, hsl(216 55% 20%), hsl(216 55% 24%), hsl(216 55% 20%))',
                            border: '1px solid hsl(43 96% 56% / 0.2)',
                            boxShadow: spinning ? '0 0 12px hsl(43 96% 56% / 0.3)' : '0 2px 8px hsl(0 0% 0% / 0.3)',
                          }}
                          animate={spinning ? { y: [0, -8, 8, 0], rotateX: [0, 180, 360] } : {}}
                          transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
                        >
                          {/* Reel glass reflection */}
                          <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                            background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.08) 0%, transparent 50%, hsl(0 0% 0% / 0.15) 100%)',
                          }} />
                          <span className="relative z-[1] drop-shadow-lg">{symbol}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Win Display */}
                  <AnimatePresence>
                    {lastWin > 0 && !spinning && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="text-center mb-2"
                      >
                        <motion.p
                          className="font-heading font-extrabold text-2xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                          style={{ color: 'hsl(142 76% 46%)' }}
                        >🎉 WIN!</motion.p>
                        <p className="font-heading font-bold text-xl gold-text drop-shadow-lg">৳{lastWin.toLocaleString()}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Controls Panel ═══ */}
        <div className="px-3 pb-3 space-y-2">
          {/* Bet: coin icon + amount, click to open modal */}
          <div className="flex items-center gap-2 rounded-xl p-2" style={{
            background: 'linear-gradient(180deg, hsl(216 65% 18%), hsl(216 72% 14%))',
            border: '1px solid hsl(43 96% 56% / 0.15)',
          }}>
            <button
              type="button"
              onClick={() => !spinning && setShowBetModal(true)}
              disabled={spinning}
              className="flex items-center gap-2 flex-1 py-2 px-3 rounded-lg bg-secondary/50 font-heading font-bold text-foreground active:scale-[0.98] disabled:opacity-50"
            >
              <Coins size={20} className="text-primary" />
              <span>৳{stake}</span>
            </button>
            <BetAmountModal
              open={showBetModal}
              onClose={() => setShowBetModal(false)}
              presets={SLOT_BET_PRESETS}
              current={Number(stake) || 50}
              onSelect={(v) => setStake(String(v))}
              accentColor="#eab308"
              disabled={spinning}
            />
          </div>

          {/* SPIN Button — circular, smaller */}
          <div className="flex justify-center">
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-heading font-extrabold text-xs active:scale-[0.97] transition-all duration-150 disabled:opacity-60 relative overflow-hidden flex items-center justify-center"
            style={{
              background: spinning
                ? 'linear-gradient(135deg, hsl(216 55% 25%), hsl(216 55% 20%))'
                : 'linear-gradient(135deg, hsl(43 96% 60%), hsl(38 80% 45%), hsl(43 96% 50%))',
              color: spinning ? 'hsl(0 0% 60%)' : 'hsl(216 72% 10%)',
              boxShadow: spinning
                ? 'none'
                : '0 4px 15px hsl(43 96% 56% / 0.4), inset 0 1px 0 hsl(45 100% 80% / 0.4)',
              border: '1px solid hsl(43 96% 56% / 0.3)',
            }}
          >
            {/* Shine sweep */}
            {!spinning && (
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'linear-gradient(105deg, transparent 40%, hsl(0 0% 100% / 0.2) 45%, hsl(0 0% 100% / 0.3) 50%, transparent 55%)',
                animation: 'shine-sweep 3s ease-in-out infinite',
              }} />
            )}
            <span className="relative z-[1]">{spinning ? '...' : '🎰 SPIN'}</span>
          </button>
        </div>
      </div>
    </AuthGate>
  );
};

export default SlotGame;
