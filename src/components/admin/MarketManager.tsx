import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Check, X, Loader2, TrendingUp } from 'lucide-react';
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

const MARKET_TEMPLATES = [
  {
    type: 'over_under',
    label: '📊 Over/Under',
    getDefaults: (sport: string) => ({
      title: sport === 'cyber_cricket' ? 'Total Runs Over/Under 150.5' : 'Total Goals Over/Under 2.5',
      options: sport === 'cyber_cricket'
        ? [{ key: 'over', label: 'Over 150.5', odds: 1.85 }, { key: 'under', label: 'Under 150.5', odds: 1.95 }]
        : [{ key: 'over', label: 'Over 2.5', odds: 1.75 }, { key: 'under', label: 'Under 2.5', odds: 2.05 }],
    }),
  },
  {
    type: 'next_event',
    label: '⚡ Next Event',
    getDefaults: (sport: string) => ({
      title: sport === 'cyber_cricket' ? 'Next Wicket — Which Team?' : 'Next Goal — Which Team?',
      options: [
        { key: 'home', label: 'Home Team', odds: 1.90 },
        { key: 'away', label: 'Away Team', odds: 1.90 },
      ],
    }),
  },
  {
    type: 'odd_even',
    label: '🎲 Odd/Even',
    getDefaults: (sport: string) => ({
      title: sport === 'cyber_cricket' ? 'Total Runs Odd or Even?' : 'Total Goals Odd or Even?',
      options: [
        { key: 'odd', label: 'Odd', odds: 1.90 },
        { key: 'even', label: 'Even', odds: 1.90 },
      ],
    }),
  },
  {
    type: 'half_winner',
    label: '🏆 Half/Innings Winner',
    getDefaults: (sport: string) => ({
      title: sport === 'cyber_cricket' ? '1st Innings Winner' : '1st Half Winner',
      options: [
        { key: 'home', label: 'Home', odds: 2.20 },
        { key: 'draw', label: 'Draw/Tie', odds: 3.00 },
        { key: 'away', label: 'Away', odds: 2.50 },
      ],
    }),
  },
];

export const MarketManager = ({ matchId, sport }: { matchId: string; sport: string }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchMarkets = async () => {
    const { data } = await supabase
      .from('cyber_match_markets')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    setMarkets((data || []).map(m => ({ ...m, options: (m.options as any) || [] })) as Market[]);
    setLoading(false);
  };

  useEffect(() => { fetchMarkets(); }, [matchId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`markets-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cyber_match_markets', filter: `match_id=eq.${matchId}` }, () => fetchMarkets())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  const addMarket = async (template: typeof MARKET_TEMPLATES[0]) => {
    setAdding(true);
    const defaults = template.getDefaults(sport);
    const { error } = await supabase.from('cyber_match_markets').insert({
      match_id: matchId,
      market_type: template.type,
      title: defaults.title,
      options: defaults.options,
    });
    if (error) toast.error(error.message);
    else toast.success('Market added');
    setAdding(false);
  };

  const updateOdds = async (marketId: string, options: MarketOption[]) => {
    const { error } = await supabase.from('cyber_match_markets')
      .update({ options: options as any, updated_at: new Date().toISOString() })
      .eq('id', marketId);
    if (error) toast.error(error.message);
  };

  const toggleSuspend = async (market: Market) => {
    const newStatus = market.status === 'open' ? 'suspended' : 'open';
    const { error } = await supabase.from('cyber_match_markets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', market.id);
    if (error) toast.error(error.message);
    else fetchMarkets();
  };

  const settleMarket = async (marketId: string, resultKey: string) => {
    if (!confirm(`Settle this market with result \\"${resultKey}\\"?`)) return;
    try {
      const r = await api.rpc<{ winners?: number; total_paid?: number }>('settle_cyber_market', {
        p_market_id: marketId,
        p_result_key: resultKey,
      });
      toast.success(`Settled! Winners: ${r?.winners ?? 0}, Paid: ৳${r?.total_paid ?? 0}`);
      fetchMarkets();
    } catch (e: unknown) {
      toast.error((e as Error)?.message);
    }
  };

  const deleteMarket = async (marketId: string) => {
    if (!confirm('Delete this market?')) return;
    const { error } = await supabase.from('cyber_match_markets').delete().eq('id', marketId);
    if (error) toast.error(error.message);
    else fetchMarkets();
  };

  if (loading) return <Loader2 className="animate-spin text-primary mx-auto" size={16} />;

  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-heading font-semibold text-foreground">📈 Extra Markets</p>
        <span className="text-[10px] text-muted-foreground">{markets.length} markets</span>
      </div>

      {/* Add market buttons */}
      <div className="flex gap-1 flex-wrap">
        {MARKET_TEMPLATES.map(t => (
          <button
            key={t.type}
            onClick={() => addMarket(t)}
            disabled={adding}
            className="px-2 py-1 rounded text-[10px] font-heading font-bold bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Existing markets */}
      <AnimatePresence>
        {markets.map(market => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-lg p-2.5 space-y-2 border border-border"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-heading font-bold text-foreground truncate flex-1">{market.title}</p>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className={`text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full ${
                  market.status === 'open' ? 'bg-green-500/20 text-green-400' :
                  market.status === 'suspended' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {market.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Options with editable odds */}
            <div className="flex gap-1.5 flex-wrap">
              {market.options.map((opt, i) => (
                <div key={opt.key} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${
                  market.result_key === opt.key ? 'bg-green-500/20 border border-green-500/30' : 'bg-secondary'
                }`}>
                  <span className="font-heading font-semibold text-foreground">{opt.label}</span>
                  {market.status !== 'settled' && (
                    <input
                      type="number"
                      step="0.05"
                      value={opt.odds}
                      onChange={e => {
                        const newOpts = [...market.options];
                        newOpts[i] = { ...opt, odds: parseFloat(e.target.value) || 1 };
                        setMarkets(prev => prev.map(m => m.id === market.id ? { ...m, options: newOpts } : m));
                      }}
                      onBlur={() => updateOdds(market.id, market.options)}
                      className="w-14 bg-muted rounded px-1 py-0.5 text-[10px] font-heading font-bold text-primary text-center"
                    />
                  )}
                  {market.result_key === opt.key && <Check size={10} className="text-green-400" />}
                </div>
              ))}
            </div>

            {/* Actions */}
            {market.status !== 'settled' && (
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => toggleSuspend(market)}
                  className="px-2 py-1 rounded text-[9px] font-heading font-bold bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                >
                  {market.status === 'open' ? '⏸ Suspend' : '▶ Resume'}
                </button>
                {market.options.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => settleMarket(market.id, opt.key)}
                    className="px-2 py-1 rounded text-[9px] font-heading font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  >
                    ✓ {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => deleteMarket(market.id)}
                  className="px-2 py-1 rounded text-[9px] font-heading font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 ml-auto"
                >
                  🗑
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
