import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import GameLoadingScreen from '@/components/GameLoadingScreen';
import LudoBoard from './LudoBoard';
import { playClick, playDiceRoll, playTokenMove, playCapture, playWin, playLose } from '@/games/ludo/ludo-king/LudoSoundEngine';
import * as api from '@/lib/api';

const MATCH_SCROLL_NAMES = [
  'Rahat_99', 'ShakilPro', 'Tanvir★', 'MdArif_21', 'Nahid77', 'JoyBD', 'Sakib_King', 'RakibStar',
];

const TOKEN_PRESETS = {
  red: { label: 'Red', emoji: '🔴', gradient: 'radial-gradient(circle at 35% 30%, #ff8a8a, #e53e3e 50%, #9b1c1c 100%)', border: '#991b1b' },
  blue: { label: 'Blue', emoji: '🔵', gradient: 'radial-gradient(circle at 35% 30%, #63b3ed, #3182ce 50%, #1a365d 100%)', border: '#1e3a5f' },
  green: { label: 'Green', emoji: '🟢', gradient: 'radial-gradient(circle at 35% 30%, #68d391, #38a169 50%, #1a5632 100%)', border: '#1a5632' },
  yellow: { label: 'Yellow', emoji: '🟡', gradient: 'radial-gradient(circle at 35% 30%, #fbd38d, #d69e2e 50%, #7b5e10 100%)', border: '#7b5e10' },
};
type TokenColorKey = keyof typeof TOKEN_PRESETS;

const DICE_PRESETS = {
  red: { label: 'Red', emoji: '🔴', colors: ['#e52d27','#b31217','#d42a24','#a01015','#d02822','#9e0e12','#e83530','#b51519','#f04038','#c01818','#c22420','#8e0c10'], ring: 'ring-red-500', bg: 'bg-red-500/20', text: 'text-red-400' },
  blue: { label: 'Blue', emoji: '🔵', colors: ['#3182ce','#1a56a0','#2b6cb0','#164e8a','#2563a0','#134080','#3b82d0','#1d5ea0','#4090e0','#1a6cc0','#2060b0','#103870'], ring: 'ring-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  green: { label: 'Green', emoji: '🟢', colors: ['#38a169','#1a7a40','#2f8a5a','#166a34','#287a50','#125a2a','#40b070','#1e8a48','#48c078','#1a9a50','#307a48','#104a20'], ring: 'ring-green-500', bg: 'bg-green-500/20', text: 'text-green-400' },
  yellow: { label: 'Yellow', emoji: '🟡', colors: ['#d69e2e','#a07a1a','#c09020','#8a6a14','#b08018','#7a5a0e','#e0a838','#b08a20','#e8b840','#c09a28','#a88020','#6a4a08'], ring: 'ring-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  white: { label: 'White', emoji: '⚪', colors: ['#f0f0f0','#d4d4d4','#e8e8e8','#c8c8c8','#e0e0e0','#c0c0c0','#f4f4f4','#d8d8d8','#f8f8f8','#e0e0e0','#d0d0d0','#b8b8b8'], ring: 'ring-gray-300', bg: 'bg-white/20', text: 'text-gray-300' },
};
type DiceColorKey = keyof typeof DICE_PRESETS;

const LEVELS = [
  { level: 1, bet: 10 }, { level: 2, bet: 20 }, { level: 3, bet: 50 },
  { level: 4, bet: 100 }, { level: 5, bet: 200 }, { level: 6, bet: 300 },
  { level: 7, bet: 500 }, { level: 8, bet: 700 }, { level: 9, bet: 900 },
  { level: 10, bet: 1000 },
];
const WIN_MULTI = 1.8;
const MAX_PATH_POS = 51; // Indian Ludo: 52 steps on main path (0-51)
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const TURN_WINDOW_SECONDS = 7;
const TOKEN_STEP_MS = 110;

const PATH: [number, number][] = [
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
];
const HOME_START = 52; // First home cell (after 52 main path steps)
const HOME_END = 57;   // Last home cell before center
const FINAL_HOME = 58; // Center
const BLUE_HOME: [number, number][] = [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]];
const GREEN_HOME: [number, number][] = [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]];
const BLUE_BASE: [number, number][] = [[11,11],[11,13],[13,11],[13,13]];
const GREEN_BASE: [number, number][] = [[2,2],[2,4],[4,2],[4,4]];
type TPos = number;
type Player = 'blue' | 'green';
type ReplayBoardState = {
  blue: TPos[];
  green: TPos[];
  turn: Player;
  dice: number;
  rolled: boolean;
  movable: number[];
  winner: Player | null;
  phase: 'playing' | 'result';
};
const toAbs = (rel: number, p: Player) => (rel + (p === 'blue' ? 39 : 13)) % 52;
const getCoords = (pos: TPos, player: Player, idx: number): [number, number] => {
  if (pos === -1) return player === 'blue' ? BLUE_BASE[idx] : GREEN_BASE[idx];
  if (pos >= HOME_START && pos <= HOME_END) return player === 'blue' ? BLUE_HOME[pos - HOME_START] : GREEN_HOME[pos - HOME_START];
  if (pos === FINAL_HOME) return [7, 7];
  return PATH[toAbs(pos, player)];
};

const BOARD_INSET_X = 0.5;
const BOARD_INSET_Y = 0.5;
const BOARD_SCALE_X = 100 - BOARD_INSET_X * 2;
const BOARD_SCALE_Y = 100 - BOARD_INSET_Y * 2;
const TOKEN_SIZE = 5.6;
const TOKEN_HALF = TOKEN_SIZE / 2;
const tokenPosX = (gridVal: number) => BOARD_INSET_X + ((gridVal + 0.5) / 15) * BOARD_SCALE_X - TOKEN_HALF;
const tokenPosY = (gridVal: number) => BOARD_INSET_Y + ((gridVal + 0.5) / 15) * BOARD_SCALE_Y - TOKEN_HALF;

const cloneReplayState = (state: ReplayBoardState): ReplayBoardState => ({
  ...state,
  blue: [...state.blue],
  green: [...state.green],
  movable: [...state.movable],
});

const applyReplayMove = (state: ReplayBoardState, player: Player, tokenIdx: number, diceVal: number): ReplayBoardState => {
  const next = cloneReplayState(state);
  const myTokens = player === 'blue' ? [...next.blue] : [...next.green];
  const oppTokens = player === 'blue' ? [...next.green] : [...next.blue];

  const startPos = myTokens[tokenIdx];
  if (startPos === -1) {
    myTokens[tokenIdx] = 0;
  } else {
    myTokens[tokenIdx] = startPos + diceVal;
  }

  const movedPos = myTokens[tokenIdx];
  let captured = false;
  let extraTurn = false;

  if (movedPos >= 0 && movedPos <= MAX_PATH_POS) {
    const absPos = toAbs(movedPos, player);
    if (!SAFE_ABS.has(absPos)) {
      const oppPlayer = player === 'blue' ? 'green' : 'blue';
      const oppIndicesOnSquare = oppTokens
        .map((pos, idx) => (pos >= 0 && pos <= MAX_PATH_POS && toAbs(pos, oppPlayer) === absPos ? idx : -1))
        .filter((idx) => idx !== -1);

      if (oppIndicesOnSquare.length === 1) {
        oppTokens[oppIndicesOnSquare[0]] = -1;
        captured = true;
        extraTurn = true;
      }
    }
  }

  if (movedPos === FINAL_HOME) extraTurn = true;
  if (diceVal === 6 && !captured) extraTurn = true;

  if (player === 'blue') {
    next.blue = myTokens;
    next.green = oppTokens;
  } else {
    next.green = myTokens;
    next.blue = oppTokens;
  }

  next.dice = diceVal;
  next.rolled = false;
  next.movable = [];

  if (myTokens.every((token) => token === FINAL_HOME)) {
    next.winner = player;
    next.phase = 'result';
    next.turn = player;
    return next;
  }

  next.turn = extraTurn ? player : player === 'blue' ? 'green' : 'blue';
  return next;
};

const FACE_DOTS: Record<number, [number, number][]> = {
  1: [[1,1]], 2: [[0,2],[2,0]], 3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]], 5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
};

const DiceFace3D = ({ val, style, className = '' }: { val: number; style: React.CSSProperties; className?: string }) => (
  <div className={`absolute w-full h-full rounded-[6px] grid grid-cols-3 grid-rows-3 p-2 ${className}`} style={{ backfaceVisibility: 'hidden', ...style }}>
    {Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      const has = (FACE_DOTS[val] || []).some(([dr, dc]) => dr === r && dc === c);
      return (
        <div key={i} className="flex items-center justify-center">
          {has && <div className="w-[10px] h-[10px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #ffffff, #d0d0d0)', boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.25)' }} />}
        </div>
      );
    })}
  </div>
);

const opposite = (v: number) => 7 - v;
const rightFace = (v: number) => [0, 3, 1, 5, 2, 6, 4][v] || 1;
const topFace = (v: number) => [0, 2, 1, 4, 6, 5, 3][v] || 1;

const Dice3D = ({ value, rolling, onClick, disabled, diceColor = 'blue' }: { value: number; rolling: boolean; onClick?: () => void; disabled?: boolean; diceColor?: DiceColorKey }) => {
  const s = 56;
  const half = s / 2;
  const d = DICE_PRESETS[diceColor].colors;
  return (
    <div onClick={disabled ? undefined : onClick} className={disabled ? 'opacity-60 cursor-default' : 'cursor-pointer active:scale-95 transition-transform'} style={{ perspective: '500px', width: s, height: s }}>
      <motion.div
        animate={rolling ? { rotateX: [0, 360, 720, 1080], rotateY: [0, 270, 540, 810], rotateZ: [0, 90, 180, 270] } : { rotateX: 0, rotateY: 0, rotateZ: 0 }}
        transition={{ duration: 0.6, repeat: rolling ? Infinity : 0, ease: 'linear' }}
        style={{ transformStyle: 'preserve-3d', width: s, height: s, position: 'relative', pointerEvents: 'none' }}
      >
        <DiceFace3D val={value} style={{ background: `linear-gradient(145deg, ${d[0]} 0%, ${d[1]} 100%)`, transform: `translateZ(${half}px)`, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }} />
        <DiceFace3D val={opposite(value)} style={{ background: `linear-gradient(145deg, ${d[2]} 0%, ${d[3]} 100%)`, transform: `rotateY(180deg) translateZ(${half}px)` }} />
        <DiceFace3D val={rightFace(value)} style={{ background: `linear-gradient(145deg, ${d[4]} 0%, ${d[5]} 100%)`, transform: `rotateY(90deg) translateZ(${half}px)` }} />
        <DiceFace3D val={opposite(rightFace(value))} style={{ background: `linear-gradient(145deg, ${d[6]} 0%, ${d[7]} 100%)`, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
        <DiceFace3D val={topFace(value)} style={{ background: `linear-gradient(145deg, ${d[8]} 0%, ${d[9]} 100%)`, transform: `rotateX(90deg) translateZ(${half}px)` }} />
        <DiceFace3D val={opposite(topFace(value))} style={{ background: `linear-gradient(145deg, ${d[10]} 0%, ${d[11]} 100%)`, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
      </motion.div>
      <div className="w-10 h-2 mx-auto mt-2 bg-black/25 rounded-full blur-md" />
    </div>
  );
};

const DEFAULT_AVATAR = 'https://api.dicebear.com/9.x/adventurer/svg?seed=Player';

const MatchmakingScreen = ({
  levelIdx,
  userProfile,
  startMatch,
  onMatchFound,
  onReady,
  onBack,
}: {
  levelIdx: number;
  userProfile: { name: string; avatar: string; level?: number; wins?: number };
  startMatch: (li: number) => Promise<api.LudoMatchResponse | null>;
  onMatchFound: (match: api.LudoMatchResponse) => void;
  onReady: () => void;
  onBack: () => void;
}) => {
  const [searchPhase, setSearchPhase] = useState<'searching' | 'found' | 'ready'>('searching');
  const [opponent, setOpponent] = useState<{ name: string; avatar: string; level: number; wins: number } | null>(null);
  const [fakePlayers, setFakePlayers] = useState(640);
  const [dots, setDots] = useState('');
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    const dotTimer = setInterval(() => setDots((prev) => prev.length >= 3 ? '' : `${prev}.`), 400);
    const countTimer = setInterval(() => setFakePlayers((prev) => prev + Math.floor(Math.random() * 12) - 4), 800);
    const foundTimer = setTimeout(async () => {
      setMatchError(null);
      try {
        const match = await startMatch(levelIdx);
        if (match?.opponent) {
          setOpponent(match.opponent);
          setSearchPhase('found');
          onMatchFound(match);
        } else {
          setMatchError('Failed to find match');
        }
      } catch (e) {
        setMatchError((e as Error).message || 'Failed to start match');
      }
    }, 1800);
    return () => {
      clearInterval(dotTimer);
      clearInterval(countTimer);
      clearTimeout(foundTimer);
    };
  }, [levelIdx, startMatch, onMatchFound]);

  useEffect(() => {
    if (searchPhase !== 'found') return;
    const readyTimer = setTimeout(() => {
      setSearchPhase('ready');
      setTimeout(onReady, 1000);
    }, 2000);
    return () => clearTimeout(readyTimer);
  }, [searchPhase, onReady]);

  return (
    <div className="min-h-screen navy-gradient flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full text-center">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-medium">{fakePlayers} players online</span>
          </div>
        </div>
        <div className="relative mb-8 flex items-center justify-center" style={{ height: 120 }}>
          {searchPhase === 'searching' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative z-10" style={{ background: 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)/0.5))' }}>
              🔍
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 rounded-full overflow-hidden relative z-10 border-2 border-primary" style={{ boxShadow: '0 0 30px hsl(var(--primary)/0.4)' }}>
              <img src={opponent?.avatar || DEFAULT_AVATAR} alt={opponent?.name || 'Opponent'} className="w-full h-full object-cover" />
            </motion.div>
          )}
        </div>
        <AnimatePresence mode="wait">
          {searchPhase === 'searching' && (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-xl font-bold text-foreground mb-2">Finding opponent{dots}</h2>
              <p className="text-muted-foreground text-sm">Server is preparing your match</p>
              {matchError && (
                <div className="mt-2">
                  <p className="text-destructive text-sm">{matchError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={onBack}>
                    Back
                  </Button>
                </div>
              )}
              <div className="mt-4 overflow-hidden h-8 relative">
                <motion.div animate={{ y: [0, -16, -32, -48, -64, -80] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute inset-x-0">
                  {MATCH_SCROLL_NAMES.map((name, i) => <p key={i} className="text-muted-foreground/60 text-xs h-4 leading-4">{name}</p>)}
                </motion.div>
              </div>
            </motion.div>
          )}
          {searchPhase === 'found' && opponent && (
            <motion.div key="found" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <h2 className="text-xl font-bold text-green-400 mb-2">✅ Match found!</h2>
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="bg-card/50 border border-border rounded-xl p-4 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2 border-2 border-primary">
                    <img src={userProfile.avatar || DEFAULT_AVATAR} alt={userProfile.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-foreground font-bold text-sm truncate">{userProfile.name}</p>
                  <p className="text-primary text-xs font-semibold">You</p>
                </div>
                <span className="text-2xl">VS</span>
                <div className="bg-card/50 border border-border rounded-xl p-4 flex-1 min-w-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2 border-2 border-primary">
                    <img src={opponent.avatar} alt={opponent.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-foreground font-bold text-sm truncate">{opponent.name}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>🏅 Level {opponent.level}</span>
                    <span>🏆 {opponent.wins}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {searchPhase === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }}>
              <h2 className="text-2xl font-bold gold-text mb-2">🎲 Game starting!</h2>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-4xl mt-4">⚔️</motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const LudoKingGame = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance } = useWallet();
  const { profile } = useAuth();
  const [showLoading, setShowLoading] = useState(true);
  const [phase, setPhase] = useState<'levels' | 'searching' | 'playing' | 'result'>('levels');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [betAmt, setBetAmt] = useState(0);
  const [currentOpponent, setCurrentOpponent] = useState<{ name: string; avatar: string; level: number; wins: number }>({ name: 'Opponent', avatar: '', level: 1, wins: 0 });
  const [blue, setBlue] = useState<TPos[]>([-1, -1, -1, -1]);
  const [green, setGreen] = useState<TPos[]>([-1, -1, -1, -1]);
  const [displayBlue, setDisplayBlue] = useState<TPos[]>([-1, -1, -1, -1]);
  const [displayGreen, setDisplayGreen] = useState<TPos[]>([-1, -1, -1, -1]);
  const [turn, setTurn] = useState<Player>('blue');
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [aiRolling, setAiRolling] = useState(false);
  const [aiPhase, setAiPhase] = useState<'idle' | 'rolling' | 'thinking' | 'moving'>('idle');
  const [aiDisplayDice, setAiDisplayDice] = useState(1);
  const [aiPlaybackActive, setAiPlaybackActive] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [movable, setMovable] = useState<number[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [specialEffect, setSpecialEffect] = useState<'capture' | 'home' | 'triple6' | 'win' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [turnTimer, setTurnTimer] = useState(5);
  const [previousLevelIdx, setPreviousLevelIdx] = useState<number>(() => {
    const saved = localStorage.getItem('ludo_prev_level');
    return saved ? Number(saved) : -1;
  });
  const [userTokenColor, setUserTokenColor] = useState<TokenColorKey>(() => (localStorage.getItem('ludo_token_color') as TokenColorKey) || 'blue');
  const [userDiceColor, setUserDiceColor] = useState<DiceColorKey>(() => (localStorage.getItem('ludo_dice_color') as DiceColorKey) || 'blue');
  const [oppTokenColor, setOppTokenColor] = useState<TokenColorKey>(() => (localStorage.getItem('ludo_opp_token_color') as TokenColorKey) || 'green');
  const [oppDiceColor, setOppDiceColor] = useState<DiceColorKey>(() => (localStorage.getItem('ludo_opp_dice_color') as DiceColorKey) || 'green');
  const [currentMatch, setCurrentMatch] = useState<api.LudoMatchResponse>(null);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiPlaybackTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tokenAnimationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoMoveKeyRef = useRef<string>('');
  const lastActionRef = useRef<string>('');
  const suppressActionSignatureRef = useRef<string>('');
  const winnerRef = useRef<Player | null>(null);
  const pendingActionRef = useRef(false);
  const prevBlueRef = useRef<TPos[]>([-1, -1, -1, -1]);
  const prevGreenRef = useRef<TPos[]>([-1, -1, -1, -1]);

  const userTokenTheme = TOKEN_PRESETS[userTokenColor];
  const oppTokenTheme = TOKEN_PRESETS[oppTokenColor];
  const userDiceTheme = DICE_PRESETS[userDiceColor];
  const oppDiceTheme = DICE_PRESETS[oppDiceColor];

  useEffect(() => { localStorage.setItem('ludo_token_color', userTokenColor); }, [userTokenColor]);
  useEffect(() => { localStorage.setItem('ludo_dice_color', userDiceColor); }, [userDiceColor]);
  useEffect(() => { localStorage.setItem('ludo_opp_token_color', oppTokenColor); }, [oppTokenColor]);
  useEffect(() => { localStorage.setItem('ludo_opp_dice_color', oppDiceColor); }, [oppDiceColor]);

  useActivePlayer('ludo-king', 'Lucky Ludo King', 'ludo', betAmt);

  const clearAiPlayback = useCallback(() => {
    aiPlaybackTimersRef.current.forEach((timer) => clearTimeout(timer));
    aiPlaybackTimersRef.current = [];
    setAiRolling(false);
    setAiPhase('idle');
    setAiPlaybackActive(false);
  }, []);

  const clearTokenAnimations = useCallback(() => {
    tokenAnimationTimersRef.current.forEach((timer) => clearTimeout(timer));
    tokenAnimationTimersRef.current = [];
  }, []);

  const clearAutoMove = useCallback(() => {
    if (autoMoveTimerRef.current) {
      clearTimeout(autoMoveTimerRef.current);
      autoMoveTimerRef.current = null;
    }
  }, []);

  const syncDisplayPositions = useCallback((nextBlue: TPos[], nextGreen: TPos[]) => {
    clearTokenAnimations();
    setDisplayBlue([...nextBlue]);
    setDisplayGreen([...nextGreen]);
    prevBlueRef.current = [...nextBlue];
    prevGreenRef.current = [...nextGreen];
  }, [clearTokenAnimations]);

  const setDisplayToken = useCallback((player: Player, tokenIdx: number, pos: TPos) => {
    if (player === 'blue') {
      setDisplayBlue((prev) => {
        const next = [...prev];
        next[tokenIdx] = pos;
        return next;
      });
      return;
    }
    setDisplayGreen((prev) => {
      const next = [...prev];
      next[tokenIdx] = pos;
      return next;
    });
  }, []);

  const buildTokenPath = useCallback((from: TPos, to: TPos) => {
    if (from === to) return [];
    if (from === -1 && to === 0) return [0];
    if (to === -1 || to < from) return [to];
    const steps: TPos[] = [];
    for (let pos = from + 1; pos <= to; pos += 1) {
      steps.push(pos);
    }
    return steps;
  }, []);

  const animateTokenMove = useCallback((player: Player, tokenIdx: number, from: TPos, to: TPos) => {
    const path = buildTokenPath(from, to);
    if (!path.length) {
      setDisplayToken(player, tokenIdx, to);
      return;
    }
    path.forEach((pos, idx) => {
      tokenAnimationTimersRef.current.push(setTimeout(() => {
        setDisplayToken(player, tokenIdx, pos);
      }, idx * TOKEN_STEP_MS));
    });
  }, [buildTokenPath, setDisplayToken]);

  const estimateBoardTransitionMs = useCallback((fromState: ReplayBoardState, toState: ReplayBoardState) => {
    const blueSteps = toState.blue.map((pos, idx) => buildTokenPath(fromState.blue[idx], pos).length);
    const greenSteps = toState.green.map((pos, idx) => buildTokenPath(fromState.green[idx], pos).length);
    const maxSteps = Math.max(0, ...blueSteps, ...greenSteps);
    return maxSteps > 0 ? maxSteps * TOKEN_STEP_MS + 220 : 300;
  }, [buildTokenPath]);

  const applyBoardState = useCallback((state: ReplayBoardState, forcedPhase?: 'playing' | 'result') => {
    setBlue(state.blue);
    setGreen(state.green);
    setTurn(state.turn);
    setDice(state.dice);
    setRolled(state.rolled);
    setMovable(state.movable || []);
    setWinner(state.winner);
    setPhase(forcedPhase || state.phase);
  }, []);

  const captureBoardState = useCallback((): ReplayBoardState => ({
    blue: [...blue],
    green: [...green],
    turn,
    dice,
    rolled,
    movable: [...movable],
    winner,
    phase: phase === 'result' ? 'result' : 'playing',
  }), [blue, green, turn, dice, rolled, movable, winner, phase]);

  const hydrateMatch = useCallback((match: api.LudoMatchResponse, forcedPhase?: 'levels' | 'searching' | 'playing' | 'result') => {
    setCurrentMatch(match);
    if (!match) {
      clearAiPlayback();
      winnerRef.current = null;
      lastActionRef.current = '';
      setMatchId(null);
      setWinner(null);
      setBlue([-1, -1, -1, -1]);
      setGreen([-1, -1, -1, -1]);
      syncDisplayPositions([-1, -1, -1, -1], [-1, -1, -1, -1]);
      setMovable([]);
      setRolled(false);
      setSpecialEffect(null);
      setPhase(forcedPhase || 'levels');
      return;
    }

    const state = match.state;
    if (!state) return;
    setMatchId(match.id);
    setLevelIdx(match.levelIdx);
    setBetAmt(match.betAmount);
    setCurrentOpponent(match.opponent || { name: 'Opponent', avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=AI', level: 1, wins: 0 });
    applyBoardState({
      blue: [...(state.blue ?? [-1, -1, -1, -1])],
      green: [...(state.green ?? [-1, -1, -1, -1])],
      turn: state.turn ?? 'blue',
      dice: state.dice ?? 1,
      rolled: state.rolled ?? false,
      movable: [...(state.movable ?? [])],
      winner: state.winner ?? null,
      phase: state.phase === 'result' ? 'result' : 'playing',
    }, forcedPhase === 'playing' || forcedPhase === 'result' ? forcedPhase : undefined);
    if (!state.winner) {
      winnerRef.current = null;
    }
    if (forcedPhase) {
      setPhase(forcedPhase);
    } else {
      setPhase(state.phase === 'result' ? 'result' : 'playing');
    }
  }, [applyBoardState, clearAiPlayback, syncDisplayPositions]);

  useEffect(() => {
    const prevBlue = prevBlueRef.current;
    const prevGreen = prevGreenRef.current;
    const blueChanged = blue.some((pos, idx) => pos !== prevBlue[idx]);
    const greenChanged = green.some((pos, idx) => pos !== prevGreen[idx]);

    if (!blueChanged && !greenChanged) {
      return;
    }

    clearTokenAnimations();

    blue.forEach((pos, idx) => {
      if (pos !== prevBlue[idx]) {
        animateTokenMove('blue', idx, prevBlue[idx], pos);
      }
    });

    green.forEach((pos, idx) => {
      if (pos !== prevGreen[idx]) {
        animateTokenMove('green', idx, prevGreen[idx], pos);
      }
    });

    prevBlueRef.current = [...blue];
    prevGreenRef.current = [...green];
  }, [blue, green, animateTokenMove, clearTokenAnimations]);

  const playAiTurns = useCallback((match: api.LudoMatchResponse, initialState: ReplayBoardState, initialDelay = 300) => {
    const aiTurns = match?.state.aiTurns || [];
    clearAiPlayback();

    if (!aiTurns.length) {
      hydrateMatch(match, match?.state.phase === 'result' ? 'result' : 'playing');
      return;
    }

    let replayState = cloneReplayState(initialState);
    applyBoardState(replayState, 'playing');
    setAiPlaybackActive(true);
    setPhase('playing');

    let cursor = initialDelay;
    aiTurns.forEach((turnData, idx) => {
      const thinkMs = 240 + ((turnData.dice + idx) % 3) * 120;
      const rollMs = 760 + (((turnData.tokenIdx ?? idx) + turnData.dice) % 2) * 140;
      const settleMs = 420 + ((idx + turnData.dice) % 2) * 180;
      const actionMs = turnData.skipped ? 220 : 180;
      const startAt = cursor + thinkMs;
      aiPlaybackTimersRef.current.push(setTimeout(() => {
        playDiceRoll();
        setAiPhase('rolling');
        replayState = {
          ...replayState,
          turn: 'green',
          dice: turnData.dice,
          rolled: false,
          movable: [],
        };
        applyBoardState(replayState, 'playing');
        setAiRolling(true);
        setAiDisplayDice(turnData.dice);
      }, startAt));

      aiPlaybackTimersRef.current.push(setTimeout(() => {
        setAiRolling(false);
        setAiPhase('thinking');
        setAiDisplayDice(turnData.dice);
      }, startAt + rollMs));

      aiPlaybackTimersRef.current.push(setTimeout(() => {
        setAiPhase(turnData.skipped ? 'thinking' : 'moving');
        if (!turnData.skipped && turnData.tokenIdx !== null) {
          replayState = applyReplayMove(replayState, 'green', turnData.tokenIdx, turnData.dice);
          playTokenMove();
        } else {
          replayState = {
            ...replayState,
            turn: 'blue',
            rolled: false,
            movable: [],
            dice: turnData.dice,
          };
        }
        applyBoardState(replayState, 'playing');
      }, startAt + rollMs + settleMs + actionMs));

      aiPlaybackTimersRef.current.push(setTimeout(() => {
        setAiPhase('thinking');
      }, startAt + rollMs + settleMs + actionMs + 40));

      cursor = startAt + rollMs + settleMs + actionMs + 220;
    });

    const finishSignature = match.state.lastAction
      ? `${match.state.lastAction.player}-${match.state.lastAction.tokenIdx}-${match.state.lastAction.diceVal}-${match.state.lastAction.captured}-${match.state.lastAction.reachedHome}`
      : '';
    const finishAt = cursor + 180;
    aiPlaybackTimersRef.current.push(setTimeout(() => {
      suppressActionSignatureRef.current = finishSignature;
      hydrateMatch(match, match.state.phase === 'result' ? 'result' : 'playing');
      clearAiPlayback();
    }, finishAt));
  }, [applyBoardState, clearAiPlayback, hydrateMatch]);

  const applyMatch = useCallback((match: api.LudoMatchResponse | null, forcedPhase?: 'levels' | 'searching' | 'playing' | 'result', replaySeed?: ReplayBoardState | null, replayDelay?: number) => {
    if (!match) return;
    const needsAiReplay = Boolean(replaySeed && match?.state?.aiTurns?.length);
    if (needsAiReplay && replaySeed) {
      playAiTurns(match, replaySeed, replayDelay);
      return;
    }
    hydrateMatch(match, forcedPhase);
  }, [hydrateMatch, playAiTurns]);

  const fetchExistingMatch = useCallback(async () => {
    try {
      const match = await api.getLudoMatchState();
      if (match) {
        hydrateMatch(match, match.state.phase === 'result' ? 'result' : 'playing');
      }
    } catch {
      // ignore
    }
  }, [hydrateMatch]);

  useEffect(() => {
    fetchExistingMatch().finally(() => setShowLoading(false));
  }, [fetchExistingMatch]);

  useEffect(() => {
    const action = currentMatch?.state.lastAction;
    const signature = action ? `${action.player}-${action.tokenIdx}-${action.diceVal}-${action.captured}-${action.reachedHome}` : '';
    if (signature && signature === suppressActionSignatureRef.current) {
      suppressActionSignatureRef.current = '';
      lastActionRef.current = signature;
      return;
    }
    if (signature && signature !== lastActionRef.current) {
      lastActionRef.current = signature;
      playTokenMove();
      if (action?.captured) {
        playCapture();
        setSpecialEffect('capture');
        toast('🎯 Captured! Extra turn!', { duration: 1500 });
        setTimeout(() => setSpecialEffect(null), 1500);
      } else if (action?.reachedHome) {
        setSpecialEffect('home');
        toast('🏠 Token home! Extra turn!', { duration: 1500 });
        setTimeout(() => setSpecialEffect(null), 1500);
      }
    }
  }, [currentMatch?.state.lastAction]);

  useEffect(() => {
    if (winner && winner !== winnerRef.current) {
      winnerRef.current = winner;
      if (winner === 'blue') {
        playWin();
        setSpecialEffect('win');
        toast.success(`🏆 You won ৳${(currentMatch?.state.winAmount || betAmt * WIN_MULTI).toFixed(0)}!`);
      } else {
        playLose();
        toast.error('😔 You lost!');
      }
      refreshBalance();
      setTimeout(() => setSpecialEffect(null), 2000);
    }
  }, [winner, currentMatch?.state.winAmount, betAmt, refreshBalance]);

  useEffect(() => {
    if (turn === 'blue' && phase === 'playing' && !winner && !rolling && !aiPlaybackActive && matchId && !pendingActionRef.current) {
      setTurnTimer(TURN_WINDOW_SECONDS);
      turnTimerRef.current = setInterval(() => {
        setTurnTimer((prev) => {
          if (prev <= 1) {
            if (turnTimerRef.current) clearInterval(turnTimerRef.current);
            const replaySeed: ReplayBoardState = rolled
              ? { ...captureBoardState(), rolled: false, movable: [], turn: 'green', phase: 'playing' }
              : { ...captureBoardState(), turn: 'green', rolled: false, movable: [], phase: 'playing' };
            toast(rolled ? '⏰ Move time over! Turn passed.' : '⏰ Roll time over! Turn passed.', { duration: 1500 });
            api.passLudoTurn({ matchId }).then((match) => applyMatch(match ?? null, undefined, replaySeed)).catch((err) => {
              console.error('Pass turn failed:', err);
              toast.error('Turn pass failed. Please try again.');
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
    }
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [turn, phase, winner, rolled, rolling, aiPlaybackActive, matchId, applyMatch, captureBoardState]);

  const startGame = (li: number) => {
    playClick();
    if (li > previousLevelIdx) {
      setPreviousLevelIdx(li);
      localStorage.setItem('ludo_prev_level', String(li));
    }
    setPhase('searching');
    setLevelIdx(li);
  };

  const startMatchApi = useCallback(async (levelIdxParam: number) => {
    const match = await api.startLudoMatch({ levelIdx: levelIdxParam });
    return match;
  }, []);

  const handleMatchFound = useCallback((match: api.LudoMatchResponse) => {
    hydrateMatch(match, 'searching');
    refreshBalance();
  }, [hydrateMatch, refreshBalance]);

  const onMatchmakingReady = useCallback(() => {
    setPhase(currentMatch?.state.phase === 'result' ? 'result' : 'playing');
  }, [currentMatch?.state.phase]);

  const rollDice = async () => {
    if (!matchId || rolling || rolled || turn !== 'blue' || phase !== 'playing' || pendingActionRef.current) return;
    try {
      pendingActionRef.current = true;
      playDiceRoll();
      setRolling(true);
      const matchPromise = api.rollLudoDice({ matchId });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const match = await matchPromise;
      setRolling(false);
      const lastUserRoll = match?.state.lastUserRoll;
      const replaySeed = match?.state.aiTurns?.length
        ? {
            ...captureBoardState(),
            dice: lastUserRoll?.diceVal ?? dice,
            turn: 'blue',
            rolled: false,
            movable: [],
            phase: 'playing' as const,
          }
        : null;
      const replayDelay = match?.state.aiTurns?.length
        ? (lastUserRoll?.hadMove ? 420 : 1050)
        : undefined;
      applyMatch(match, undefined, replaySeed, replayDelay);
    } catch (error) {
      setRolling(false);
      toast.error((error as Error).message || 'Failed to roll dice');
    } finally {
      pendingActionRef.current = false;
    }
  };

  const performUserMove = useCallback(async (i: number) => {
    if (!matchId || turn !== 'blue' || !rolled || !movable.includes(i) || pendingActionRef.current) return;
    try {
      pendingActionRef.current = true;
      clearAutoMove();
      const beforeMove = captureBoardState();
      const replaySeed = applyReplayMove(beforeMove, 'blue', i, dice);
      const replayDelay = estimateBoardTransitionMs(beforeMove, replaySeed);
      playTokenMove();
      const match = await api.moveLudoToken({ matchId, tokenIdx: i });
      if (match) applyMatch(match, undefined, replaySeed, replayDelay);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to move token');
    } finally {
      pendingActionRef.current = false;
    }
  }, [matchId, turn, rolled, movable, clearAutoMove, captureBoardState, dice, estimateBoardTransitionMs, applyMatch]);

  const handleTokenClick = async (i: number) => {
    await performUserMove(i);
  };

  useEffect(() => {
    if (turn !== 'blue' || !rolled || rolling || aiPlaybackActive || phase !== 'playing' || movable.length !== 1 || pendingActionRef.current) {
      autoMoveKeyRef.current = '';
      clearAutoMove();
      return;
    }

    const onlyToken = movable[0];
    const autoMoveKey = `${matchId}-${dice}-${onlyToken}`;
    if (autoMoveKeyRef.current === autoMoveKey) {
      return;
    }
    autoMoveKeyRef.current = autoMoveKey;

    autoMoveTimerRef.current = setTimeout(() => {
      performUserMove(onlyToken);
    }, 550);

    return () => {
      clearAutoMove();
    };
  }, [turn, rolled, rolling, aiPlaybackActive, phase, movable, matchId, dice, performUserMove, clearAutoMove]);

  const abandonAndExit = useCallback(async (goToSlots = false) => {
    try {
      if (matchId && phase === 'playing' && !winner) {
        await api.abandonLudoMatch({ matchId });
        await refreshBalance();
      }
    } catch {
      // ignore
    } finally {
      clearAiPlayback();
      hydrateMatch(null, 'levels');
      if (goToSlots) navigate('/slots');
    }
  }, [matchId, phase, winner, refreshBalance, navigate, clearAiPlayback, hydrateMatch]);

  if (showLoading) {
    return <GameLoadingScreen show={showLoading} gameName="🎲 Lucky Ludo King" onComplete={() => setShowLoading(false)} />;
  }

  if (phase === 'levels') {
    return (
      <div className="min-h-screen navy-gradient p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/slots')} className="text-foreground"><ArrowLeft /></Button>
            <h1 className="text-2xl font-bold gold-text">🎲 Ludo King</h1>
          </div>
          <p className="text-muted-foreground text-center mb-2">Server-authoritative AI match • Win {WIN_MULTI}x</p>
          <p className="text-primary text-center mb-6 font-bold">Balance: ৳{balance.toFixed(0)}</p>
          <div className="grid grid-cols-2 gap-3">
            {LEVELS.map((lvl, i) => (
              <button key={i} onClick={() => startGame(i)} disabled={balance < lvl.bet || pendingActionRef.current} className={`p-4 rounded-xl border text-left transition-all ${balance >= lvl.bet ? 'bg-card gold-border hover:border-primary text-foreground card-glow active:scale-95 cursor-pointer' : 'bg-muted/50 border-border text-muted-foreground/50 opacity-50'}`}>
                <div className="text-lg font-bold">Level {lvl.level}</div>
                <div className={balance >= lvl.bet ? 'text-primary font-semibold' : 'text-muted-foreground font-semibold'}>৳{lvl.bet}</div>
                <div className={`text-xs ${balance >= lvl.bet ? 'text-green-400' : 'text-muted-foreground/50'}`}>Win: ৳{(lvl.bet * WIN_MULTI).toFixed(0)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'searching') {
    return (
      <MatchmakingScreen
        levelIdx={levelIdx}
        userProfile={{
          name: profile?.username || 'You',
          avatar: profile?.avatar_url || DEFAULT_AVATAR,
        }}
        startMatch={startMatchApi}
        onMatchFound={handleMatchFound}
        onReady={onMatchmakingReady}
        onBack={() => setPhase('levels')}
      />
    );
  }

  if (phase === 'result') {
    const won = winner === 'blue';
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-card gold-border backdrop-blur rounded-2xl p-8 text-center max-w-sm w-full card-glow">
          <div className="text-6xl mb-4">{won ? '🏆' : '😔'}</div>
          <h2 className={`text-3xl font-bold mb-2 ${won ? 'gold-text' : 'text-destructive'}`}>{won ? 'You Won!' : 'You Lost!'}</h2>
          {won && <p className="text-2xl text-green-400 font-bold mb-4">+৳{(currentMatch?.state.winAmount || betAmt * WIN_MULTI).toFixed(0)}</p>}
          <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground text-sm">
            <img src={currentOpponent?.avatar || ''} alt="" className="w-6 h-6 rounded-full" />
            <span>vs {currentOpponent?.name || 'Opponent'}</span>
          </div>
          <div className="flex gap-3 mt-6">
            <Button onClick={() => hydrateMatch(null, 'levels')} className="flex-1 gold-gradient text-primary-foreground font-bold">Play Again</Button>
            <Button variant="outline" onClick={() => navigate('/slots')} className="flex-1 border-border text-foreground">Exit</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const displayTurn: Player = turn;
  const opponentDiceValue = aiPlaybackActive && turn === 'green' ? aiDisplayDice : dice;
  const opponentStatusText = aiPlaybackActive
    ? aiPhase === 'rolling'
      ? 'Opponent rolling...'
      : aiPhase === 'moving'
        ? 'Opponent moving...'
        : 'Opponent thinking...'
    : 'Server AI thinking...';
  const userStatusText = aiPlaybackActive && turn === 'blue'
    ? 'Result shown... opponent next'
    : rolled
      ? 'Move token now!'
      : 'Tap to roll!';

  return (
    <div className="min-h-screen navy-gradient flex flex-col items-center gap-2 overflow-hidden touch-manipulation" style={{ touchAction: 'manipulation' }}>
      <div className="w-full flex items-center gap-2 mt-2 px-2">
        <Button variant="ghost" size="icon" onClick={() => abandonAndExit(false)} className="text-foreground h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-2xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(255,215,0,0.5))' }}>👑</span>
          <h1 className="text-2xl font-black tracking-widest uppercase" style={{ background: 'linear-gradient(180deg, #FFF8DC 0%, #FFD700 25%, #DAA520 50%, #B8860B 75%, #8B6914 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.7))', letterSpacing: '3px' }}>
            LUDO KING
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="text-foreground h-9 w-9">
            <Settings className="w-4 h-4" />
          </Button>
          <span className="text-primary text-xs font-bold">৳{betAmt}</span>
        </div>
      </div>

      <div className="flex items-start justify-center w-full mt-4" style={{ minHeight: 0 }}>
        <div className="w-full max-w-[min(100vw,510px)] mx-auto flex-shrink-0">
          <div className="text-center pt-2 pb-1">
            <span className="text-muted-foreground text-[10px]">Level {levelIdx + 1} • ৳{betAmt}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className={`transition-all duration-500 ${displayTurn === 'green' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2 pointer-events-none'}`}>
                <Dice3D value={opponentDiceValue} rolling={aiRolling} disabled diceColor={oppDiceColor} />
              </div>
              {displayTurn === 'green' && <p className={`${oppDiceTheme.text} text-[9px] font-bold animate-pulse`}>{opponentStatusText}</p>}
            </div>
            <div className={`text-center px-3 py-1.5 rounded-lg ${displayTurn === 'green' ? `${oppDiceTheme.bg} ring-1 ${oppDiceTheme.ring}` : 'bg-card/30'}`}>
              <div className={`${oppDiceTheme.text} font-bold text-[10px] flex items-center gap-1 justify-center`}>
                <img src={currentOpponent?.avatar || ''} alt="" className="w-4 h-4 rounded-full" />
                <span className="max-w-[80px] truncate">{currentOpponent?.name || 'Opponent'}</span>
              </div>
              <div className="text-foreground text-xs">{green.filter((t) => t === FINAL_HOME).length}/4</div>
            </div>
          </div>

          <div className="relative px-2 py-1">
            <div className="relative w-full aspect-square overflow-hidden rounded-lg">
              <div className="absolute inset-0"><LudoBoard /></div>
              {displayBlue.map((pos, i) => {
                const [r, c] = getCoords(pos, 'blue', i);
                const canMove = turn === 'blue' && rolled && movable.includes(i);
                return (
                  <motion.div
                    key={`b${i}`}
                    role="button"
                    tabIndex={canMove ? 0 : -1}
                    animate={{ left: `${tokenPosX(c)}%`, top: `${tokenPosY(r)}%` }}
                    transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canMove) handleTokenClick(i);
                    }}
                    onKeyDown={(e) => { if (canMove && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleTokenClick(i); } }}
                    className={`absolute rounded-full flex items-center justify-center text-[7px] font-bold text-white select-none touch-manipulation ${canMove ? 'z-30 animate-pulse ring-2 ring-primary cursor-pointer active:scale-95' : 'z-10'} ${pos === FINAL_HOME ? 'opacity-50' : ''}`}
                    style={{
                      width: `${TOKEN_SIZE}%`,
                      height: `${TOKEN_SIZE}%`,
                      left: `${tokenPosX(c)}%`,
                      top: `${tokenPosY(r)}%`,
                      background: userTokenTheme.gradient,
                      boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.3)',
                      border: `1.5px solid ${userTokenTheme.border}`,
                    }}
                  >
                    {i + 1}
                  </motion.div>
                );
              })}
              {displayGreen.map((pos, i) => {
                const [r, c] = getCoords(pos, 'green', i);
                return (
                  <motion.div
                    key={`g${i}`}
                    animate={{ left: `${tokenPosX(c)}%`, top: `${tokenPosY(r)}%` }}
                    transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
                    className={`absolute rounded-full flex items-center justify-center text-[7px] font-bold text-white z-10 pointer-events-none ${pos === FINAL_HOME ? 'opacity-50' : ''}`}
                    style={{ width: `${TOKEN_SIZE}%`, height: `${TOKEN_SIZE}%`, left: `${tokenPosX(c)}%`, top: `${tokenPosY(r)}%`, background: oppTokenTheme.gradient, boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.3)', border: `1.5px solid ${oppTokenTheme.border}` }}
                  >
                    {i + 1}
                  </motion.div>
                );
              })}

              {specialEffect && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: specialEffect === 'capture' ? 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)' : specialEffect === 'home' ? 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)' : specialEffect === 'triple6' ? 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(255,215,0,0.5) 0%, transparent 70%)' }}>
                  <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: [0, 1.3, 1], rotate: [-20, 10, 0] }} transition={{ duration: 0.5, ease: 'easeOut' }} className="flex flex-col items-center gap-1">
                    <span className="text-5xl drop-shadow-lg">{specialEffect === 'capture' ? '💥' : specialEffect === 'home' ? '🏠' : specialEffect === 'triple6' ? '🚫' : '🏆'}</span>
                    <span className="text-white text-sm font-bold px-3 py-1 rounded-full drop-shadow-lg" style={{ background: specialEffect === 'capture' ? 'rgba(239,68,68,0.85)' : specialEffect === 'home' ? 'rgba(34,197,94,0.85)' : specialEffect === 'triple6' ? 'rgba(245,158,11,0.85)' : 'rgba(255,215,0,0.9)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                      {specialEffect === 'capture' ? 'Captured!' : specialEffect === 'home' ? 'Home!' : specialEffect === 'triple6' ? 'Turn cancelled!' : 'You won!'}
                    </span>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-2">
            <div className={`text-center px-3 py-1.5 rounded-lg ${displayTurn === 'blue' ? `${userDiceTheme.bg} ring-1 ${userDiceTheme.ring}` : 'bg-card/30'}`}>
              <div className={`${userDiceTheme.text} font-bold text-[10px]`}>{userTokenTheme.emoji} You</div>
              <div className="text-foreground text-xs">{blue.filter((t) => t === FINAL_HOME).length}/4</div>
            </div>
            <div className="flex items-center gap-2">
              {displayTurn === 'blue' && !rolled && !rolling && !aiPlaybackActive && (
                <div className="flex flex-col items-center gap-0.5">
                  <p className={`${userDiceTheme.text} text-[9px] font-bold animate-pulse`}>{userStatusText}</p>
                  <p className={`text-[10px] font-bold ${turnTimer <= 2 ? 'text-destructive animate-pulse' : 'text-primary'}`}>{turnTimer}s</p>
                </div>
              )}
              {displayTurn === 'blue' && rolled && !rolling && !aiPlaybackActive && (
                <div className="flex flex-col items-center gap-0.5">
                  <p className={`${userDiceTheme.text} text-[9px] font-bold animate-pulse`}>{userStatusText}</p>
                  <p className={`text-[10px] font-bold ${turnTimer <= 2 ? 'text-destructive animate-pulse' : 'text-primary'}`}>{turnTimer}s</p>
                </div>
              )}
              <div className={`transition-all duration-500 ${displayTurn === 'blue' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2 pointer-events-none'}`}>
                <Dice3D value={dice} rolling={rolling && displayTurn === 'blue'} onClick={rollDice} disabled={displayTurn !== 'blue' || rolled || rolling || aiPlaybackActive || pendingActionRef.current} diceColor={userDiceColor} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground mb-1">⚙️ Game Settings</h3>
              <p className="text-muted-foreground text-xs mb-2 mt-3">🎯 Your Token</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TOKEN_PRESETS) as TokenColorKey[]).map((key) => {
                  const preset = TOKEN_PRESETS[key];
                  const isActive = userTokenColor === key;
                  return (
                    <button key={key} onClick={() => { setUserTokenColor(key); playClick(); }} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${isActive ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50'}`}>
                      <span className="text-lg">{preset.emoji}</span>
                      <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-muted-foreground text-xs mb-2 mt-3">🎲 Your Dice</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DICE_PRESETS) as DiceColorKey[]).map((key) => {
                  const preset = DICE_PRESETS[key];
                  const isActive = userDiceColor === key;
                  return (
                    <button key={key} onClick={() => { setUserDiceColor(key); playClick(); }} className={`flex items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${isActive ? `${preset.ring} ${preset.bg} border-current` : 'border-border hover:border-muted-foreground/50'}`}>
                      <span className="text-base">{preset.emoji}</span>
                      <span className={`text-xs font-bold ${isActive ? preset.text : 'text-foreground'}`}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border my-3" />
              <p className="text-muted-foreground text-xs mb-2">🎯 Opponent Token</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TOKEN_PRESETS) as TokenColorKey[]).map((key) => {
                  const preset = TOKEN_PRESETS[key];
                  const isActive = oppTokenColor === key;
                  return (
                    <button key={key} onClick={() => { setOppTokenColor(key); playClick(); }} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${isActive ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/50'}`}>
                      <span className="text-lg">{preset.emoji}</span>
                      <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-muted-foreground text-xs mb-2 mt-3">🎲 Opponent Dice</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DICE_PRESETS) as DiceColorKey[]).map((key) => {
                  const preset = DICE_PRESETS[key];
                  const isActive = oppDiceColor === key;
                  return (
                    <button key={key} onClick={() => { setOppDiceColor(key); playClick(); }} className={`flex items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${isActive ? `${preset.ring} ${preset.bg} border-current` : 'border-border hover:border-muted-foreground/50'}`}>
                      <span className="text-base">{preset.emoji}</span>
                      <span className={`text-xs font-bold ${isActive ? preset.text : 'text-foreground'}`}>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              <Button onClick={() => setShowSettings(false)} className="w-full mt-4 gold-gradient text-primary-foreground font-bold">Done</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LudoKingGame;
