import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MultiplierSettings {
  pct_1x: number;
  pct_2x_25x: number;
  pct_100x_500x: number;
  pct_wild: number;
  pct_scatter: number;
}

const DEFAULT_SETTINGS: MultiplierSettings = {
  pct_1x: 90,
  pct_2x_25x: 5,
  pct_100x_500x: 2,
  pct_wild: 2,
  pct_scatter: 1,
};

let cachedSettings: MultiplierSettings | null = null;
let lastFetch = 0;
const CACHE_TTL = 60_000; // 60s cache (was 30s)

export const useMultiplierSettings = () => {
  const [settings, setSettings] = useState<MultiplierSettings>(cachedSettings || DEFAULT_SETTINGS);

  useEffect(() => {
    const now = Date.now();
    if (cachedSettings && now - lastFetch < CACHE_TTL) {
      setSettings(cachedSettings);
      return;
    }

    supabase
      .from('multiplier_settings' as any)
      .select('pct_1x, pct_2x_25x, pct_100x_500x, pct_wild, pct_scatter')
      .limit(1)
      .then(({ data, error }) => {
        if (error) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          const s = row as any as MultiplierSettings;
          cachedSettings = s;
          lastFetch = Date.now();
          setSettings(s);
        }
      })
      .catch(() => { /* fallback to DEFAULT_SETTINGS already in state */ });
  }, []);

  return settings;
};

// Non-hook version for use in spin functions
export const getMultiplierSettings = async (): Promise<MultiplierSettings> => {
  const now = Date.now();
  if (cachedSettings && now - lastFetch < CACHE_TTL) return cachedSettings;

  try {
    const { data, error } = await supabase
      .from('multiplier_settings' as any)
      .select('pct_1x, pct_2x_25x, pct_100x_500x, pct_wild, pct_scatter')
      .limit(1);

    if (error) return DEFAULT_SETTINGS;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      cachedSettings = row as any as MultiplierSettings;
      lastFetch = Date.now();
      return cachedSettings;
    }
  } catch {
    /* fallback to defaults */
  }
  return DEFAULT_SETTINGS;
};

export const pickSpecialIdxFromSettings = (s: MultiplierSettings): number => {
  const roll = Math.random() * 100;
  const c1 = s.pct_1x;
  const c2 = c1 + s.pct_2x_25x;
  const c3 = c2 + s.pct_100x_500x;
  const c4 = c3 + s.pct_wild;

  if (roll < c1) return 0; // 1x
  if (roll < c2) {
    const options = [1, 2, 3]; // 2x, 3x, 5x
    return options[Math.floor(Math.random() * options.length)];
  }
  if (roll < c3) return 6 + Math.floor(Math.random() * 3); // 100x-500x
  if (roll < c4) return 9; // wild
  return 10; // scatter
};
