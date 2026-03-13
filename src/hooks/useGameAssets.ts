import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameAsset {
  id: string;
  game_id: string;
  asset_type: 'symbol' | 'background' | 'music' | 'mascot';
  asset_key: string;
  asset_url: string;
  label: string | null;
  sort_order: number;
}

/**
 * Fetches custom assets for a game from the database.
 * Returns a map of asset_key → asset_url for each type.
 * Falls back to defaults if no custom assets exist.
 */
export const useGameAssets = (gameId: string) => {
  const [symbols, setSymbols] = useState<Record<string, string>>({});
  const [background, setBackground] = useState<string | null>(null);
  const [backgroundZoom, setBackgroundZoom] = useState<number>(100);
  const [music, setMusic] = useState<string | null>(null);
  const [mascot, setMascot] = useState<string | null>(null);
  const [mascotSize, setMascotSize] = useState<number>(128);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('game_assets')
        .select('*')
        .eq('game_id', gameId)
        .order('sort_order');

      if (data && data.length > 0) {
        const symMap: Record<string, string> = {};
        let bg: string | null = null;
        let bgZoom = 100;
        let mus: string | null = null;
        let mas: string | null = null;
        let masSize = 128;

        (data as GameAsset[]).forEach(a => {
          if (a.asset_type === 'symbol') {
            symMap[a.asset_key] = a.asset_url;
          } else if (a.asset_type === 'background') {
            bg = a.asset_url;
            if (a.label && !isNaN(Number(a.label))) {
              bgZoom = Number(a.label);
            }
          } else if (a.asset_type === 'music') {
            mus = a.asset_url;
          } else if (a.asset_type === 'mascot') {
            if (a.asset_key === 'hero') {
              mas = a.asset_url;
              if (a.label && !isNaN(Number(a.label))) {
                masSize = Number(a.label);
              }
            }
          }
        });

        setSymbols(symMap);
        setBackground(bg);
        setBackgroundZoom(bgZoom);
        setMusic(mus);
        setMascot(mas);
        setMascotSize(masSize);
      }
      setLoading(false);
    };
    fetch();
  }, [gameId]);

  return { symbols, background, backgroundZoom, music, mascot, mascotSize, loading };
};
