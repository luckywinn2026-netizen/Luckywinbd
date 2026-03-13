import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Radio, Loader2 } from 'lucide-react';
import LiveTicker from '@/components/LiveTicker';
import { useLanguage } from '@/contexts/LanguageContext';

// Local fallback thumbnails for games missing DB thumbnails
const localThumbnails: Record<string, string> = {};
const thumbModules = import.meta.glob('/src/games/**/assets/thumbnail.jpg', { eager: true, import: 'default' }) as Record<string, string>;
for (const [path, url] of Object.entries(thumbModules)) {
  const parts = path.split('/');
  const gameId = parts[parts.length - 3];
  localThumbnails[gameId] = url;
}


const fetchCyberLiveMatches = async () => {
  const { data } = await supabase
    .from('cyber_matches')
    .select('*')
    .in('status', ['live', 'upcoming'])
    .order('match_time', { ascending: true })
    .limit(3);
  return data || [];
};

type BannerItem = { id: string; image_url: string; link_url: string | null };

// Fix Supabase storage URL: must include /object/public/ for public buckets
function fixBannerImageUrl(url: string): string {
  if (!url) return url;
  // Wrong: .../object/promo-banners/... → Right: .../object/public/promo-banners/...
  if (url.includes('/object/') && !url.includes('/object/public/')) {
    return url.replace('/storage/v1/object/', '/storage/v1/object/public/');
  }
  return url;
}

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [bannerIdx, setBannerIdx] = useState(0);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [popularGames, setPopularGames] = useState<{ name: string; img: string; path: string }[]>([]);

  useEffect(() => {
    supabase
      .from('promo_banners')
      .select('id, image_url, link_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) return; // Table may not exist or RLS
        if (data && data.length > 0) {
          const items = (data as BannerItem[]).map(b => ({
            ...b,
            image_url: fixBannerImageUrl(b.image_url),
          }));
          setBanners(items);
        }
      });
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    supabase.from('games').select('game_id, name, thumbnail_url, game_type, popular').eq('popular', true).eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) {
        setPopularGames(data.map(g => ({
          name: g.name.startsWith('Lucky') ? g.name : `Lucky ${g.name}`,
          img: g.thumbnail_url || localThumbnails[g.game_id] || '',
          path: g.game_type === 'crash' ? `/crash/${g.game_id}` : `/slots/${g.game_id}`,
        })));
      }
    });
  }, []);

  const { data: cyberMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['home-cyber-matches'],
    queryFn: fetchCyberLiveMatches,
    refetchInterval: 15000,
  });

  const quickLinks = [
    { icon: '⚽', label: t('home.football'), path: '/sports' },
    { icon: '🏏', label: t('home.cricket'), path: '/sports' },
    { icon: '🎰', label: t('home.slots'), path: '/slots' },
    { icon: '✈️', label: t('home.crash'), path: '/crash' },
  ];

  const handleBannerClick = (b: BannerItem) => {
    if (b.link_url) {
      if (b.link_url.startsWith('http')) window.open(b.link_url, '_blank');
      else navigate(b.link_url);
    }
  };

  return (
    <div className="pb-4">
      {/* Banner Slider */}
      {banners.length > 0 && (
        <div
          className="relative mx-4 mt-3 rounded-xl overflow-hidden h-40 cursor-pointer"
          onClick={() => banners[bannerIdx] && handleBannerClick(banners[bannerIdx])}
        >
          {banners.map((b, i) => (
            <motion.img
              key={b.id}
              src={b.image_url}
              alt="Promo"
              className="absolute inset-0 w-full h-full object-cover"
              initial={false}
              animate={{ opacity: i === bannerIdx ? 1 : 0 }}
              transition={{ duration: 0.5 }}
            />
          ))}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === bannerIdx ? 'bg-primary' : 'bg-foreground/30'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Access */}
      <div className="grid grid-cols-4 gap-3 mx-4 mt-4">
        {quickLinks.map(q => (
          <motion.button
            key={q.label}
            onClick={() => navigate(q.path)}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1.5 bg-card rounded-xl py-3 gold-border card-glow"
          >
            <span className="text-2xl">{q.icon}</span>
            <span className="text-xs font-heading font-semibold">{q.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Spin & Leaderboard Row */}
      <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/spin')}
          className="flex items-center gap-2 bg-gradient-to-r from-[hsl(280,60%,50%)] to-[hsl(320,70%,45%)] rounded-xl p-3 gold-border"
        >
          <span className="text-2xl">🎡</span>
          <div className="text-left">
            <p className="font-heading font-bold text-xs text-foreground">{t('home.dailySpin')}</p>
            <p className="text-[10px] text-foreground/60">{t('home.freePrizes')}</p>
          </div>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/leaderboard')}
          className="flex items-center gap-2 bg-gradient-to-r from-success to-[hsl(160,60%,35%)] rounded-xl p-3 gold-border"
        >
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <p className="font-heading font-bold text-xs text-foreground">{t('home.leaderboard')}</p>
            <p className="text-[10px] text-foreground/60">{t('home.topWinners')}</p>
          </div>
        </motion.button>
      </div>

      {/* Promo Banner */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('/promotions')}
        className="mx-4 mt-3 w-[calc(100%-2rem)] bg-gradient-to-r from-primary to-gold-dark rounded-xl p-3 flex items-center gap-3 gold-border"
      >
        <span className="text-2xl">🎁</span>
        <div className="flex-1 text-left">
          <p className="font-heading font-bold text-sm text-primary-foreground">{t('home.promotions')}</p>
          <p className="text-[10px] text-primary-foreground/70">{t('home.welcomeBonus')}</p>
        </div>
        <span className="text-primary-foreground font-heading font-bold text-sm">→</span>
      </motion.button>

      {/* 🔴 Cyber Sports Widget */}
      <div className="mx-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading font-bold text-base gold-text flex items-center gap-1.5">
            <Radio size={16} className="text-destructive animate-pulse" />
            {t('home.liveMatches')}
          </h2>
          <button onClick={() => navigate('/sports')} className="text-xs font-heading text-primary font-semibold">
            {t('home.seeAll')}
          </button>
        </div>

        {matchesLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : cyberMatches.length > 0 ? (
          <div className="space-y-2">
            {cyberMatches.map((m: any) => (
              <motion.div
                key={m.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/sports')}
                className="bg-card rounded-xl p-2.5 gold-border cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground font-heading">
                    {m.sport === 'cyber_cricket' ? t('sports.cyberCricket') : t('sports.cyberFootball')}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-heading font-bold text-destructive">
                    {m.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />}
                    {m.status === 'live' ? 'LIVE' : new Date(m.match_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-heading font-semibold text-foreground flex-1 truncate">{m.home_team}</span>
                  <span className="font-heading font-bold text-sm text-foreground mx-2">
                    {m.status === 'live' ? `${m.home_score} - ${m.away_score}` : 'vs'}
                  </span>
                  <span className="text-xs font-heading font-semibold text-foreground flex-1 truncate text-right">{m.away_team}</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-1 bg-secondary rounded-lg py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-heading">Home</p>
                    <p className="text-xs font-heading font-bold text-primary">{Number(m.odds_home).toFixed(2)}</p>
                  </div>
                  <div className="flex-1 bg-secondary rounded-lg py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-heading">{t('sports.draw')}</p>
                    <p className="text-xs font-heading font-bold text-primary">{Number(m.odds_draw).toFixed(2)}</p>
                  </div>
                  <div className="flex-1 bg-secondary rounded-lg py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-heading">Away</p>
                    <p className="text-xs font-heading font-bold text-primary">{Number(m.odds_away).toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 font-heading">{t('home.noMatches')}</p>
        )}
      </div>

      {/* Live Win Ticker */}
      <h2 className="font-heading font-bold text-base mx-4 mt-5 mb-2 gold-text">{t('home.liveWins')}</h2>
      <LiveTicker />

      {/* Popular Games */}
      {popularGames.length > 0 && (
        <>
          <h2 className="font-heading font-bold text-base mx-4 mt-2 mb-3 gold-text">{t('home.popularGames')}</h2>
          <div className="grid grid-cols-2 gap-3 px-4">
            {popularGames.map(g => (
              <motion.div
                key={g.name}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(g.path)}
                className="rounded-xl overflow-hidden bg-card gold-border card-glow cursor-pointer"
              >
                <img src={g.img} alt={g.name} className="w-full h-32 object-cover" />
                <div className="p-2">
                  <p className="text-xs font-heading font-bold truncate">{g.name}</p>
                  <p className="text-[10px] text-primary font-semibold mt-0.5">{t('home.playNow')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Index;
