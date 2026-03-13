import { lazy, Suspense } from 'react';
import { useGameMaintenance } from '@/hooks/useMaintenance';
import GameMaintenanceOverlay from '@/components/GameMaintenanceOverlay';

// Lazy load each slot game from its own folder
const gameComponents: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'sweet-bonanza': lazy(() => import('@/games/slots/sweet-bonanza/BoxingKingPixiGame')),
  'ludo-king': lazy(() => import('@/games/ludo/ludo-king/LudoKingGame')),
  'lucky-777': lazy(() => import('@/games/slots/lucky-777/Lucky777Game')),
  'tropical-fruits': lazy(() => import('@/games/slots/tropical-fruits/TropicalFruitsGame')),
  'super-ace': lazy(() => import('@/games/slots/super-ace/SuperAceGame')),
  'golden-book': lazy(() => import('@/games/slots/golden-book/GoldenBookGame')),
  'classic-777': lazy(() => import('@/games/slots/classic-777/Classic777Game')),
  'fruit-party': lazy(() => import('@/games/slots/fruit-party/FruitPartyGame')),
  'mega-moolah': lazy(() => import('@/games/slots/mega-moolah/MegaMoolahGame')),
  'starburst': lazy(() => import('@/games/slots/starburst/StarburstGame')),
  'money-coming': lazy(() => import('@/games/slots/money-coming/MoneyComingGame')),
  'book-of-dead': lazy(() => import('@/games/slots/book-of-dead/BookOfDeadGame')),
  'fortune-gems': lazy(() => import('@/games/slots/fortune-gems/FortuneGemsGame')),
  'fortune-wheel': lazy(() => import('@/games/slots/fortune-wheel/FortuneWheelGame')),
  'classic-casino': lazy(() => import('@/games/slots/classic-casino/ClassicCasinoGame')),
  'color-prediction': lazy(() => import('@/games/color/color-prediction/ColorPredictionGame')),
  'spin-wheel': lazy(() => import('@/games/slots/spin-wheel/SpinWheelGame')),
  'lucky-spin': lazy(() => import('@/games/slots/lucky-spin/LuckySpinGame')),
  'bike-racing': lazy(() => import('@/games/slots/bike-racing/BikeRacingGame')),
  'lucky-win': lazy(() => import('@/games/slots/lucky-win/LuckyWinGame')),
};

const SlotGamePage = ({ gameId }: { gameId: string }) => {
  const { underMaintenance, gameName, loading } = useGameMaintenance(gameId);
  const GameComponent = gameComponents[gameId] || gameComponents['lucky-777'];
  return (
    <div
      className="relative min-h-[100dvh] min-h-[100svh] w-full max-w-[100vw] overflow-x-hidden overflow-y-auto slot-game-page"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {!loading && underMaintenance && <GameMaintenanceOverlay gameName={gameName} backPath="/slots" />}
      <Suspense fallback={<div className="min-h-screen navy-gradient flex items-center justify-center text-foreground">Loading...</div>}>
        <GameComponent />
      </Suspense>
    </div>
  );
};

export default SlotGamePage;
