import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type MarketOption = { key: string; label: string; odds: number };
type Market = {
  id: string;
  match_id: string;
  market_type: string;
  title: string;
  options: MarketOption[];
  status: string;
  result_key: string | null;
};

const BET_AMOUNTS = [50, 100, 200, 500, 1000];

const MARKET_ICONS: Record<string, string> = {
  over_under: '📊',
  next_event: '⚡',
  odd_even: '🎲',
  half_winner: '🏆',
};

export const MatchMarkets = ({ matchId }: { matchId: string }) => {
  const { user, openAuth } = useAuth();
  const { placeBet } = useWallet();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedPick, setSelectedPick] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [placing, setPlacing] = useState(false);

  const fetchMarkets = async () => {
    const { data } = await supabase
      .from('cyber_match_markets')
      .select('*')
      .eq('match_id', matchId)
      .in('status', ['open', 'suspended'])
      .order('created_at', { ascending: true });
    setMarkets((data || []).map(m => ({ ...m, options: (m.options as any) || [] })) as Market[]);
  };

  useEffect(() => { fetchMarkets(); }, [matchId]);

  useEffect(() => {
    const ch = supabase.channel(`user-markets-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cyber_match_markets', filter: `match_id=eq.${matchId}` }, () => fetchMarkets())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  if (markets.length === 0) return null;

  const openMarkets = markets.filter(m => m.status === 'open');

  const handlePlaceBet = async () => {
    if (!user) return openAuth('login');
    if (!selectedMarket || !selectedPick) return;

    const market = markets.find(m => m.id === selectedMarket);
    if (!market || market.status !== 'open') return toast.error('Market closed');

    const option = market.options.find(o => o.key === selectedPick);
    if (!option) return;

    setPlacing(true);
    const ok = placeBet(betAmount, 'Cyber Sports', 'sports');
    if (!ok) { setPlacing(false); return toast.error('Insufficient balance'); }

    const { error } = await supabase.from('cyber_market_bets').insert({
      user_id: user.id,
      market_id: market.id,
      match_id: matchId,
      pick_key: selectedPick,
      amount: betAmount,
      odds_at_bet: option.odds,
      potential_win: Math.round(betAmount * option.odds * 100) / 100,
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Bet placed! 🎯');
      setSelectedMarket(null);
      setSelectedPick(null);
    }
    setPlacing(false);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg"
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-primary" />
          <span className="text-[11px] font-heading font-bold text-foreground">
            More Markets ({openMarkets.length})
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2"
          >
            {markets.map(market => {
              const isSelected = selectedMarket === market.id;
              const icon = MARKET_ICONS[market.market_type] || '📈';

              return (
                <div key={market.id} className="bg-secondary/30 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-heading font-bold text-foreground">
                      {icon} {market.title}
                    </span>
                    {market.status === 'suspended' && (
                      <span className="text-[9px] font-heading font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                        SUSPENDED
                      </span>
                    )}
                  </div>

                  {/* Options */}
                  <div className="flex gap-1.5">
                    {market.options.map(opt => {
                      const picked = isSelected && selectedPick === opt.key;
                      const disabled = market.status !== 'open';
                      return (
                        <button
                          key={opt.key}
                          disabled={disabled}
                          onClick={() => {
                            if (!user) return openAuth('login');
                            setSelectedMarket(market.id);
                            setSelectedPick(opt.key);
                          }}
                          className={`flex-1 rounded-lg p-2 text-center transition-all ${
                            disabled ? 'opacity-40 cursor-not-allowed bg-secondary' :
                            picked
                              ? 'bg-primary/20 border border-primary/50 ring-1 ring-primary/30'
                              : 'bg-secondary hover:bg-secondary/80'
                          }`}
                        >
                          <p className="text-[9px] text-muted-foreground font-heading truncate">{opt.label}</p>
                          <p className="text-sm font-heading font-bold text-primary">{opt.odds.toFixed(2)}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bet Panel */}
                  <AnimatePresence>
                    {isSelected && selectedPick && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 border-t border-border space-y-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {BET_AMOUNTS.map(a => (
                              <button
                                key={a}
                                onClick={() => setBetAmount(a)}
                                className={`px-3 py-1 rounded-lg text-xs font-heading font-bold transition-colors ${
                                  betAmount === a ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                ৳{a}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Potential Win:</span>
                            <span className="font-heading font-bold text-primary">
                              ৳{(betAmount * (market.options.find(o => o.key === selectedPick)?.odds || 1)).toFixed(0)}
                            </span>
                          </div>
                          <button
                            onClick={handlePlaceBet}
                            disabled={placing}
                            className="w-full py-2.5 rounded-xl gold-gradient font-heading font-bold text-sm text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
                          >
                            {placing ? 'Placing...' : `Bet ৳${betAmount}`}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
