import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks the current user as an active player in a game.
 * Inserts on mount, updates heartbeat every 10s, deletes on unmount.
 * Heartbeat keeps last_active_at fresh so admin sees real-time online status.
 */
export const useActivePlayer = (
  gameName: string,
  gameDisplayName: string,
  gameType: 'slot' | 'crash' | 'ludo',
  betAmount: number
) => {
  const recordIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Upsert: delete old record for same game first
      await supabase
        .from('active_players')
        .delete()
        .eq('user_id', user.id)
        .eq('game_name', gameName);

      const { data } = await supabase
        .from('active_players')
        .insert({
          user_id: user.id,
          game_name: gameName,
          game_display_name: gameDisplayName,
          game_type: gameType,
          bet_amount: betAmount,
        })
        .select('id')
        .single();

      if (data && !cancelled) {
        recordIdRef.current = data.id;

        // Heartbeat every 10s for real-time online status
        intervalRef.current = setInterval(async () => {
          if (recordIdRef.current) {
            await supabase
              .from('active_players')
              .update({ last_active_at: new Date().toISOString(), bet_amount: betAmount })
              .eq('id', recordIdRef.current);
          }
        }, 10000);
      }
    };

    start();

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      // Cleanup: remove active player record
      if (recordIdRef.current) {
        supabase
          .from('active_players')
          .delete()
          .eq('id', recordIdRef.current)
          .then(() => {});
      }
    };
  }, [gameName, gameDisplayName, gameType]);

  // Update bet amount on change
  useEffect(() => {
    if (recordIdRef.current && betAmount > 0) {
      supabase
        .from('active_players')
        .update({ bet_amount: betAmount })
        .eq('id', recordIdRef.current)
        .then(() => {});
    }
  }, [betAmount]);
};
