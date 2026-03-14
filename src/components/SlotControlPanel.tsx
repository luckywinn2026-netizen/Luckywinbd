import { useState } from 'react';
import { Coins, RotateCcw, Zap } from 'lucide-react';
import BetAmountModal from '@/components/BetAmountModal';

interface SlotControlPanelProps {
  betAmount: number;
  spinning: boolean;
  autoSpin: boolean;
  turboMode?: boolean;
  onSpin: () => void;
  onAdjustBet?: (dir: number) => void;
  onSetBet: (amount: number) => void;
  onToggleAuto: () => void;
  onToggleTurbo?: () => void;
  spinLabel?: string;
  spinEmoji?: string;
  /** Theme accent color - hex without # */
  accentColor?: string;
  /** Quick bet presets */
  betPresets?: number[];
  /** Disable bet controls (e.g. during free spins) */
  betDisabled?: boolean;
}

const DEFAULT_PRESETS = [0.5, 1, 5, 10, 20, 50, 100, 500, 1000, 2000];

// Color themes mapped by accent
const getTheme = (accent: string) => {
  const themes: Record<string, { frame: string; frameBorder: string; frameOuter: string; btnBg: string; btnBorder: string; btnColor: string; spinBg: string; spinBorder: string; spinShadow: string; spinBottom: string; activeBg: string; activeBorder: string }> = {
    'cc0022': {
      frame: 'linear-gradient(180deg, #2a1400 0%, #1a0c00 50%, #2a1400 100%)',
      frameBorder: '#c9a030', frameOuter: '#5a3a10',
      btnBg: 'linear-gradient(180deg, #3a2000, #2a1400)', btnBorder: '#c9a030', btnColor: '#ffd700',
      spinBg: 'linear-gradient(180deg, #ff3355, #ff0044, #cc0033, #aa0028)',
      spinBorder: '#ff6680', spinShadow: 'rgba(255,0,50,0.5)', spinBottom: '#8B0018',
      activeBg: 'linear-gradient(180deg, #ff2244, #cc0022, #990018)', activeBorder: '#ff6680',
    },
    'ffd700': {
      frame: 'linear-gradient(180deg, #1a1200 0%, #0f0a00 50%, #1a1200 100%)',
      frameBorder: '#c9a030', frameOuter: '#5a3a10',
      btnBg: 'linear-gradient(180deg, #2a1a00, #1a0c00)', btnBorder: '#c9a030', btnColor: '#ffd700',
      spinBg: 'linear-gradient(180deg, #daa520, #ffd700, #c9a030, #b8860b)',
      spinBorder: '#ffe066', spinShadow: 'rgba(255,215,0,0.5)', spinBottom: '#8B6914',
      activeBg: 'linear-gradient(180deg, #ffd700, #c9a030, #b8860b)', activeBorder: '#ffe066',
    },
    '00aaff': {
      frame: 'linear-gradient(180deg, #001a2a 0%, #000d15 50%, #001a2a 100%)',
      frameBorder: '#0088cc', frameOuter: '#003355',
      btnBg: 'linear-gradient(180deg, #002a44, #001a2a)', btnBorder: '#0088cc', btnColor: '#00ccff',
      spinBg: 'linear-gradient(180deg, #0088cc, #00aaff, #0077bb, #006699)',
      spinBorder: '#66ddff', spinShadow: 'rgba(0,170,255,0.5)', spinBottom: '#004477',
      activeBg: 'linear-gradient(180deg, #0088cc, #006699, #004477)', activeBorder: '#66ddff',
    },
    'ff8800': {
      frame: 'linear-gradient(180deg, #1a0c00 0%, #0f0600 50%, #1a0c00 100%)',
      frameBorder: '#cc6600', frameOuter: '#663300',
      btnBg: 'linear-gradient(180deg, #2a1400, #1a0c00)', btnBorder: '#cc6600', btnColor: '#ff8800',
      spinBg: 'linear-gradient(180deg, #cc6600, #ff8800, #cc5500, #aa4400)',
      spinBorder: '#ffaa44', spinShadow: 'rgba(255,136,0,0.5)', spinBottom: '#884400',
      activeBg: 'linear-gradient(180deg, #ff8800, #cc6600, #aa4400)', activeBorder: '#ffaa44',
    },
    '00cc44': {
      frame: 'linear-gradient(180deg, #001a0a 0%, #000d05 50%, #001a0a 100%)',
      frameBorder: '#008833', frameOuter: '#004418',
      btnBg: 'linear-gradient(180deg, #002a10, #001a0a)', btnBorder: '#008833', btnColor: '#00ff66',
      spinBg: 'linear-gradient(180deg, #008833, #00cc44, #007733, #006622)',
      spinBorder: '#66ff88', spinShadow: 'rgba(0,204,68,0.5)', spinBottom: '#004418',
      activeBg: 'linear-gradient(180deg, #00cc44, #008833, #006622)', activeBorder: '#66ff88',
    },
    'ff00ff': {
      frame: 'linear-gradient(180deg, #1a001a 0%, #0d000d 50%, #1a001a 100%)',
      frameBorder: '#cc00cc', frameOuter: '#660066',
      btnBg: 'linear-gradient(180deg, #2a002a, #1a001a)', btnBorder: '#cc00cc', btnColor: '#ff66ff',
      spinBg: 'linear-gradient(180deg, #cc00cc, #ff00ff, #aa00aa, #880088)',
      spinBorder: '#ff66ff', spinShadow: 'rgba(255,0,255,0.5)', spinBottom: '#660066',
      activeBg: 'linear-gradient(180deg, #ff00ff, #cc00cc, #aa00aa)', activeBorder: '#ff66ff',
    },
  };
  return themes[accent] || themes['ffd700'];
};

export default function SlotControlPanel({
  betAmount, spinning, autoSpin, turboMode = false, onSpin, onAdjustBet, onSetBet, onToggleAuto, onToggleTurbo,
  spinLabel = 'SPIN', spinEmoji = '🎰',
  accentColor = 'ffd700', betPresets = DEFAULT_PRESETS, betDisabled = false,
}: SlotControlPanelProps) {
  const t = getTheme(accentColor);
  const isDisabled = spinning || betDisabled;
  const [showBetModal, setShowBetModal] = useState(false);
  const accentHex = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;

  return (
    <div className="relative z-10 px-3 pt-2 pb-6 safe-bottom">
      {/* Keyframes */}
      <style>{`
        @keyframes scp-shine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
      `}</style>

      {/* 3D Cartoon Frame */}
      <div className="relative rounded-[20px] overflow-hidden" style={{
        background: t.frame,
        border: `3px solid ${t.frameBorder}`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 0 4px ${t.frameOuter}, inset 0 2px 8px ${t.frameBorder}22, 0 -4px 20px ${t.frameBorder}0d`,
      }}>
        {/* Top gold trim with rivets */}
        <div className="relative h-[3px]" style={{
          background: `linear-gradient(90deg, ${t.frameOuter}, ${t.frameBorder}, ${t.frameBorder}cc, ${t.frameBorder}, ${t.frameOuter})`,
        }}>
          {[15, 50, 85].map(pct => (
            <div key={pct} className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{
              left: `${pct}%`,
              background: `radial-gradient(circle at 35% 35%, ${t.btnColor}, ${t.frameOuter})`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }} />
          ))}
        </div>

        <div className="p-3">
          {/* Single row: Bet | Spin (center) | Auto */}
          <div className="flex items-center justify-between gap-2">
            {/* Bet controls — left: coin icon + amount, click to open modal */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => !isDisabled && setShowBetModal(true)}
                disabled={isDisabled}
                className="flex items-center gap-1.5 min-h-[36px] py-1.5 px-2.5 rounded-lg active:scale-95 disabled:opacity-30 shrink-0"
                style={{
                  background: t.btnBg, border: `2px solid ${t.btnBorder}`,
                  boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.05)',
                }}
              >
                <Coins size={18} style={{ color: t.btnColor }} />
                <span className="font-black text-base min-w-[52px] text-left" style={{
                  color: t.btnColor,
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                }}>৳{betAmount}</span>
              </button>
            </div>
            {/* 3D SPIN Button — center */}
            <button onClick={onSpin} disabled={spinning}
              className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full font-black text-xs tracking-wider active:scale-[0.96] disabled:opacity-50 relative overflow-hidden flex items-center justify-center shrink-0"
              style={{
                background: spinning ? 'linear-gradient(180deg, #333, #222, #333)' : t.spinBg,
                border: spinning ? '3px solid #555' : `3px solid ${t.spinBorder}`,
                boxShadow: spinning ? 'none'
                  : `0 6px 0 ${t.spinBottom}, 0 8px 20px ${t.spinShadow}, inset 0 2px 0 rgba(255,255,255,0.25), 0 0 30px ${t.spinShadow}33`,
                color: spinning ? '#666' : '#fff',
                textShadow: spinning ? 'none' : '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              {!spinning && (
                <>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, transparent 55%)',
                    animation: 'scp-shine 3s ease-in-out infinite',
                  }} />
                  <div className="absolute top-0 left-[10%] right-[10%] h-[40%] rounded-b-full pointer-events-none" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.2), transparent)',
                  }} />
                </>
              )}
              <span className="relative z-[1]">{spinEmoji} {spinLabel}</span>
            </button>

            {/* Turbo | Auto — right */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onToggleTurbo ?? (() => {})}
                className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95 whitespace-nowrap min-w-0"
                style={{
                  background: turboMode ? `linear-gradient(180deg, ${t.btnColor}, ${t.frameOuter})` : t.btnBg,
                  border: `2px solid ${turboMode ? t.btnColor : t.frameOuter}`,
                  color: turboMode ? '#000' : t.btnColor,
                  boxShadow: turboMode ? `0 0 8px ${t.btnColor}4d` : 'none',
                  opacity: turboMode ? 1 : 0.7,
                }}
              >
                <Zap size={10} className="inline mr-1" />TURBO
              </button>
              <button onClick={onToggleAuto}
                className="px-2.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95 whitespace-nowrap min-w-0"
                style={{
                  background: autoSpin ? `linear-gradient(180deg, ${t.btnColor}, ${t.frameOuter})` : t.btnBg,
                  border: `2px solid ${autoSpin ? t.btnColor : t.frameOuter}`,
                  color: autoSpin ? '#000' : t.btnColor,
                  boxShadow: autoSpin ? `0 0 12px ${t.btnColor}4d` : 'none',
                  opacity: autoSpin ? 1 : 0.7,
                }}
              >
                <RotateCcw size={10} className="inline mr-1" />{autoSpin ? 'STOP' : 'AUTO'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom trim */}
        <div className="h-[3px]" style={{
          background: `linear-gradient(90deg, ${t.frameOuter}, ${t.frameBorder}, ${t.frameBorder}cc, ${t.frameBorder}, ${t.frameOuter})`,
        }} />
      </div>
      <BetAmountModal
        open={showBetModal}
        onClose={() => setShowBetModal(false)}
        presets={betPresets}
        current={betAmount}
        onSelect={onSetBet}
        accentColor={accentHex}
        disabled={isDisabled}
      />
    </div>
  );
}
