import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Gamepad2, Shield, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

type ActivePlayer = {
  id: string;
  user_id: string;
  game_name: string;
  game_display_name: string | null;
  game_type: string;
  bet_amount: number;
  last_active_at: string;
  started_at: string;
  username?: string;
  forced_result?: string | null;
};

const FORCE_OPTIONS = [
  { value: 'loss', label: '💥 Force Loss', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'big_win', label: '🎉 Big Win', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'mega_win', label: '🏆 Mega Win', color: 'bg-primary/20 text-primary border-primary/30' },
];

const ActivePlayersSection = () => {
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [loadingForce, setLoadingForce] = useState<string | null>(null);

  const fetchActivePlayers = useCallback(async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('active_players')
      .select('*')
      .gte('last_active_at', twoMinutesAgo)
      .order('last_active_at', { ascending: false });
    if (!data) return;

    const enriched = await Promise.all(data.map(async (p) => {
      const [{ data: profile }, { data: forceData }] = await Promise.all([
        supabase.from('profiles').select('username').eq('user_id', p.user_id).single(),
        supabase.from('profiles').select('forced_result').eq('user_id', p.user_id).single(),
      ]);
      return {
        ...p,
        username: profile?.username || p.user_id.slice(0, 8),
        forced_result: forceData?.forced_result || null,
      };
    }));
    setActivePlayers(enriched);
  }, []);

  useEffect(() => {
    fetchActivePlayers();

    const channel = supabase
      .channel('dashboard-active-players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_players' }, () => {
        fetchActivePlayers();
      })
      .subscribe();

    const pollInterval = setInterval(fetchActivePlayers, 8000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchActivePlayers]);

  const handleForceResult = async (userId: string, value: string | null) => {
    setLoadingForce(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ forced_result: value })
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to set force result');
    } else {
      toast.success(value ? `Force ${value} set` : 'Force result removed');
      setActivePlayers(prev => prev.map(p =>
        p.user_id === userId ? { ...p, forced_result: value } : p
      ));
    }
    setLoadingForce(null);
  };

  // Group by game
  const gameGroups = activePlayers.reduce((acc, p) => {
    const key = p.game_display_name || p.game_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, ActivePlayer[]>);

  if (activePlayers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Gamepad2 size={18} className="text-green-400" />
        <h2 className="font-heading font-bold text-sm md:text-base">
          🟢 Active Players ({activePlayers.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
        {Object.entries(gameGroups).map(([game, players]) => (
          <motion.div
            key={game}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-3 gold-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading font-bold text-xs md:text-sm">{game}</span>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-heading font-bold">
                {players.length} playing
              </span>
            </div>
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="bg-background/50 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">{p.username}</span>
                    <span className="text-[10px] text-cyan-400 font-heading font-bold">৳{Number(p.bet_amount).toLocaleString()}</span>
                  </div>

                  {/* Force Controls */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {FORCE_OPTIONS.map(opt => {
                      const isActive = p.forced_result === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleForceResult(p.user_id, isActive ? null : opt.value)}
                          disabled={loadingForce === p.user_id}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                            isActive
                              ? opt.color + ' font-bold'
                              : 'border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {loadingForce === p.user_id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            opt.label
                          )}
                        </button>
                      );
                    })}
                    {p.forced_result && (
                      <button
                        onClick={() => handleForceResult(p.user_id, null)}
                        disabled={loadingForce === p.user_id}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  {p.forced_result && (
                    <div className="mt-1 flex items-center gap-1">
                      <Shield size={10} className="text-primary" />
                      <span className="text-[9px] text-primary font-bold uppercase">{p.forced_result}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActivePlayersSection;
