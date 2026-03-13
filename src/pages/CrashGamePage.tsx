import { lazy, Suspense } from 'react';
import { useGameMaintenance } from '@/hooks/useMaintenance';
import GameMaintenanceOverlay from '@/components/GameMaintenanceOverlay';

const gameComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'aviator': lazy(() => import('@/games/crash/aviator/AviatorCrashGame')),
  'rocket': lazy(() => import('@/games/crash/rocket/RocketCrashGame')),
  'jet': lazy(() => import('@/games/crash/jet/JetCrashGame')),
  'chicken-road': lazy(() => import('@/games/crash/chicken-road/ChickenRoadGame')),
  'turbo': lazy(() => import('@/games/crash/turbo/TurboCrashGame')),
  'multi': lazy(() => import('@/games/crash/multi/MultiplierXGame')),
};

const CrashGamePage = ({ gameId }: { gameId: string }) => {
  const { underMaintenance, gameName, loading } = useGameMaintenance(gameId);
  const GameComponent = gameComponents[gameId] || gameComponents['aviator'];
  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      {!loading && underMaintenance && <GameMaintenanceOverlay gameName={gameName} backPath="/crash" />}
      <Suspense fallback={<div className="min-h-screen navy-gradient flex items-center justify-center text-foreground">Loading...</div>}>
        <GameComponent />
      </Suspense>
    </div>
  );
};

export default CrashGamePage;
