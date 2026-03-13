import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if the current user has a forced result set by admin.
 * Uses Realtime subscription instead of polling for instant updates.
 * Returns: null (normal), 'loss', 'mega_win', 'big_win', etc.
 */
export const useForcedResult = () => {
  const [forcedResult, setForcedResult] = useState<string | null>(null);

  useEffect(() => {
    let userId: string | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Initial fetch
      const { data } = await supabase
        .from('profiles')
        .select('forced_result')
        .eq('user_id', user.id)
        .single();
      if (data) setForcedResult(data.forced_result);
    };
    init();

    // Realtime subscription for instant admin updates
    const channel = supabase
      .channel('forced-result-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          if (userId && payload.new.user_id === userId) {
            setForcedResult((payload.new as any).forced_result ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return forcedResult;
};
