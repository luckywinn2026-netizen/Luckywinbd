import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api';

const GROWTH_RATE = 0.00006;
const COUNTDOWN_MS = 10000;
const PAUSE_MS = 3000;

export type CrashGameState = 'waiting' | 'flying' | 'crashed';

export function useCrashRound(gameId: string, initialHistory?: number[]) {
  const [gameState, setGameState] = useState<CrashGameState>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(10);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>(initialHistory || [2.34, 1.12, 5.67, 1.89, 3.45]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [liveBets, setLiveBets] = useState<api.CrashLiveBet[]>([]);

  const multiplierRef = useRef(1.0);
  const gameStateRef = useRef<CrashGameState>('waiting');
  const startTimeRef = useRef(0);
  const roundIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundStateRef = useRef<api.CrashStateResponse['round'] | null>(null);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const applyRound = useCallback((rd: api.CrashStateResponse['round']) => {
    roundStateRef.current = rd;
    const clientNow = Date.now();
    const offset = Number(rd.server_now_ms) - clientNow;
    const flyStartLocal = Number(rd.server_start_ms) - offset + COUNTDOWN_MS;

    startTimeRef.current = flyStartLocal;
    setCrashPoint(rd.phase === 'crashed' && rd.crash_point !== null ? Number(rd.crash_point) : null);

    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }

    tickIntervalRef.current = setInterval(() => {
      const activeRound = roundStateRef.current;
      if (!activeRound) {
        return;
      }

      const now = Date.now();
      const serverNow = now + offset;
      const liveFlyStartMs = Number(activeRound.server_start_ms) + COUNTDOWN_MS;

      if (activeRound.phase === 'crashed') {
        const finalM = Number(activeRound.crash_point || activeRound.current_multiplier || 1);
        setCountdown(0);
        setElapsedTime(Number(activeRound.elapsed_ms || 0));
        setCrashPoint(finalM);
        multiplierRef.current = finalM;
        setMultiplier(finalM);
        if (gameStateRef.current !== 'crashed') {
          setGameState('crashed');
          gameStateRef.current = 'crashed';
        }
        return;
      }

      if (serverNow < liveFlyStartMs) {
        const remaining = Math.max(1, Math.ceil((flyStartLocal - now) / 1000));
        setCountdown(remaining);
        if (gameStateRef.current !== 'waiting') {
          setGameState('waiting');
          gameStateRef.current = 'waiting';
          setMultiplier(1.0);
          multiplierRef.current = 1.0;
          setElapsedTime(0);
        }
      } else {
        if (gameStateRef.current !== 'flying') {
          setGameState('flying');
          gameStateRef.current = 'flying';
        }
        const flyElapsed = Math.max(0, now - flyStartLocal);
        const m = Math.floor(Math.pow(Math.E, GROWTH_RATE * flyElapsed) * 100) / 100;
        multiplierRef.current = m;
        setMultiplier(m);
        setElapsedTime(flyElapsed);
        setCountdown(0);
      }
    }, 30);
  }, []);

  const refreshRound = useCallback(async () => {
    try {
      const data = await api.getCrashState({ game_id: gameId });
      if (!mountedRef.current || !data?.round) {
        return;
      }

      const nextHistory = data.history.map((row) => Math.floor(Number(row.crash_point) * 100) / 100);
      if (nextHistory.length > 0) {
        setHistory(nextHistory);
      }
      setLiveBets((data.liveBets || []).filter((bet) => bet.status !== 'cancelled'));

      const rd = data.round;
      roundIdRef.current = rd.id;
      setRoundId(rd.id);
      applyRound(rd);
    } catch (e) {
      console.error('Crash round sync error:', e);
    }
  }, [applyRound, gameId]);

  useEffect(() => {
    let cancelled = false;
    refreshRound();
    const pollInterval = setInterval(() => {
      if (!cancelled) {
        refreshRound();
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [gameId, refreshRound]);

  return {
    gameState, multiplier, multiplierRef, countdown, crashPoint,
    history, setHistory, elapsedTime, startTimeRef, gameStateRef,
    roundId, liveBets, refreshRound,
  };
}
