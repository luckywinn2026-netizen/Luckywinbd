import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CrashSettings = {
  mode: string;
  fixed_crash_point: number | null;
  min_crash: number;
  max_crash: number;
  house_edge_percent: number;
};

const DEFAULT_SETTINGS: CrashSettings = {
  mode: 'auto',
  fixed_crash_point: null,
  min_crash: 1.01,
  max_crash: 100,
  house_edge_percent: 22,
};

let cachedSettings: CrashSettings = { ...DEFAULT_SETTINGS };
let lastFetch = 0;
const CACHE_TTL = 60_000; // 60 seconds cache

/**
 * Fetch crash settings with module-level cache (60s TTL).
 * All crash game components share the same cached data.
 */
export const getCrashSettings = async (): Promise<CrashSettings> => {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL) return cachedSettings;

  const { data } = await supabase
    .from('crash_settings')
    .select('mode, fixed_crash_point, min_crash, max_crash, house_edge_percent')
    .limit(1)
    .single();

  if (data) {
    cachedSettings = data as CrashSettings;
    lastFetch = Date.now();
  }
  return cachedSettings;
};

/**
 * Hook version — returns a ref that stays up-to-date.
 * Fetches once on mount (respects cache), no re-renders.
 */
export const useCrashSettingsRef = () => {
  const ref = useRef<CrashSettings>(cachedSettings);

  useEffect(() => {
    getCrashSettings().then(s => { ref.current = s; });
  }, []);

  return ref;
};

/** Force-refresh cache (call after admin saves new settings) */
export const invalidateCrashSettingsCache = () => {
  lastFetch = 0;
};
