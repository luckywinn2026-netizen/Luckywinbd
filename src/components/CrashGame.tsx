import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import AuthGate from '@/components/AuthGate';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { useCrashRound } from '@/hooks/useCrashRound';

type BetPanel = {
  stake: string;
  autoCashout: string;
  hasBet: boolean;
  cashedOut: boolean;
  mode: 'bet' | 'auto';
};

interface CrashGameProps {
  gameName: string;
  gameId: string;
  emoji: string;
  backPath?: string;
}

const CrashGame = ({ gameName, gameId, emoji, backPath = '/crash' }: CrashGameProps) => {
  const navigate = useNavigate();
  useActivePlayer(gameId, gameName, 'crash', 0);
  const { balance, placeBet, addWin, logLoss } = useWallet();
  const { user } = useAuth();

  // Server-synced round state
  const { gameState, multiplier, multiplierRef, countdown, history, elapsedTime, startTimeRef, gameStateRef } = useCrashRound(gameId);

  const profitPoolRef = useRef<[{ outcome: string; maxWinAmount: number } | null, { outcome: string; maxWinAmount: number } | null]>([null, null]);

  const [panels, setPanels] = useState<[BetPanel, BetPanel]>([
    { stake: '10.00', autoCashout: '2.00', hasBet: false, cashedOut: false, mode: 'bet' },
    { stake: '10.00', autoCashout: '2.00', hasBet: false, cashedOut: false, mode: 'bet' },
  ]);
  const panelsRef = useRef(panels);
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  const updatePanel = (idx: 0 | 1, updates: Partial<BetPanel>) => {
    setPanels(prev => {
      const copy = [...prev] as [BetPanel, BetPanel];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  // Handle state transitions
  const prevStateRef = useRef<string>('waiting');
  useEffect(() => {
    if (prevStateRef.current === gameState) return;
    const prev = prevStateRef.current;
    prevStateRef.current = gameState;

    if (gameState === 'crashed') {
      panelsRef.current.forEach(p => {
        if (p.hasBet && !p.cashedOut) logLoss(Number(p.stake), gameName, 'crash', gameId);
      });
    }
    if (gameState === 'waiting' && prev === 'crashed') {
      setPanels(prev => prev.map(p => ({ ...p, hasBet: false, cashedOut: false })) as [BetPanel, BetPanel]);
      profitPoolRef.current = [null, null];
    }
  }, [gameState]);

  // Auto cashout
  useEffect(() => {
    if (gameState === 'flying') {
      panels.forEach((p, idx) => {
        if (p.hasBet && !p.cashedOut && p.mode === 'auto' && Number(p.autoCashout) > 0 && multiplier >= Number(p.autoCashout))
          handleCashout(idx as 0 | 1);
      });
    }
  }, [multiplier, gameState]);

  const handlePlaceBet = async (idx: 0 | 1) => {
    if (gameState !== 'waiting') { toast.error('Wait for the next round'); return; }
    const s = Number(panels[idx].stake);
    if (s < 5) { toast.error('Min bet ৳5'); return; }
    if (s > 10000) { toast.error('Max bet ৳10,000'); return; }
    if (!placeBet(s, gameName, 'crash')) { toast.error('Insufficient balance'); return; }
    try {
      const data = await api.gameOutcome({ bet_amount: s, game_type: 'crash', game_id: gameId });
      if (data) profitPoolRef.current[idx] = data;
    } catch (e) {
      console.error('Profit pool check failed', e);
      profitPoolRef.current[idx] = { outcome: 'loss', maxWinAmount: 0 };
    }
    updatePanel(idx, { hasBet: true, cashedOut: false });
    toast.success(`৳${s.toLocaleString()} bet placed!`);
  };

  const handleCancelBet = (idx: 0 | 1) => {
    const p = panels[idx];
    if (!p.hasBet || gameState !== 'waiting') return;
    addWin(Number(p.stake), `${gameName} Cancel`, 'crash', 1, Number(p.stake), gameId);
    updatePanel(idx, { hasBet: false, cashedOut: false });
    profitPoolRef.current[idx] = null;
    toast.info('Bet cancelled');
  };

  const handleCashout = (idx: 0 | 1) => {
    const p = panels[idx];
    if (!p.hasBet || p.cashedOut) return;
    updatePanel(idx, { cashedOut: true });
    let winAmount = Math.round(Number(p.stake) * multiplier);
    const poolData = profitPoolRef.current[idx];
    if (poolData) {
      if (poolData.outcome === 'loss') {
        winAmount = Math.min(winAmount, Math.round(Number(p.stake) * 0.1));
      } else if (poolData.maxWinAmount > 0 && winAmount > poolData.maxWinAmount) {
        winAmount = poolData.maxWinAmount;
      }
    }
    if (winAmount > 0) {
      const effMul = winAmount / Number(p.stake);
      addWin(winAmount, `${gameName} ${effMul.toFixed(2)}x`, 'crash', effMul, Number(p.stake), gameId);
      toast.success(`Cashed out at ${multiplier.toFixed(2)}x — Won ৳${winAmount.toLocaleString()}!`);
    }
  };

  return (
    <AuthGate>
      <div className="h-screen navy-gradient flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(backPath)} className="p-1.5">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <span className="text-2xl">{emoji}</span>
            <span className="font-bold text-lg gold-text">{gameName}</span>
          </div>
          <div className="flex items-center gap-1.5 gold-border rounded-full px-3 py-1.5 bg-card">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px]">🪙</div>
            <span className="gold-text font-bold text-sm">৳{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* History bar */}
        <div className="relative z-20 px-3 mb-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                h < 2 ? 'bg-secondary text-destructive' : 'bg-secondary text-primary'
              }`}>{h.toFixed(2)}x</span>
            ))}
          </div>
        </div>

        {/* Game Area */}
        <div className="relative z-10 mx-3 rounded-xl overflow-hidden bg-card gold-border flex items-center justify-center min-h-[220px]">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, hsl(var(--primary) / 0.05) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--primary) / 0.05) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
              animate={{ x: [0, -40], y: [0, 40] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            />
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-primary/20"
                style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%` }}
                animate={{ y: [0, -30 - i * 5, 0], x: [0, 10 + i * 3, 0], opacity: [0.2, 0.6, 0.2] }}
                transition={{ repeat: Infinity, duration: 2 + i * 0.5, ease: 'easeInOut' }}
              />
            ))}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"
              animate={{ bottom: ['0%', '100%'] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            />
          </div>
          <div className="relative z-10">
            {gameState === 'waiting' && (
              <div className="text-center">
                <p className="text-muted-foreground text-sm">NEXT ROUND IN</p>
                <p className="text-primary font-bold text-4xl mt-1">{countdown}s</p>
                <p className="gold-text text-xs mt-1 animate-pulse font-bold">Place your bet!</p>
              </div>
            )}
            {gameState === 'flying' && (
              <div className="text-center relative">
                <motion.div className="text-5xl mb-4"
                  animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}>
                  {emoji}
                </motion.div>
                <p className={`font-extrabold text-5xl drop-shadow-lg ${multiplier >= 5 ? 'text-success' : multiplier >= 2 ? 'gold-text' : 'text-foreground'}`}>
                  {multiplier.toFixed(2)}x
                </p>
              </div>
            )}
            {gameState === 'crashed' && (
              <div className="text-center">
                <p className="text-4xl mb-2">💥</p>
                <p className="text-destructive font-extrabold text-4xl">CRASHED!</p>
                <p className="text-muted-foreground text-lg mt-1">{multiplier.toFixed(2)}x</p>
              </div>
            )}
          </div>
        </div>

        {/* Dual Bet Panels */}
        <div className="relative z-10 px-3 mt-3 space-y-2 flex-1 overflow-y-auto pb-4">
          {([0, 1] as const).map(idx => (
            <div key={idx} className="bg-card rounded-xl p-3 gold-border">
              <div className="flex gap-0 mb-2">
                <button onClick={() => updatePanel(idx, { mode: 'bet' })}
                  className={`flex-1 py-1 text-xs font-bold rounded-l-md ${panels[idx].mode === 'bet' ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground'}`}>Bet</button>
                <button onClick={() => updatePanel(idx, { mode: 'auto' })}
                  className={`flex-1 py-1 text-xs font-bold rounded-r-md ${panels[idx].mode === 'auto' ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground'}`}>Auto</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-background rounded-lg flex-1">
                  <button onClick={() => updatePanel(idx, { stake: String(Math.max(5, Number(panels[idx].stake) - 10).toFixed(2)) })} disabled={panels[idx].hasBet}
                    className="px-2 py-2 text-muted-foreground text-lg font-bold disabled:opacity-30">−</button>
                  <input type="number" value={panels[idx].stake} onChange={e => updatePanel(idx, { stake: e.target.value })} disabled={panels[idx].hasBet}
                    className="w-full bg-transparent text-center text-foreground font-bold text-sm outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => updatePanel(idx, { stake: String((Number(panels[idx].stake) + 10).toFixed(2)) })} disabled={panels[idx].hasBet}
                    className="px-2 py-2 text-muted-foreground text-lg font-bold disabled:opacity-30">+</button>
                </div>
                {!panels[idx].hasBet ? (
                  <button onClick={() => handlePlaceBet(idx)}
                    className="px-6 py-3 rounded-xl font-bold text-sm gold-gradient text-primary-foreground active:scale-95 transition-transform min-w-[100px]">
                    <div className="text-xs opacity-80">BET</div>
                    <div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : panels[idx].cashedOut ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm bg-success/20 text-success min-w-[100px]">✅ Won</button>
                ) : gameState === 'crashed' ? (
                  <button disabled className="px-6 py-3 rounded-xl font-bold text-sm bg-destructive/20 text-destructive min-w-[100px]">Lost</button>
                ) : gameState === 'waiting' ? (
                  <button onClick={() => handleCancelBet(idx)}
                    className="px-6 py-3 rounded-xl font-bold text-sm bg-destructive text-destructive-foreground active:scale-95 transition-transform min-w-[100px]">
                    <div className="text-xs opacity-80">CANCEL</div>
                    <div>৳{Number(panels[idx].stake).toFixed(2)}</div>
                  </button>
                ) : (
                  <button onClick={() => handleCashout(idx)}
                    className="px-6 py-3 rounded-xl font-bold text-sm bg-success text-success-foreground active:scale-95 transition-transform min-w-[100px]">
                    <div className="text-xs opacity-80">CASH OUT</div>
                    <div>৳{Math.round(Number(panels[idx].stake) * multiplier).toLocaleString()}</div>
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 mt-2">
                {[5, 50, 100, 500].map(v => (
                  <button key={v} onClick={() => updatePanel(idx, { stake: String(v.toFixed(2)) })} disabled={panels[idx].hasBet}
                    className="flex-1 py-1 text-[11px] font-bold bg-secondary hover:bg-primary/30 hover:text-primary text-muted-foreground rounded transition-colors disabled:opacity-30">{v}</button>
                ))}
              </div>
              {panels[idx].mode === 'auto' && (
                <div className="mt-2">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Auto Cash Out (x)</label>
                  <input type="number" value={panels[idx].autoCashout} onChange={e => updatePanel(idx, { autoCashout: e.target.value })} disabled={panels[idx].hasBet}
                    className="w-full bg-background text-foreground text-center rounded py-1 text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AuthGate>
  );
};

export default CrashGame;
