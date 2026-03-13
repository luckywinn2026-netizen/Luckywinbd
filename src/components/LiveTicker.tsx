import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

type TickerWin = { name: string; amount: string; game: string };

const FALLBACK_WINS: TickerWin[] = [
  { name: 'Rahim', amount: '৳12,450', game: 'Aviator' },
  { name: 'Karim', amount: '৳8,200', game: 'Slots' },
  { name: 'Faruk', amount: '৳5,600', game: 'Cricket Bet' },
  { name: 'Jamal', amount: '৳15,000', game: 'Lucky Boxing King' },
  { name: 'Nasir', amount: '৳3,800', game: 'Rocket Crash' },
  { name: 'Shakib', amount: '৳22,100', game: 'Football Bet' },
  { name: 'Tamim', amount: '৳9,500', game: 'Book of Dead' },
  { name: 'Mushfiq', amount: '৳7,300', game: 'Jet Crash' },
];

const LiveTicker = () => {
  const { t } = useLanguage();
  const [wins, setWins] = useState<TickerWin[]>(FALLBACK_WINS);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const loadFakeWins = async () => {
      const { data } = await supabase
        .from('fake_wins')
        .select('username, win_amount, game_name')
        .eq('is_active', true)
        .eq('show_on_ticker', true)
        .order('win_amount', { ascending: false });

      if (data && data.length > 0) {
        const dbWins: TickerWin[] = data.map((r: any) => ({
          name: r.username,
          amount: `৳${Number(r.win_amount).toLocaleString()}`,
          game: r.game_name,
        }));
        setWins([...dbWins, ...FALLBACK_WINS]);
      }
    };
    loadFakeWins();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % wins.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [wins.length]);

  const win = wins[index];

  return (
    <div className="mx-4 mb-4 gold-border rounded-lg bg-secondary/50 px-3 py-2 overflow-hidden">
      <div key={index} className="flex items-center gap-2 animate-slide-up-ticker">
        <span className="text-lg">🏆</span>
        <span className="text-sm font-heading">
          <span className="text-primary font-bold">{win.name}</span>
          <span className="text-muted-foreground">{t('ticker.won')}</span>
          <span className="text-success font-bold">{win.amount}</span>
          <span className="text-muted-foreground">{t('ticker.in')}</span>
          <span className="text-foreground font-semibold">{win.game}</span>
        </span>
      </div>
    </div>
  );
};

export default LiveTicker;
