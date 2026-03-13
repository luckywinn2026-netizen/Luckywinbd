import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import aviator from '@/assets/aviator-thumb.jpg';
import crashRocket from '@/assets/crash-rocket.jpg';
import crashJet from '@/assets/crash-jet.jpg';
import AuthGate from '@/components/AuthGate';

const defaultCrashGames = [
  { id: 'aviator', name: 'Aviator', img: aviator, emoji: '✈️' },
  { id: 'rocket', name: 'Rocket Crash', img: crashRocket, emoji: '🚀' },
  { id: 'jet', name: 'Jet Crash', img: crashJet, emoji: '🛩️' },
  { id: 'chicken-road', name: 'Chicken Road', img: crashRocket, emoji: '🐔' },
  { id: 'turbo', name: 'Turbo Crash', img: crashRocket, emoji: '⚡' },
  { id: 'multi', name: 'Multiplier X', img: crashRocket, emoji: '🔥' },
];

const CrashPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [games, setGames] = useState<{ id: string; name: string; img: string | null; emoji: string }[]>([]);
  const liveMultipliers = useMemo(() =>
    Object.fromEntries([...defaultCrashGames.map(g => [g.id, (1 + Math.random() * 10).toFixed(2)])])
  , []);

  useEffect(() => {
    supabase.from('games').select('game_id, name, thumbnail_url, emoji, sort_order').eq('game_type', 'crash').order('sort_order').then(({ data }) => {
      if (data && data.length > 0) {
        const fallback = Object.fromEntries(defaultCrashGames.map(g => [g.id, g]));
        setGames(data.map(g => ({
          id: g.game_id,
          name: g.name || fallback[g.game_id]?.name || g.game_id,
          img: g.thumbnail_url || fallback[g.game_id]?.img || null,
          emoji: g.emoji || fallback[g.game_id]?.emoji || '🎮',
        })));
      } else {
        setGames(defaultCrashGames.map(g => ({ ...g, img: g.img })));
      }
    });
  }, []);

  const displayGames = games.length > 0 ? games : defaultCrashGames.map(g => ({ ...g, img: g.img }));

  return (
    <AuthGate>
      <div className="px-4 pt-3">
        <h1 className="font-heading font-bold text-xl gold-text mb-4">{t('crash.title')}</h1>
        <div className="space-y-3">
          {displayGames.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/crash/${g.id}`)}
              className="flex items-center gap-3 bg-card rounded-xl p-3 gold-border card-glow cursor-pointer"
            >
              <img src={g.img || aviator} alt={g.name} className="w-20 h-20 rounded-lg object-cover" loading="lazy" />
              <div className="flex-1">
                <p className="font-heading font-bold text-base">{g.emoji} {g.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('crash.tapToPlay')}</p>
                <div className="mt-1.5 inline-block px-3 py-1 rounded-full gold-gradient">
                  <span className="text-xs font-heading font-bold text-primary-foreground">{t('crash.playNow')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-heading font-bold text-lg animate-multiplier">
                  {liveMultipliers[g.id]}x
                </p>
                <p className="text-[10px] text-muted-foreground">{t('crash.live')}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AuthGate>
  );
};

export default CrashPage;
