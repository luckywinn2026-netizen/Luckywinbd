import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceState {
  appUnderMaintenance: boolean;
  message: string;
}

export function useMaintenance() {
  const [state, setState] = useState<MaintenanceState>({ appUnderMaintenance: false, message: '' });
  const [loading, setLoading] = useState(true);

  const fetchMaintenance = useCallback(async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'maintenance')
      .single();
    const v = (data?.value as { app_under_maintenance?: boolean; message?: string }) ?? {};
    setState({
      appUnderMaintenance: Boolean(v.app_under_maintenance),
      message: v.message || 'We are under maintenance. Please check back soon.',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMaintenance();
  }, [fetchMaintenance]);

  const setAppMaintenance = useCallback(async (enabled: boolean, message?: string) => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: 'maintenance',
        value: { app_under_maintenance: enabled, message: message ?? state.message },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    if (!error) {
      setState(prev => ({ ...prev, appUnderMaintenance: enabled, message: message ?? prev.message }));
    }
    return { error };
  }, [state.message]);

  return { ...state, loading, refetch: fetchMaintenance, setAppMaintenance };
}

export function useGameMaintenance(gameId: string | null) {
  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [gameName, setGameName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!gameId) { setLoading(false); return; }
    const { data } = await supabase
      .from('games')
      .select('under_maintenance, name')
      .eq('game_id', gameId)
      .single();
    setUnderMaintenance(Boolean(data?.under_maintenance));
    setGameName(data?.name ?? gameId);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { underMaintenance, gameName, loading };
}
