import { useState, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Sparkles, TrendingUp, Shield } from 'lucide-react';

/* ─── Types ─── */
export interface SymbolPayout {
  emoji: string;
  label: string;
  match3?: number;
  match4?: number;
  match5?: number;
  description?: string;
  isSpecial?: boolean;
}

export interface GameRule {
  emoji: string;
  text: string;
}

export interface CustomWinTier {
  label: string;
  multiplier: string;
  example?: string;
  gradient: string;
  rarity: string;
}

interface PaytableModalProps {
  gameName: string;
  betAmount?: number;
  /** Optional custom trigger element (receives onClick) */
  trigger?: React.ReactElement;
  /** Game mechanic type shown in header */
  mechanic?: '3+1 Reel' | '5-Reel Ways' | '5-Reel Grid' | '3-Reel Match' | 'Cascade' | 'Custom';
  /** Actual symbol payouts */
  symbolPayouts?: SymbolPayout[];
  /** Custom win tiers (overrides defaults) */
  winTiers?: CustomWinTier[];
  /** Game rules (overrides defaults) */
  rules?: GameRule[];
  /** Legacy: simple symbol list */
  symbols?: { label: string; description?: string }[];
}

const DEFAULT_WIN_TIERS: CustomWinTier[] = [
  { label: 'MEGA WIN', multiplier: '30x – 50x', gradient: 'from-yellow-300 via-amber-400 to-yellow-600', rarity: '' },
  { label: 'BIG WIN', multiplier: '15x – 25x', gradient: 'from-orange-400 via-red-400 to-rose-500', rarity: '' },
  { label: 'MEDIUM WIN', multiplier: '5x – 10x', gradient: 'from-blue-400 via-indigo-400 to-violet-500', rarity: '' },
  { label: 'SMALL WIN', multiplier: '0.5x – 2x', gradient: 'from-emerald-400 via-green-400 to-teal-500', rarity: '' },
];

const DEFAULT_RULES: GameRule[] = [
  { emoji: '💰', text: 'Minimum bet ৳0.5' },
  { emoji: '🎲', text: 'All outcomes are generated using certified RNG' },
  { emoji: '✅', text: 'Provably Fair — every spin is verifiable' },
  { emoji: '🔢', text: 'Win amounts are always shown as whole numbers' },
];

const TIER_COLORS = [
  { glow: 'hsl(43 96% 56% / 0.35)', border: 'hsl(43 96% 56% / 0.5)', icon: 'text-yellow-400', bg: 'hsl(43 80% 50% / 0.15)' },
  { glow: 'hsl(15 90% 55% / 0.25)', border: 'hsl(15 90% 55% / 0.4)', icon: 'text-orange-400', bg: 'hsl(25 80% 50% / 0.15)' },
  { glow: 'hsl(230 70% 55% / 0.2)', border: 'hsl(230 70% 55% / 0.35)', icon: 'text-blue-400', bg: 'hsl(230 60% 50% / 0.15)' },
  { glow: 'hsl(155 60% 45% / 0.2)', border: 'hsl(155 60% 45% / 0.3)', icon: 'text-emerald-400', bg: 'hsl(155 60% 45% / 0.15)' },
];

const TIER_ICONS = ['👑', '🏆', '⭐', '⚡'];

const PaytableModal = ({
  gameName, betAmount = 0, trigger, mechanic, symbolPayouts, winTiers, rules, symbols,
}: PaytableModalProps) => {
  const [open, setOpen] = useState(false);
  const hasBet = betAmount > 0;
  const tiers = winTiers || DEFAULT_WIN_TIERS;
  const gameRules = rules || DEFAULT_RULES;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[9999] flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <motion.div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl"
            style={{
              background: 'linear-gradient(180deg, hsl(220 30% 15%) 0%, hsl(220 28% 8%) 100%)',
              border: '1px solid hsl(43 60% 40% / 0.25)',
              boxShadow: '0 -8px 40px hsl(43 60% 40% / 0.1)',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full" style={{ background: 'hsl(43 60% 50% / 0.3)' }} />
            </div>

            {/* Header */}
            <div className="px-5 pt-1 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                    <Sparkles size={20} className="text-primary" />
                  </motion.div>
                  <h2 className="font-heading font-extrabold text-lg" style={{
                    background: 'linear-gradient(135deg, hsl(43 96% 75%), hsl(38 90% 55%), hsl(43 96% 75%))',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}>
                    {gameName}
                  </h2>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full" style={{ background: 'hsl(220 20% 20%)' }}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] text-muted-foreground font-heading">Paytable & Rules</p>
                {mechanic && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-heading font-bold"
                    style={{ background: 'hsl(43 60% 50% / 0.15)', color: 'hsl(43 80% 65%)', border: '1px solid hsl(43 60% 50% / 0.2)' }}>
                    {mechanic}
                  </span>
                )}
              </div>
            </div>

            {/* Current Bet */}
            {hasBet && (
              <div className="px-5 pb-3">
                <motion.div className="rounded-xl p-3 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(135deg, hsl(43 96% 56% / 0.08), hsl(43 96% 56% / 0.03))',
                    border: '1px solid hsl(43 96% 56% / 0.2)',
                  }}
                  initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: 'hsl(43 96% 56%)' }} />
                    <span className="text-xs text-muted-foreground font-heading">Your Current Bet</span>
                  </div>
                  <span className="text-base font-heading font-extrabold" style={{ color: 'hsl(43 96% 60%)' }}>
                    ৳{betAmount.toLocaleString()}
                  </span>
                </motion.div>
              </div>
            )}

            {/* Win Tiers */}
            <div className="px-5 pb-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full" style={{ background: 'hsl(43 96% 56%)' }} />
                <p className="text-xs font-heading font-bold text-foreground">Win Tiers</p>
              </div>
              {tiers.map((tier, i) => {
                const colors = TIER_COLORS[i % TIER_COLORS.length];
                return (
                  <motion.div key={tier.label}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 300 }}
                    className="rounded-xl p-3 relative overflow-hidden"
                    style={{
                      background: 'hsl(220 22% 13%)',
                      border: `1px solid ${colors.border}`,
                      boxShadow: `0 0 20px ${colors.glow}, inset 0 1px 0 hsl(220 20% 20%)`,
                    }}>
                    <div className="absolute inset-0 opacity-[0.04]"
                      style={{ background: `radial-gradient(ellipse at 20% 50%, ${colors.glow}, transparent 70%)` }} />
                    <div className="relative flex items-center gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg`}
                        style={{ background: colors.bg }}>
                        {TIER_ICONS[i % TIER_ICONS.length]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-heading font-black tracking-wider bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
                            {tier.label}
                          </span>
                          {tier.rarity && (
                            <span className="text-[9px] font-heading px-1.5 py-0.5 rounded-full"
                              style={{ background: 'hsl(220 20% 18%)', color: 'hsl(220 10% 60%)' }}>
                              {tier.rarity}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-heading font-black text-foreground">{tier.multiplier}</span>
                        {tier.example && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{tier.example}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Symbol Payouts Table */}
            {symbolPayouts && symbolPayouts.length > 0 && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1 h-4 rounded-full" style={{ background: 'hsl(43 96% 56%)' }} />
                  <p className="text-xs font-heading font-bold text-foreground">Symbol Payouts</p>
                  <span className="text-[9px] text-muted-foreground font-heading">(× bet)</span>
                </div>

                {/* Header row */}
                {(symbolPayouts[0].match3 !== undefined) && (
                  <div className="flex items-center gap-1 mb-1.5 px-1">
                    <div className="w-[72px]" />
                    {symbolPayouts[0].match3 !== undefined && <span className="flex-1 text-center text-[9px] font-heading font-bold text-muted-foreground">×3</span>}
                    {symbolPayouts[0].match4 !== undefined && <span className="flex-1 text-center text-[9px] font-heading font-bold text-muted-foreground">×4</span>}
                    {symbolPayouts[0].match5 !== undefined && <span className="flex-1 text-center text-[9px] font-heading font-bold text-muted-foreground">×5</span>}
                  </div>
                )}

                <div className="space-y-1">
                  {symbolPayouts.map((sym, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.04 }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5"
                      style={{
                        background: sym.isSpecial ? 'hsl(43 60% 50% / 0.08)' : 'hsl(220 22% 14%)',
                        border: `1px solid ${sym.isSpecial ? 'hsl(43 60% 50% / 0.2)' : 'hsl(220 15% 20%)'}`,
                      }}>
                      <div className="w-[72px] flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-lg">{sym.emoji}</span>
                        <span className="text-[10px] font-heading font-bold text-foreground truncate">{sym.label}</span>
                      </div>
                      {sym.match3 !== undefined ? (
                        <>
                          <span className="flex-1 text-center text-xs font-heading font-bold" style={{ color: 'hsl(43 80% 60%)' }}>{sym.match3}x</span>
                          {sym.match4 !== undefined && <span className="flex-1 text-center text-xs font-heading font-bold" style={{ color: 'hsl(25 80% 60%)' }}>{sym.match4}x</span>}
                          {sym.match5 !== undefined && <span className="flex-1 text-center text-xs font-heading font-bold" style={{ color: 'hsl(0 80% 60%)' }}>{sym.match5}x</span>}
                        </>
                      ) : sym.description ? (
                        <span className="flex-1 text-[10px] text-muted-foreground font-heading text-center">{sym.description}</span>
                      ) : null}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy symbols (backward compat) */}
            {!symbolPayouts && symbols && symbols.length > 0 && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1 h-4 rounded-full" style={{ background: 'hsl(43 96% 56%)' }} />
                  <p className="text-xs font-heading font-bold text-foreground">Symbols</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {symbols.map((sym, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className="rounded-xl p-2.5 text-center"
                      style={{ background: 'hsl(220 22% 14%)', border: '1px solid hsl(220 15% 22%)' }}>
                      <span className="text-2xl block drop-shadow-lg">{sym.label}</span>
                      {sym.description && (
                        <span className="text-[8px] text-muted-foreground block mt-1 leading-tight">{sym.description}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Provably Fair Badge */}
            <div className="px-5 pb-3">
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'hsl(145 40% 15% / 0.5)', border: '1px solid hsl(145 50% 40% / 0.3)' }}>
                <Shield size={18} style={{ color: 'hsl(145 60% 50%)' }} />
                <div>
                  <p className="text-xs font-heading font-bold" style={{ color: 'hsl(145 60% 60%)' }}>Provably Fair</p>
                  <p className="text-[10px] text-muted-foreground">Every outcome uses certified RNG and is independently verifiable</p>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="px-5 pb-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full" style={{ background: 'hsl(43 96% 56%)' }} />
                <p className="text-xs font-heading font-bold text-foreground">Rules</p>
              </div>
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'hsl(220 22% 12%)', border: '1px solid hsl(220 15% 20%)' }}>
                {gameRules.map((rule, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="flex items-start gap-2">
                    <span className="text-xs flex-shrink-0">{rule.emoji}</span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{rule.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const triggerButton = trigger ? (
    cloneElement(trigger, { onClick: () => setOpen(true) } as Record<string, unknown>)
  ) : (
    <button onClick={() => setOpen(true)}
      className="p-1.5 rounded-lg relative group"
      style={{ background: 'rgba(255,255,255,0.05)' }}
      aria-label="Paytable">
      <Info size={18} className="text-primary" />
      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
    </button>
  );

  return (
    <>
      {triggerButton}
      {createPortal(modalContent, document.body)}
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </>
  );
};

export default PaytableModal;
