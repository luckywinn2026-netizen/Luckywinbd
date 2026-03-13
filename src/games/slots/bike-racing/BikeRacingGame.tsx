import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import * as api from '@/lib/api';
import { useGameToast } from '@/hooks/useGameToast';
import AuthGate from '@/components/AuthGate';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import { useActivePlayer } from '@/hooks/useActivePlayer';

// 3D Bike images
import bikeRed from './assets/bike-red.png';
import bikeBlue from './assets/bike-blue.png';
import bikeGreen from './assets/bike-green.png';
import bikeOrange from './assets/bike-orange.png';
import bikePurple from './assets/bike-purple.png';
import bikeCyan from './assets/bike-cyan.png';
import bikePink from './assets/bike-pink.png';
import bikeWhite from './assets/bike-white.png';
import bikeSilver from './assets/bike-silver.png';
import bikeGold from './assets/bike-gold.png';
import bikeDiamond from './assets/bike-diamond.png';
import bikeRainbow from './assets/bike-rainbow.png';

const ALL_BIKES = [
  { id: 'red',      label: '🔴 Red Blaze',      color: '#ef4444', multiplier: 1.5,  img: bikeRed },
  { id: 'blue',     label: '🔵 Blue Thunder',    color: '#3b82f6', multiplier: 2,    img: bikeBlue },
  { id: 'green',    label: '🟢 Green Viper',     color: '#22c55e', multiplier: 3,    img: bikeGreen },
  { id: 'orange',   label: '🟠 Orange Fury',     color: '#f97316', multiplier: 5,    img: bikeOrange },
  { id: 'purple',   label: '🟣 Purple Storm',    color: '#a855f7', multiplier: 7,    img: bikePurple },
  { id: 'cyan',     label: '🔷 Cyan Flash',      color: '#06b6d4', multiplier: 10,   img: bikeCyan },
  { id: 'pink',     label: '🩷 Pink Phantom',    color: '#ec4899', multiplier: 12,   img: bikePink },
  { id: 'white',    label: '⚪ White Ghost',     color: '#e2e8f0', multiplier: 15,   img: bikeWhite },
  { id: 'silver',   label: '🩶 Silver Bullet',   color: '#94a3b8', multiplier: 20,   img: bikeSilver },
  { id: 'gold',     label: '🟡 Gold Legend',     color: '#eab308', multiplier: 30,   img: bikeGold },
  { id: 'diamond',  label: '💎 Diamond King',    color: '#67e8f9', multiplier: 50,   img: bikeDiamond },
  { id: 'rainbow',  label: '🌈 Rainbow Beast',  color: '#f472b6', multiplier: 100,  img: bikeRainbow },
];

const getBikeCount = (bet: number): number => {
  if (bet >= 1000) return 12;
  if (bet >= 500) return 11;
  if (bet >= 200) return 9;
  if (bet >= 100) return 7;
  if (bet >= 50) return 5;
  return 3;
};

const RACE_DURATION = 4500;
const ROAD_LINES = 20;

const BikeRacingGame = () => {
  const navigate = useNavigate();
  const { balance, placeBet, addWin, logLoss } = useWallet();
  const gameToast = useGameToast();
  const [stake, setStake] = useState('50');
  const [selectedBike, setSelectedBike] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pick' | 'racing' | 'result'>('pick');
  const [bikePositions, setBikePositions] = useState<number[]>([]);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const animRef = useRef<number>(0);
  const raceStartRef = useRef(0);
  const targetPositions = useRef<number[]>([]);
  const raceBikesRef = useRef(ALL_BIKES.slice(0, 5));

  const handleLoadingComplete = useCallback(() => setShowSplash(false), []);
  useActivePlayer('bike-racing', 'Lucky Bike Racing 3D', 'slot', Number(stake));

  const activeBikes = useMemo(() => {
    const count = getBikeCount(Number(stake) || 0);
    return ALL_BIKES.slice(0, count);
  }, [stake]);

  useEffect(() => {
    if (selectedBike && !activeBikes.find(b => b.id === selectedBike)) {
      setSelectedBike(null);
    }
  }, [activeBikes, selectedBike]);

  const startRace = async () => {
    if (!selectedBike) { gameToast.error('Select a bike!'); return; }
    const s = Number(stake);
    if (s < 0.5) { gameToast.error('Min bet ৳0.5'); return; }
    if (!placeBet(s, 'Bike Racing 3D', 'slot')) return;

    const raceBikes = [...activeBikes];
    raceBikesRef.current = raceBikes;

    let outcome: { outcome: string; maxWinAmount: number } = { outcome: 'loss', maxWinAmount: 0 };
    try {
      const data = await api.gameOutcome({ bet_amount: s, game_type: 'slot', game_id: 'bike-racing' });
      if (data) outcome = data;
    } catch {
      outcome = { outcome: 'loss', maxWinAmount: 0 };
    }

    let winIdx: number;
    const playerBikeIdx = raceBikes.findIndex(b => b.id === selectedBike);

    if (outcome.outcome === 'loss') {
      const others = raceBikes.map((_, i) => i).filter(i => i !== playerBikeIdx);
      winIdx = others[Math.floor(Math.random() * others.length)];
    } else {
      winIdx = playerBikeIdx;
    }

    const targets = raceBikes.map((_, i) => {
      if (i === winIdx) return 100;
      return 25 + Math.random() * 60;
    });
    targetPositions.current = targets;
    setWinnerIdx(winIdx);
    setPhase('racing');
    setBikePositions(raceBikes.map(() => 0));
    setLastWin(0);
    raceStartRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - raceStartRef.current;
      const progress = Math.min(elapsed / RACE_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const positions = targets.map((target, i) => {
        const noise = i === winIdx ? 0 : Math.sin(elapsed * 0.01 + i * 2) * 3;
        const pos = eased * target + noise;
        return Math.max(0, Math.min(pos, target));
      });
      setBikePositions(positions);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setBikePositions(targets);
        setTimeout(() => {
          setPhase('result');
          if (winIdx === playerBikeIdx) {
            const bike = raceBikes[winIdx];
            let winAmount = Math.round(s * bike.multiplier);
            let mult = bike.multiplier;
            if (outcome.maxWinAmount > 0 && winAmount > outcome.maxWinAmount) {
              winAmount = Math.round(outcome.maxWinAmount);
              mult = Math.round((winAmount / s) * 10) / 10;
            }
            setLastWin(winAmount);
            addWin(winAmount, 'Bike Racing 3D', 'slot', mult, s, 'bike-racing');
          } else {
            logLoss(s, 'Bike Racing 3D', 'slot', 'bike-racing');
            gameToast.error(`💨 ${raceBikes[winIdx].label} won!`);
          }
        }, 400);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const resetRace = () => {
    setPhase('pick');
    setBikePositions([]);
    setWinnerIdx(null);
    setLastWin(0);
  };

  const displayBikes = phase === 'pick' ? activeBikes : raceBikesRef.current;

  return (
    <AuthGate>
      <GameLoadingScreen show={showSplash} gameName="🏍️ Lucky Bike Racing 3D" onComplete={handleLoadingComplete} />

      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0c0c1d 0%, #1a1a2e 50%, #16213e 100%)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 pt-2">
          <button onClick={() => navigate('/slots')} className="p-2">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="font-heading font-bold text-lg" style={{ color: '#fbbf24' }}>🏍️ Lucky Bike Racing 3D</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-heading font-bold" style={{ background: '#fbbf2420', color: '#fbbf24' }}>
              {displayBikes.length} Bikes
            </span>
            <div className="gold-border rounded-full px-3 py-1">
              <span className="text-sm font-heading font-bold">৳{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Bet tier info */}
        {phase === 'pick' && (
          <div className="mx-3 mb-2 flex gap-1 overflow-x-auto no-scrollbar">
            {[
              { min: 5, bikes: 3 }, { min: 50, bikes: 5 }, { min: 100, bikes: 7 },
              { min: 200, bikes: 9 }, { min: 500, bikes: 11 }, { min: 1000, bikes: 12 },
            ].map(t => (
              <span key={t.min} className="flex-shrink-0 text-[9px] font-heading font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: Number(stake) >= t.min ? '#fbbf2425' : '#ffffff08',
                  color: Number(stake) >= t.min ? '#fbbf24' : '#666',
                }}>
                ৳{t.min}+ → {t.bikes}🏍️
              </span>
            ))}
          </div>
        )}

        {/* Race Track */}
        <div className="flex-1 mx-3 rounded-2xl overflow-hidden relative" style={{ background: '#1a1a2e', border: '2px solid #333' }}>
          {/* Asphalt texture */}
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, #222 0px, #222 18px, #282828 18px, #282828 20px)' }} />

          {/* Center dashes */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
            {Array.from({ length: ROAD_LINES }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <div className="h-0.5 rounded-full" style={{ width: phase === 'racing' ? '20px' : '12px', background: '#fbbf2430' }} />
              </div>
            ))}
          </div>

          {/* Finish line */}
          <div className="absolute right-4 top-0 bottom-0 w-1.5" style={{ background: 'repeating-linear-gradient(180deg, #fff 0px, #fff 6px, #000 6px, #000 12px)' }} />

          {/* Bikes on lanes */}
          <div className="relative z-10 flex flex-col justify-around h-full py-1 px-1" style={{ minHeight: displayBikes.length > 7 ? '340px' : undefined }}>
            {displayBikes.map((bike, i) => {
              const pos = bikePositions[i] || 0;
              const imgSize = displayBikes.length > 9 ? 36 : displayBikes.length > 7 ? 40 : 48;
              const isRacing = phase === 'racing';
              const isWinner = phase === 'result' && winnerIdx === i;
              const isSelected = selectedBike === bike.id;
              return (
                <div key={bike.id} className="flex items-center relative" style={{ height: `${Math.max(28, 340 / displayBikes.length)}px` }}>
                  {/* Lane divider */}
                  <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: '#ffffff08' }} />

                  {/* Bike with 3D image */}
                  <motion.div
                    className="flex items-center z-10"
                    style={{ position: 'relative', left: `${pos * 0.80}%` }}
                    animate={isRacing ? {
                      left: `${pos * 0.80}%`,
                      y: [0, -1.5, 1.5, -1, 1, 0],
                    } : { left: `${pos * 0.80}%` }}
                    transition={isRacing ? { duration: 0.12, repeat: Infinity, ease: 'linear' } : { duration: 0.05 }}
                  >
                    {/* Speed lines behind bike during race */}
                    {isRacing && (
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-0.5"
                        style={{ right: imgSize - 4 }}
                        animate={{ opacity: [0.15, 0.5, 0.15], scaleX: [0.6, 1, 0.6] }}
                        transition={{ duration: 0.15, repeat: Infinity }}
                      >
                        <div className="h-px rounded-full" style={{ width: '24px', background: `${bike.color}90` }} />
                        <div className="h-0.5 rounded-full" style={{ width: '18px', background: `${bike.color}60` }} />
                        <div className="h-px rounded-full" style={{ width: '30px', background: `${bike.color}70` }} />
                        <div className="h-px rounded-full" style={{ width: '14px', background: `${bike.color}40` }} />
                      </motion.div>
                    )}

                    {/* Glow behind bike */}
                    <div className="absolute -inset-1 rounded-full blur-lg" style={{ background: bike.color, opacity: isRacing ? 0.5 : 0.25 }} />
                    
                    {/* 3D Bike image — flipped to face RIGHT (racing direction) */}
                    <div className="relative flex items-center">
                      <motion.img
                        src={bike.img}
                        alt={bike.label}
                        animate={isRacing ? {
                          rotate: [-1, 2, -1.5, 1, 0],
                          scaleX: [1, 1.03, 1, 1.02, 1],
                          scaleY: [1, 1.03, 1, 1.02, 1],
                        } : { scale: isWinner ? 1.25 : 1 }}
                        transition={isRacing ? { duration: 0.25, repeat: Infinity } : {}}
                        style={{
                          width: imgSize,
                          height: imgSize,
                          objectFit: 'contain',
                          filter: `drop-shadow(0 0 ${isRacing ? '10px' : '6px'} ${bike.color}${isRacing ? 'cc' : '80'})`,
                          border: isSelected ? `2px solid ${bike.color}` : 'none',
                          borderRadius: '8px',
                        }}
                      />
                      {/* Multiplier badge */}
                      <span
                        className="absolute -bottom-1 -left-1 text-[8px] font-heading font-extrabold px-1 rounded"
                        style={{ background: bike.color, color: '#fff', lineHeight: '14px' }}
                      >
                        {bike.multiplier}x
                      </span>
                    </div>

                    {/* Exhaust smoke trail — behind the bike (left side since bike faces right) */}
                    {isRacing && (
                      <>
                        <motion.div
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ right: imgSize + 2, fontSize: '10px' }}
                          animate={{ opacity: [0.1, 0.6, 0.1], scale: [0.6, 1.3, 0.6], x: [4, -2, 4] }}
                          transition={{ duration: 0.18, repeat: Infinity }}
                        >💨</motion.div>
                        <motion.div
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ right: imgSize + 14, fontSize: '7px' }}
                          animate={{ opacity: [0, 0.35, 0], scale: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.25, repeat: Infinity, delay: 0.08 }}
                        >💨</motion.div>
                      </>
                    )}
                  </motion.div>

                  {/* Winner flag */}
                  {isWinner && (
                    <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1.3, rotate: 0 }} className="absolute right-2 text-xl z-20">🏁</motion.span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Result overlay */}
          <AnimatePresence>
            {phase === 'result' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-20"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
              >
                {lastWin > 0 ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                    <p className="text-4xl mb-2">🏆</p>
                    <p className="text-2xl font-heading font-extrabold" style={{ color: '#22c55e' }}>WIN!</p>
                    <p className="text-3xl font-heading font-bold" style={{ color: '#fbbf24' }}>৳{lastWin.toLocaleString()}</p>
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                    <p className="text-4xl mb-2">💨</p>
                    <p className="text-xl font-heading font-bold text-red-400">Your bike lost!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {winnerIdx !== null && `${raceBikesRef.current[winnerIdx]?.label} won`}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-3 space-y-2">
          {phase === 'pick' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Bet Amount (৳)</label>
                <input
                  type="number" value={stake} onChange={e => setStake(e.target.value)}
                  className="w-full bg-secondary rounded-lg px-3 py-2.5 text-foreground font-heading outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Bike picker with 3D images */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-heading">🏍️ Select bike ({activeBikes.length}):</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {activeBikes.map(bike => (
                    <button
                      key={bike.id}
                      onClick={() => setSelectedBike(bike.id)}
                      className="py-1.5 px-1 rounded-lg text-center transition-all font-heading font-bold relative overflow-hidden"
                      style={{
                        background: selectedBike === bike.id ? `linear-gradient(135deg, ${bike.color}40, ${bike.color}20)` : '#1e1e2e',
                        border: selectedBike === bike.id ? `2px solid ${bike.color}` : `1px solid ${bike.color}30`,
                        transform: selectedBike === bike.id ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <img src={bike.img} alt={bike.label} className="w-10 h-10 mx-auto object-contain" style={{ filter: `drop-shadow(0 0 4px ${bike.color}60)` }} />
                      <div className="text-[10px] mt-0.5 font-extrabold" style={{ color: bike.color }}>{bike.multiplier}x</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startRace} disabled={!selectedBike}
                className="w-full py-3.5 rounded-xl font-heading font-bold text-lg active:scale-95 transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}
              >
                🏁 START RACE
              </button>
            </>
          )}

          {phase === 'racing' && (
            <div className="text-center py-3">
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}
                className="text-lg font-heading font-bold" style={{ color: '#fbbf24' }}>
                🏍️ Racing...
              </motion.p>
            </div>
          )}

          {phase === 'result' && (
            <button onClick={resetRace}
              className="w-full py-3.5 rounded-xl font-heading font-bold text-lg active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}>
              🔄 Play Again
            </button>
          )}
        </div>
      </div>
    </AuthGate>
  );
};

export default BikeRacingGame;
