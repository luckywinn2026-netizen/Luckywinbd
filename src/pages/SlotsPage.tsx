import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AuthGate from '@/components/AuthGate';

import thumbSweetBonanza from '@/games/slots/sweet-bonanza/assets/thumbnail.jpg';
import thumbLudoKing from '@/games/ludo/ludo-king/assets/thumbnail.jpg';
import thumbLucky777 from '@/games/slots/lucky-777/assets/thumbnail.jpg';
import thumbTropicalFruits from '@/games/slots/tropical-fruits/assets/thumbnail.jpg';
import thumbSuperAce from '@/games/slots/super-ace/assets/thumbnail.jpg';
import thumbGoldenBook from '@/games/slots/golden-book/assets/thumbnail.jpg';
import thumbClassic777 from '@/games/slots/classic-777/assets/thumbnail.jpg';
import thumbFruitParty from '@/games/slots/fruit-party/assets/thumbnail.jpg';
import thumbMoneyComing from '@/games/slots/money-coming/assets/thumbnail.jpg';
import thumbFortuneGems from '@/games/slots/fortune-gems/assets/thumbnail.jpg';
import thumbFortuneWheel from '@/games/slots/fortune-wheel/assets/thumbnail.jpg';
import thumbClassicCasino from '@/games/slots/classic-casino/assets/thumbnail.jpg';
import thumbColorPrediction from '@/games/color/color-prediction/assets/thumbnail.jpg';
import thumbSpinWheel from '@/games/slots/spin-wheel/assets/thumbnail.jpg';
import thumbLuckySpin from '@/games/slots/lucky-spin/assets/thumbnail.jpg';
import thumbLuckyWin from '@/games/slots/lucky-win/assets/thumbnail.jpg';

const defaultSlots = [
  { id: 'super-ace', name: 'Super Ace', img: thumbSuperAce, rtp: '96.7%', popular: true },
  { id: 'sweet-bonanza', name: 'Lucky Boxing King', img: thumbSweetBonanza, rtp: '96.5%', popular: true },
  { id: 'ludo-king', name: 'Lucky Ludo King', img: thumbLudoKing, rtp: '96.2%', popular: true },
  { id: 'money-coming', name: 'Lucky Money Coming', img: thumbMoneyComing, rtp: '95.9%', popular: true },
  { id: 'lucky-777', name: 'Lucky 777', img: thumbLucky777, rtp: '95.8%' },
  { id: 'tropical-fruits', name: 'Lucky Tropical Fruits', img: thumbTropicalFruits, rtp: '96.0%' },
  { id: 'golden-book', name: 'Lucky Golden Book', img: thumbGoldenBook, rtp: '95.5%' },
  { id: 'classic-777', name: 'Lucky Classic 777', img: thumbClassic777, rtp: '94.8%' },
  { id: 'fruit-party', name: 'Lucky Fruit Party', img: thumbFruitParty, rtp: '96.5%' },
  { id: 'fortune-gems', name: 'Lucky Fortune Gems', img: thumbFortuneGems, rtp: '96.6%', popular: true },
  { id: 'fortune-wheel', name: 'Lucky Fortune Wheel', img: thumbFortuneWheel, rtp: '96.3%', popular: true },
  { id: 'classic-casino', name: 'Lucky Classic Casino', img: thumbClassicCasino, rtp: '96.1%', popular: true },
  { id: 'color-prediction', name: 'Lucky Color Prediction', img: thumbColorPrediction, rtp: '97.0%', popular: true },
  { id: 'spin-wheel', name: 'Lucky Spin the Wheel', img: thumbSpinWheel, rtp: '96.8%', popular: true },
  { id: 'lucky-spin', name: 'Lucky Spin', img: thumbLuckySpin, rtp: '96.5%', popular: true },
  { id: 'lucky-win', name: 'Lucky Win', img: thumbLuckyWin, rtp: '96.4%', popular: true },
];
const defaultSlotPoster = thumbSuperAce;

type DbGame = {
  game_id: string;
  name: string;
  thumbnail_url: string | null;
  popular?: boolean;
  is_active?: boolean;
  sort_order?: number;
};

const SlotsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dbGames, setDbGames] = useState<DbGame[]>([]);

  const fallbackMap = defaultSlots.reduce<Record<string, typeof defaultSlots[number]>>((acc, slot) => {
    acc[slot.id] = slot;
    return acc;
  }, {});

  useEffect(() => {
    supabase.from('games').select('game_id, name, thumbnail_url, popular, is_active, sort_order, game_type').in('game_type', ['slot', 'ludo']).order('sort_order').then(({ data }) => {
      if (data) {
        setDbGames(data);
      }
    });
  }, []);

  const dbMap = dbGames.reduce<Record<string, DbGame>>((acc, game) => {
    acc[game.game_id] = game;
    return acc;
  }, {});

  const dbOnlyGames = dbGames
    .filter(game => !fallbackMap[game.game_id] && game.is_active !== false)
    .map(game => ({
      id: game.game_id,
      name: game.name || game.game_id,
      img: game.thumbnail_url,
      rtp: 'Live',
      popular: game.popular ?? false,
      sortOrder: game.sort_order ?? 9999,
    }));

  const mergedDefaultGames = defaultSlots
    .map((slot, index) => {
      const dbGame = dbMap[slot.id];
      if (dbGame?.is_active === false) return null;

      // sweet-bonanza (Boxing King) always displays as Lucky Boxing King
      const displayName = slot.id === 'sweet-bonanza' ? 'Lucky Boxing King' : (dbGame?.name || slot.name);

      return {
        id: slot.id,
        name: displayName,
        img: dbGame?.thumbnail_url || slot.img,
        rtp: slot.rtp,
        popular: dbGame?.popular ?? slot.popular ?? false,
        sortOrder: dbGame?.sort_order ?? index,
      };
    })
    .filter((game): game is NonNullable<typeof game> => Boolean(game));

  const displaySlots = [...mergedDefaultGames, ...dbOnlyGames]
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <AuthGate>
      <div className="px-4 pt-3 pb-16">
        <h1 className="font-heading font-bold text-xl gold-text mb-4">{t('slots.title')}</h1>
        <div className="grid grid-cols-2 gap-3">
          {displaySlots.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl overflow-hidden gold-border card-glow"
            >
              <div className="relative">
                <img src={s.img || defaultSlotPoster} alt={s.name} className="w-full h-40 object-cover" loading="lazy" />
                {'popular' in s && s.popular && (
                  <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-heading font-bold px-2 py-0.5 rounded-md">
                    {t('slots.popular')}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="font-heading font-bold text-sm truncate">{s.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">RTP: {s.rtp}</span>
                </div>
                <button
                  onClick={() => navigate(`/slots/${s.id}`)}
                  className="w-full mt-2 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Play size={14} fill="currentColor" />
                  {t('slots.playNow')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AuthGate>
  );
};

export default SlotsPage;
