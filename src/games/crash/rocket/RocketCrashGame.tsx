import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthGate from '@/components/AuthGate';
import { useActivePlayer } from '@/hooks/useActivePlayer';
import { getTodayTopPlayers, getWeekTopPlayers, getMonthTopPlayers, getFakeOnlineCount } from '../aviator/FakeLeaderboard';
import { useCrashRound } from '@/hooks/useCrashRound';
import { useCrashBetting } from '@/hooks/useCrashBetting';

type RoundPlayer = {
  id: string; username: string; bet_amount: number;
  status: 'playing' | 'cashed_out' | 'lost';
  cashout_multiplier?: number; win_amount?: number; isReal?: boolean;
};
type BetPanel = { stake: string; autoCashout: string; hasBet: boolean; cashedOut: boolean; mode: 'bet' | 'auto'; };

const GROWTH_RATE = 0.00006;
const BOT_NAMES = ['Rakib_77','FarhanBD','ShadowKing','LuckyAce','TigerBet','Nayeem99','JoyBD','GamerZone','RifatPro','KaziStar','SultanBet','RaselPlay','ShakibFan','MahiGold','TasnimBD','ArifulWin','NabilX','SamirBet','ImranLuck','TonoyPro','PavelBD','ShohelMax','DidarPro','MasudGold','BiplabWin','AlaminBet','HasanLuck','TuhinX','RobiStar','SumonAce'];

type Star = { x: number; y: number; size: number; speed: number; brightness: number; };
type ExhaustParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; };

const createStars = (count: number, w: number, h: number): Star[] =>
  Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    size: 0.5 + Math.random() * 2, speed: 0.3 + Math.random() * 1.5,
    brightness: 0.3 + Math.random() * 0.7,
  }));

const RocketCrashGame = () => {
  const navigate = useNavigate();
  useActivePlayer('rocket', 'Lucky Rocket Crash', 'crash', 0);

  // Server-synced round state
  const { gameState, multiplier, multiplierRef, countdown, history, elapsedTime, startTimeRef, gameStateRef, roundId, liveBets, refreshRound } = useCrashRound('rocket');
  const { balance, panels, panelBusy, updatePanel, handlePlaceBet, handleCancelBet, handleCashout, ownRoundBets, otherPlayerBets } = useCrashBetting({
    gameId: 'rocket',
    gameName: 'Lucky Rocket Crash',
    gameState,
    multiplier,
    roundId,
    liveBets,
    refreshRound,
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all'|'my'|'top'>('all');
  const [topSubTab, setTopSubTab] = useState<'today'|'week'|'month'>('today');
  const [onlineCount, setOnlineCount] = useState(getFakeOnlineCount());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [fillerBots, setFillerBots] = useState<RoundPlayer[]>([]);
  const botCashoutTimersRef = useRef<NodeJS.Timeout[]>([]);

  const starsRef = useRef<Star[]>([]);
  const exhaustRef = useRef<ExhaustParticle[]>([]);
  const explosionRef = useRef<ExhaustParticle[]>([]);
  const panelsRef = useRef(panels);
  useEffect(() => { panelsRef.current = panels; }, [panels]);

  useEffect(() => { const t = setInterval(() => setOnlineCount(getFakeOnlineCount()), 30000); return () => clearInterval(t); }, []);

  const generateFillerBots = useCallback((realCount: number, cp?: number)=>{
    const target=20+Math.floor(Math.random()*6);
    const need=Math.max(0,target-realCount);
    if(need<=0){setFillerBots([]);return;}
    const shuffled=[...BOT_NAMES].sort(()=>Math.random()-0.5);
    const bots:RoundPlayer[]=shuffled.slice(0,need).map((n,i)=>({
      id:`bot-${i}-${Date.now()}`,username:n,
      bet_amount:[10,20,50,100,200,500,1000,2000,5000][Math.floor(Math.random()*9)],
      status:'playing' as const,isReal:false,
    }));
    setFillerBots(bots);
    botCashoutTimersRef.current.forEach(t=>clearTimeout(t));
    botCashoutTimersRef.current=[];
    bots.forEach(bot=>{
      if(Math.random()>=0.6)return;
      let delay:number;
      if(cp){const cm=1.1+Math.random()*(cp-1.1)*0.9;if(cm>=cp)return;delay=Math.log(cm)/GROWTH_RATE+(Math.random()-0.5)*500;}
      else{delay=2000+Math.random()*20000;}
      const timer=setTimeout(()=>{
        if(gameStateRef.current!=='flying')return;
        const cm=multiplierRef.current;
        setFillerBots(p=>p.map(b=>b.id===bot.id&&b.status==='playing'?{...b,status:'cashed_out' as const,cashout_multiplier:Math.floor(cm*100)/100,win_amount:Math.round(b.bet_amount*cm)}:b));
      },delay);
      botCashoutTimersRef.current.push(timer);
    });
  },[]);

  // Crash point is now server-generated via useCrashRound

  // ── CANVAS RENDERING ──
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const gs = gameStateRef.current;
    // Reset explosion when new round starts (waiting) so we don't show BOOM
    if (gs === 'waiting') {
      explosionRef.current = [];
      exhaustRef.current = [];
    }

    // ── SPACE BG with deep purple gradient ──
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0c0628');
    bgGrad.addColorStop(0.3, '#140a3a');
    bgGrad.addColorStop(0.6, '#1a0d4a');
    bgGrad.addColorStop(1, '#0e0630');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ── Nebula clouds ──
    const drawNebula = (cx: number, cy: number, r: number, color: string) => {
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      ng.addColorStop(0, color);
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    drawNebula(w * 0.2, h * 0.3, w * 0.4, 'rgba(88,28,200,0.06)');
    drawNebula(w * 0.8, h * 0.6, w * 0.35, 'rgba(50,20,180,0.05)');
    if (gs === 'crashed') {
      drawNebula(w * 0.5, h * 0.4, w * 0.3, 'rgba(255,40,40,0.08)');
    }

    // ── Earth/Planet at bottom right ──
    const earthRadius = Math.min(w, h) * 0.55;
    const earthCx = w * 0.75;
    const earthCy = h + earthRadius * 0.45;

    // Earth glow
    const earthGlow = ctx.createRadialGradient(earthCx, earthCy, earthRadius * 0.85, earthCx, earthCy, earthRadius * 1.3);
    earthGlow.addColorStop(0, 'rgba(60,120,255,0.12)');
    earthGlow.addColorStop(0.5, 'rgba(40,80,200,0.06)');
    earthGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = earthGlow;
    ctx.fillRect(0, 0, w, h);

    // Earth body - rotating
    const earthRotation = Date.now() * 0.0003; // continuous rotation
    ctx.save();
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const earthBg = ctx.createRadialGradient(earthCx - earthRadius * 0.3, earthCy - earthRadius * 0.3, 0, earthCx, earthCy, earthRadius);
    earthBg.addColorStop(0, '#1a4a8a');
    earthBg.addColorStop(0.3, '#0d3068');
    earthBg.addColorStop(0.6, '#0a2450');
    earthBg.addColorStop(1, '#061230');
    ctx.fillStyle = earthBg;
    ctx.fill();

    // Rotating continents — high contrast
    ctx.globalAlpha = 0.55;
    const drawContinent = (offsetAngle: number, dist: number, r2: number, color1: string, color2: string) => {
      const cx2 = earthCx + Math.cos(earthRotation + offsetAngle) * dist;
      const cy2 = earthCy + Math.sin(earthRotation + offsetAngle) * dist * 0.5;
      const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      cg.addColorStop(0, color1);
      cg.addColorStop(0.5, color2);
      cg.addColorStop(0.85, color2);
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
      ctx.fill();
    };
    // Major continents with varied greens/browns
    drawContinent(0, earthRadius * 0.35, earthRadius * 0.3, '#2d8a4e', '#1a6b3a');
    drawContinent(Math.PI * 0.6, earthRadius * 0.45, earthRadius * 0.24, '#3a7a3a', '#256b28');
    drawContinent(Math.PI * 1.2, earthRadius * 0.3, earthRadius * 0.2, '#8a7a42', '#6b5a30'); // desert
    drawContinent(Math.PI * 1.7, earthRadius * 0.5, earthRadius * 0.22, '#2a7848', '#1d5a35');
    drawContinent(Math.PI * 0.3, earthRadius * 0.55, earthRadius * 0.17, '#357a40', '#2a6035');
    // Sub-patches for texture
    ctx.globalAlpha = 0.35;
    drawContinent(0.15, earthRadius * 0.25, earthRadius * 0.12, '#4a9a5a', '#2d7a3e');
    drawContinent(Math.PI * 0.75, earthRadius * 0.38, earthRadius * 0.1, '#7a8a48', '#5a6a30');
    drawContinent(Math.PI * 1.5, earthRadius * 0.42, earthRadius * 0.13, '#2a8a5a', '#1a6a40');
    ctx.globalAlpha = 1;

    // Ocean highlights — subtle specular on water
    ctx.globalAlpha = 0.08;
    const oceanHighlight = ctx.createRadialGradient(
      earthCx - earthRadius * 0.25, earthCy - earthRadius * 0.2, 0,
      earthCx, earthCy, earthRadius * 0.9
    );
    oceanHighlight.addColorStop(0, '#5090cc');
    oceanHighlight.addColorStop(0.5, 'transparent');
    oceanHighlight.addColorStop(1, 'transparent');
    ctx.fillStyle = oceanHighlight;
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cloud bands — more visible, wispy
    for (let i = 0; i < 6; i++) {
      const bandAngle = earthRotation * 1.15 + i * Math.PI * 0.35;
      const bx = earthCx + Math.cos(bandAngle) * earthRadius * 0.42;
      const by = earthCy + Math.sin(bandAngle) * earthRadius * 0.22 - earthRadius * 0.15 + i * earthRadius * 0.1;
      const cloudW = earthRadius * (0.25 + (i % 3) * 0.08);
      const cloudH = earthRadius * (0.04 + (i % 2) * 0.02);
      ctx.globalAlpha = 0.18 + (i % 3) * 0.06;
      ctx.beginPath();
      ctx.ellipse(bx, by, cloudW, cloudH, bandAngle * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
    // Small cloud puffs
    for (let i = 0; i < 8; i++) {
      const puffAngle = earthRotation * 1.3 + i * 0.78;
      const puffDist = earthRadius * (0.15 + (i % 4) * 0.15);
      const px = earthCx + Math.cos(puffAngle) * puffDist;
      const py = earthCy + Math.sin(puffAngle) * puffDist * 0.5;
      const puffR = earthRadius * (0.04 + (i % 3) * 0.025);
      ctx.globalAlpha = 0.12 + (i % 3) * 0.05;
      ctx.beginPath();
      ctx.arc(px, py, puffR, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Day-night terminator shadow — sun from top-left
    const sunAngle = earthRotation * 0.4; // slow shift
    const shadowOffX = Math.cos(sunAngle + Math.PI * 0.8) * earthRadius * 0.6;
    const shadowOffY = Math.sin(sunAngle + Math.PI * 0.8) * earthRadius * 0.4;
    const nightGrad = ctx.createRadialGradient(
      earthCx - shadowOffX, earthCy - shadowOffY, earthRadius * 0.1,
      earthCx + shadowOffX * 0.5, earthCy + shadowOffY * 0.5, earthRadius * 1.1
    );
    nightGrad.addColorStop(0, 'rgba(0,0,0,0)');
    nightGrad.addColorStop(0.35, 'rgba(0,0,0,0.05)');
    nightGrad.addColorStop(0.55, 'rgba(0,0,20,0.35)');
    nightGrad.addColorStop(0.75, 'rgba(0,0,10,0.65)');
    nightGrad.addColorStop(1, 'rgba(0,0,5,0.85)');
    ctx.fillStyle = nightGrad;
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
    ctx.fill();

    // City lights on dark side
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 12; i++) {
      const lightAngle = earthRotation * 0.8 + i * 0.52;
      const lightDist = earthRadius * (0.2 + (i % 4) * 0.15);
      const lx = earthCx + Math.cos(lightAngle) * lightDist + shadowOffX * 0.3;
      const ly = earthCy + Math.sin(lightAngle) * lightDist * 0.5 + shadowOffY * 0.2;
      // Only show on dark side
      const dotToCenterAngle = Math.atan2(ly - earthCy, lx - earthCx);
      const sunDir = Math.atan2(-shadowOffY, -shadowOffX);
      const angleDiff = Math.abs(((dotToCenterAngle - sunDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (angleDiff < Math.PI * 0.45) {
        const cityGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 3 + (i % 3));
        cityGlow.addColorStop(0, 'rgba(255,200,80,0.7)');
        cityGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = cityGlow;
        ctx.beginPath();
        ctx.arc(lx, ly, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Atmosphere rim with sunlit edge
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
    const atmGrad = ctx.createRadialGradient(earthCx, earthCy, earthRadius * 0.92, earthCx, earthCy, earthRadius);
    atmGrad.addColorStop(0, 'transparent');
    atmGrad.addColorStop(0.6, 'rgba(80,160,255,0.12)');
    atmGrad.addColorStop(0.85, 'rgba(100,180,255,0.22)');
    atmGrad.addColorStop(1, 'rgba(140,200,255,0.3)');
    ctx.fillStyle = atmGrad;
    ctx.fill();

    // Sunlit crescent highlight on the lit edge
    const crescentX = earthCx - shadowOffX * 0.7;
    const crescentY = earthCy - shadowOffY * 0.7;
    const crescentGrad = ctx.createRadialGradient(crescentX, crescentY, earthRadius * 0.7, crescentX, crescentY, earthRadius * 1.05);
    crescentGrad.addColorStop(0, 'transparent');
    crescentGrad.addColorStop(0.8, 'rgba(150,200,255,0.08)');
    crescentGrad.addColorStop(1, 'rgba(180,220,255,0.2)');
    ctx.fillStyle = crescentGrad;
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── Shooting star / comet ──
    const cometPhase = (Date.now() % 8000) / 8000;
    if (cometPhase < 0.3) {
      const cx2 = w * (0.1 + cometPhase * 2);
      const cy2 = h * (0.05 + cometPhase * 0.6);
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 - 40, cy2 - 15);
      const cometGrad = ctx.createLinearGradient(cx2, cy2, cx2 - 40, cy2 - 15);
      cometGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
      cometGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = cometGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx2, cy2, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    }

    // ── Mountains/terrain at very bottom ──
    ctx.fillStyle = '#0a0520';
    ctx.beginPath();
    ctx.moveTo(0, h);
    const mountainPoints = [0, 0.08, 0.15, 0.22, 0.3, 0.38, 0.45, 0.52, 0.6, 0.68, 0.75, 0.82, 0.9, 1.0];
    const mountainHeights = [0.92, 0.85, 0.88, 0.82, 0.86, 0.84, 0.80, 0.87, 0.83, 0.86, 0.88, 0.84, 0.87, 0.90];
    mountainPoints.forEach((p, i) => {
      ctx.lineTo(p * w, mountainHeights[i] * h);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Mountain highlight
    ctx.fillStyle = 'rgba(80,40,150,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    mountainPoints.forEach((p, i) => {
      ctx.lineTo(p * w, (mountainHeights[i] + 0.01) * h);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // ── STARS ──
    if (starsRef.current.length === 0) starsRef.current = createStars(100, w, h);
    const speedFactor = gs === 'flying' ? 1.5 + multiplierRef.current * 0.3 : 0.2;
    starsRef.current.forEach(star => {
      star.y += star.speed * speedFactor;
      if (star.y > h * 0.8) { star.y = 0; star.x = Math.random() * w; }
      const twinkle = 0.5 + Math.sin(Date.now() * 0.003 + star.x) * 0.5;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${star.brightness * twinkle})`;
      ctx.fill();
      if (gs === 'flying' && star.speed > 1) {
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x, star.y - star.speed * speedFactor * 2.5);
        ctx.strokeStyle = `rgba(200,200,255,${star.brightness * 0.2})`;
        ctx.lineWidth = star.size * 0.4;
        ctx.stroke();
      }
    });

    // (multiplier scale markers removed)

    const currentM = multiplierRef.current;

    if (gs === 'waiting') {
      // Rocket at curve start (launchpad) — same position as flying curve origin
      const padL = 25, padB = h * 0.22;
      const launchX = padL + 28;
      const launchY = h - padB - 18;
      drawRocket(ctx, launchX, launchY, Math.PI / 2 * 0.3, 1.4, false, w);
      // Launchpad glow
      const lpg = ctx.createRadialGradient(launchX, launchY + 12, 3, launchX, launchY + 12, 50);
      lpg.addColorStop(0, 'rgba(255,140,0,0.12)');
      lpg.addColorStop(1, 'transparent');
      ctx.fillStyle = lpg;
      ctx.fillRect(0, 0, w, h);
    }

    if (gs === 'flying') {
      const maxM = Math.max(currentM, 2);
      const padL = 25, padB = h * 0.22, padR = 45, padT = 25;
      const gw = w - padL - padR, gh = h - padT - padB;
      const progress = Math.min((Date.now() - startTimeRef.current) / 30000, 0.95);

      const points: [number, number][] = [];
      const elapsed = Date.now() - startTimeRef.current;
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const mAt = Math.pow(Math.E, GROWTH_RATE * t * elapsed);
        const x = padL + t * progress * gw;
        const y = Math.max(padT, h - padB - ((mAt - 1) / (maxM - 1)) * gh);
        points.push([x, y]);
      }

      // Filled area under curve
      const areaGrad = ctx.createLinearGradient(0, h, 0, 0);
      areaGrad.addColorStop(0, 'rgba(100,40,220,0.03)');
      areaGrad.addColorStop(0.5, 'rgba(120,60,255,0.10)');
      areaGrad.addColorStop(1, 'rgba(160,80,255,0.20)');
      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      ctx.moveTo(points[0][0], h - padB);
      points.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(points[points.length - 1][0], h - padB);
      ctx.closePath();
      ctx.fill();

      // Curve line with glow
      const lineGrad = ctx.createLinearGradient(points[0][0], 0, points[points.length - 1][0], 0);
      lineGrad.addColorStop(0, '#6d28d9');
      lineGrad.addColorStop(0.5, '#8b5cf6');
      lineGrad.addColorStop(1, '#a78bfa');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#8b5cf6';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Rocket at tip
      const tip = points[points.length - 1];
      const prev = points[Math.max(0, points.length - 8)];
      const angle = Math.atan2(prev[1] - tip[1], tip[0] - prev[0]);

      // Exhaust particles
      for (let i = 0; i < 3; i++) {
        exhaustRef.current.push({
          x: tip[0], y: tip[1],
          vx: -Math.cos(angle) * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * (2 + Math.random() * 4) + (Math.random() - 0.5) * 2,
          life: 1, maxLife: 20 + Math.random() * 20,
          size: 2 + Math.random() * 4,
          color: ['#ff6b00','#ffaa00','#ff3300','#ff8800','#ffcc00'][Math.floor(Math.random()*5)],
        });
      }

      exhaustRef.current = exhaustRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0) return false;
        const hex = p.color;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
        return true;
      });

      drawRocket(ctx, tip[0], tip[1], -angle, 1.1, true, w);
    }

    if (gs === 'crashed') {
      const maxM = Math.max(currentM, 2);
      const padL = 25, padB = h * 0.22, padR = 45, padT = 25;
      const gw = w - padL - padR, gh = h - padT - padB;
      const finalElapsed = Math.log(currentM) / GROWTH_RATE;
      const progress = Math.min(finalElapsed / 30000, 0.95);

      const points: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const mAt = Math.pow(Math.E, GROWTH_RATE * t * finalElapsed);
        const x = padL + t * progress * gw;
        const y = Math.max(padT, h - padB - ((mAt - 1) / (maxM - 1)) * gh);
        points.push([x, y]);
      }

      // Red area
      const areaGrad = ctx.createLinearGradient(0, h, 0, 0);
      areaGrad.addColorStop(0, 'rgba(255,30,30,0.03)');
      areaGrad.addColorStop(1, 'rgba(255,50,50,0.18)');
      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      ctx.moveTo(points[0][0], h - padB);
      points.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(points[points.length - 1][0], h - padB);
      ctx.closePath(); ctx.fill();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke(); ctx.shadowBlur = 0;

      const tip = points[points.length - 1];
      const prev = points[Math.max(0, points.length - 8)];
      const angle = Math.atan2(prev[1] - tip[1], tip[0] - prev[0]);

      // Rocket at center above BOOM — always visible (low multipliers crash at left edge)
      const crashCenterX = w / 2, crashCenterY = h * 0.28;
      drawRocket(ctx, crashCenterX, crashCenterY, -angle, 1.3, true, w);

      // Explosion (particles from center)
      if (explosionRef.current.length === 0) {
        for (let i = 0; i < 50; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 1 + Math.random() * 6;
          explosionRef.current.push({
            x: crashCenterX, y: crashCenterY,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0, maxLife: 30 + Math.random() * 30,
            size: 2 + Math.random() * 6,
            color: ['#ff4444','#ff8800','#ffcc00','#ff2222','#ff6600','#ffaa00'][Math.floor(Math.random()*6)],
          });
        }
      }

      // BOOM text is in JSX overlay — canvas shows rocket + explosion only

      // Explosion ring (at center with rocket)
      const ringProgress = Math.max(0, Math.min(1, (Date.now() - startTimeRef.current - Math.log(currentM) / GROWTH_RATE) / 1000));
      if (ringProgress > 0 && ringProgress < 1) {
        ctx.beginPath();
        ctx.arc(crashCenterX, crashCenterY, ringProgress * 60, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,100,0,${(1 - ringProgress) * 0.5})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      explosionRef.current = explosionRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (alpha <= 0) return false;
        const hex = p.color;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.fill(); ctx.shadowBlur = 0;
        return true;
      });
    }

    animFrameRef.current = requestAnimationFrame(drawCanvas);
  }, []);

  // Force redraw when gameState changes so rocket shows correctly after crash
  const prevGsRef = useRef(gameState);
  useEffect(() => {
    if (prevGsRef.current !== gameState) {
      prevGsRef.current = gameState;
      if (gameState === 'waiting') {
        explosionRef.current = [];
        exhaustRef.current = [];
      }
    }
  }, [gameState]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawCanvas);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawCanvas]);

  // ── ROCKET SPRITE ──
  function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, showFlame: boolean, canvasW: number) {
    const rocketScale = scale * Math.max(0.8, Math.min(1.2, canvasW / 350));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4); // fixed 45° angle — nose points top-right
    ctx.scale(rocketScale, rocketScale);

    // Rocket body - white/silver with orange accents (like reference)
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(20, -7, 10, -9);
    ctx.lineTo(-14, -9);
    ctx.lineTo(-14, 9);
    ctx.lineTo(10, 9);
    ctx.quadraticCurveTo(20, 7, 22, 0);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-14, -9, -14, 9);
    bodyGrad.addColorStop(0, '#f0f0f8');
    bodyGrad.addColorStop(0.5, '#ffffff');
    bodyGrad.addColorStop(1, '#d0d0e0');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,100,150,0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Orange stripe
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(-2, -9, 8, 18);

    // Nose cone - orange
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(20, -6, 16, -7);
    ctx.lineTo(16, 7);
    ctx.quadraticCurveTo(20, 6, 22, 0);
    ctx.closePath();
    ctx.fillStyle = '#ff6b00';
    ctx.fill();

    // Window/porthole
    ctx.beginPath();
    ctx.arc(8, 0, 3.5, 0, Math.PI * 2);
    const windowGrad = ctx.createRadialGradient(7, -1, 0, 8, 0, 3.5);
    windowGrad.addColorStop(0, '#60d0ff');
    windowGrad.addColorStop(1, '#2080cc');
    ctx.fillStyle = windowGrad;
    ctx.fill();
    ctx.strokeStyle = '#aaddff';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Fins - blue/purple
    ctx.fillStyle = '#4a3aad';
    ctx.beginPath();
    ctx.moveTo(-12, -9);
    ctx.lineTo(-18, -18);
    ctx.lineTo(-8, -9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 9);
    ctx.lineTo(-18, 18);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();

    // Flame
    if (showFlame) {
      const flicker = 0.7 + Math.random() * 0.6;
      const len = 18 * flicker;
      // Outer
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.quadraticCurveTo(-14 - len * 0.7, 0, -14, 6);
      ctx.quadraticCurveTo(-14 - len, 0, -14, -6);
      ctx.fillStyle = 'rgba(255,80,0,0.85)';
      ctx.fill();
      // Mid
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.quadraticCurveTo(-14 - len * 0.5, 0, -14, 4);
      ctx.quadraticCurveTo(-14 - len * 0.7, 0, -14, -4);
      ctx.fillStyle = 'rgba(255,180,30,0.9)';
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.quadraticCurveTo(-14 - len * 0.25, 0, -14, 2);
      ctx.quadraticCurveTo(-14 - len * 0.4, 0, -14, -2);
      ctx.fillStyle = 'rgba(255,255,200,0.95)';
      ctx.fill();
    }

    ctx.restore();
  }

  // --- State transitions (server-driven) ---
  const prevRocketStateRef = useRef<string>('waiting');
  useEffect(() => {
    if (prevRocketStateRef.current === gameState) return;
    const prev = prevRocketStateRef.current;
    prevRocketStateRef.current = gameState;

    if (gameState === 'flying') {
      const realCount = panelsRef.current.filter(p => p.hasBet).length + otherPlayerBets.length;
      generateFillerBots(realCount);
    }
    if (gameState === 'crashed') {
      botCashoutTimersRef.current.forEach(t => clearTimeout(t));
      setFillerBots(p => p.map(b => b.status === 'playing' ? { ...b, status: 'lost' as const } : b));
    }
    if (gameState === 'waiting' && prev === 'crashed') {
      setFillerBots([]);
      explosionRef.current = [];
      exhaustRef.current = [];
    }
  }, [gameState]);

  // Auto cashout
  const totalRoundPlayers = onlineCount;
  const fakeTotalBaseBet = useRef(0);
  const [liveTotalBet, setLiveTotalBet] = useState(0);
  useEffect(() => {
    if (gameState === 'flying') {
      const t = Math.round(onlineCount * (150 + Math.random() * 150));
      fakeTotalBaseBet.current = t; setLiveTotalBet(t);
    }
  }, [gameState, onlineCount]);

  const allVisibleBets = [...ownRoundBets, ...otherPlayerBets, ...fillerBots];

  useEffect(() => {
    if (gameState === 'flying') {
      const co = allVisibleBets.filter(b => b.status === 'cashed_out' && b.win_amount).reduce((s, b) => s + (b.win_amount || 0), 0);
      const sf = onlineCount / Math.max(allVisibleBets.length, 1);
      setLiveTotalBet(Math.max(0, fakeTotalBaseBet.current - Math.round(co * sf * 0.3)));
    }
  }, [allVisibleBets.length, gameState, onlineCount]);

  const displayedBets = activeTab === 'my' ? ownRoundBets : activeTab === 'top'
    ? [...allVisibleBets].sort((a, b) => (b.win_amount || 0) - (a.win_amount || 0)) : allVisibleBets;

  const altitudeKm = gameState === 'flying' ? Math.round((multiplier - 1) * 100) : gameState === 'crashed' ? Math.round((multiplier - 1) * 100) : 0;

  return (
    <AuthGate>
      <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: '#0c0628' }}>

        {/* ── HEADER ── */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/crash')} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <ArrowLeft size={18} className="text-purple-300/60" />
            </button>
            <span className="text-xl">🚀</span>
            <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-purple-300 to-violet-200 bg-clip-text text-transparent">RocketCrash</span>
          </div>
          <div className="flex items-center gap-1.5 border border-purple-500/25 rounded-full px-2.5 py-1 bg-purple-950/50 backdrop-blur-sm">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[8px]">🪙</div>
            <span className="text-amber-300 font-bold text-xs sm:text-sm">৳{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* ── HISTORY BAR ── */}
        <div className="relative z-20 px-3 mb-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
              {history.map((h, i) => (
                <span key={i} className={`flex-shrink-0 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-md ${
                  h < 2 ? 'bg-red-500/15 text-red-400' : h >= 10 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'
                }`}>{h.toFixed(2)}x</span>
              ))}
            </div>
            <button onClick={() => setHistoryOpen(!historyOpen)} className="flex-shrink-0 p-1 bg-purple-900/40 rounded hover:bg-purple-500/20 transition-colors">
              <History size={14} className="text-purple-300/60" />
            </button>
          </div>
          <AnimatePresence>
            {historyOpen && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute left-3 right-3 top-full mt-1 bg-[#12103a] rounded-xl border border-purple-500/20 p-3 max-h-[180px] overflow-y-auto shadow-xl z-30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-200 font-bold text-xs">📜 History</span>
                  <button onClick={() => setHistoryOpen(false)} className="text-purple-400 text-xs hover:text-purple-200">✕</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h, i) => (
                    <span key={i} className={`text-xs font-bold px-2 py-1 rounded ${
                      h < 2 ? 'bg-red-500/15 text-red-400' : h >= 10 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'
                    }`}>{h.toFixed(2)}x</span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── GAME CANVAS ── */}
        <div className="relative z-10 mx-3 rounded-2xl overflow-hidden border border-purple-500/15 shadow-[0_0_40px_rgba(100,40,200,0.12)] shrink-0" style={{ aspectRatio: '16/9', maxHeight: '45vh', minHeight: 180 }}>
          <canvas ref={canvasRef} className="w-full h-full" />
          {/* Overlay multiplier */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[3]">
            {gameState === 'waiting' && (
              <motion.div className="text-center" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <p className="text-purple-300/50 text-xs sm:text-sm font-medium tracking-widest">LAUNCH IN</p>
                <p className="text-purple-200 font-black text-4xl sm:text-5xl mt-1" style={{ textShadow: '0 0 25px rgba(168,85,247,0.5)' }}>{countdown}s</p>
                <p className="text-amber-300/70 text-[10px] sm:text-xs mt-2 animate-pulse font-bold tracking-widest">PLACE YOUR BETS</p>
              </motion.div>
            )}
            {gameState === 'flying' && (
              <div className="text-center">
                {/* Multiplier badge like reference */}
                <div className="inline-block px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl border-2 border-amber-400/40" style={{ background: 'rgba(20,10,50,0.75)', boxShadow: '0 0 30px rgba(168,85,247,0.3)' }}>
                  <motion.p className={`font-black text-3xl sm:text-5xl ${
                    multiplier >= 10 ? 'text-amber-300' : multiplier >= 5 ? 'text-emerald-400' : multiplier >= 2 ? 'text-purple-200' : 'text-white'
                  }`} style={{ textShadow: `0 0 20px ${multiplier >= 5 ? 'rgba(74,222,128,0.4)' : 'rgba(168,85,247,0.4)'}` }}
                    key={Math.floor(multiplier * 10)}
                    initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 0.1 }}>
                    {multiplier.toFixed(2)}x
                  </motion.p>
                </div>
                
              </div>
            )}
            {gameState === 'crashed' && (
              <motion.div className="text-center" initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 8 }}>
                <p className="text-orange-400 font-black text-3xl sm:text-4xl drop-shadow-[0_0_20px_rgba(255,100,0,0.5)]">BOOM</p>
                <div className="inline-block mt-2 px-5 py-2 rounded-xl border-2 border-amber-400/60" style={{ background: 'rgba(20,10,5,0.85)', boxShadow: '0 0 25px rgba(251,191,36,0.2)' }}>
                  <p className="text-amber-300 font-black text-xl sm:text-2xl">{multiplier.toFixed(2)}x</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── BET PANELS + BETS LIST ── */}
        <div className="relative z-10 px-3 mt-2 flex-1 overflow-y-auto pb-4 space-y-2">
          {/* Dual bet panels side by side on wider screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([0, 1] as const).map(idx => (
              <div key={idx} className="bg-[#110e30]/90 rounded-xl p-2.5 border border-purple-500/15 backdrop-blur-sm">
                {/* Bet / Auto toggle */}
                <div className="flex gap-0 mb-2">
                  <button onClick={() => updatePanel(idx, { mode: 'bet' })} className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded-l-md transition-colors ${panels[idx].mode === 'bet' ? 'bg-purple-600/30 text-purple-200' : 'bg-purple-950/60 text-purple-400/40'}`}>Bet</button>
                  <button onClick={() => updatePanel(idx, { mode: 'auto' })} className={`flex-1 py-1 text-[10px] sm:text-xs font-bold rounded-r-md transition-colors ${panels[idx].mode === 'auto' ? 'bg-purple-600/30 text-purple-200' : 'bg-purple-950/60 text-purple-400/40'}`}>Auto</button>
                </div>

                {/* Auto cashout */}
                {panels[idx].mode === 'auto' && (
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[9px] sm:text-[10px] text-purple-400/50 whitespace-nowrap">Auto x</label>
                    <input type="number" value={panels[idx].autoCashout} onChange={e => updatePanel(idx, { autoCashout: e.target.value })} disabled={panels[idx].hasBet}
                      className="flex-1 bg-[#0a0828] border border-purple-500/10 rounded px-2 py-1 text-purple-100 text-xs font-bold outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                )}

                {/* Stake + Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#0a0828] rounded-lg flex-1 border border-purple-500/10">
                    <button onClick={() => updatePanel(idx, { stake: String(Math.max(5, Number(panels[idx].stake) - 10).toFixed(2)) })} disabled={panels[idx].hasBet} className="px-2 py-1.5 text-purple-400 text-base font-bold disabled:opacity-20">−</button>
                    <input type="number" value={panels[idx].stake} onChange={e => updatePanel(idx, { stake: e.target.value })} disabled={panels[idx].hasBet}
                      className="w-full bg-transparent text-center text-purple-100 font-bold text-sm outline-none py-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => updatePanel(idx, { stake: String((Number(panels[idx].stake) + 10).toFixed(2)) })} disabled={panels[idx].hasBet} className="px-2 py-1.5 text-purple-400 text-base font-bold disabled:opacity-20">+</button>
                  </div>

                  {!panels[idx].hasBet ? (
                    <button onClick={() => handlePlaceBet(idx)} disabled={panelBusy[idx]} className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-violet-500 text-white active:scale-95 transition-transform min-w-[80px] sm:min-w-[90px] shadow-lg shadow-purple-600/20 disabled:opacity-60">
                      <div className="text-[9px] opacity-70">BET</div><div>৳{Number(panels[idx].stake).toFixed(0)}</div>
                    </button>
                  ) : panels[idx].cashedOut ? (
                    <button disabled className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500/20 text-emerald-400 min-w-[80px]">✅ Won</button>
                  ) : gameState === 'crashed' ? (
                    <button disabled className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs bg-red-500/20 text-red-400 min-w-[80px]">Lost</button>
                  ) : gameState === 'waiting' ? (
                    <button onClick={() => handleCancelBet(idx)} disabled={panelBusy[idx]} className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 text-white active:scale-95 transition-transform min-w-[80px] disabled:opacity-60">
                      <div className="text-[9px] opacity-70">CANCEL</div><div>৳{Number(panels[idx].stake).toFixed(0)}</div>
                    </button>
                  ) : (
                    <button onClick={() => handleCashout(idx)} disabled={panelBusy[idx]} className="px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-green-400 text-white active:scale-95 transition-transform min-w-[80px] shadow-lg shadow-emerald-500/20 animate-pulse disabled:opacity-60">
                      <div className="text-[9px] opacity-70">CASH OUT</div><div>৳{Math.round(Number(panels[idx].stake) * multiplier).toLocaleString()}</div>
                    </button>
                  )}
                </div>

                {/* Quick stakes */}
                <div className="flex gap-1 mt-1.5">
                  {[10, 20, 50, 100].map(v => (
                    <button key={v} onClick={() => updatePanel(idx, { stake: String(v.toFixed(2)) })} disabled={panels[idx].hasBet}
                      className="flex-1 py-0.5 text-[10px] font-bold bg-purple-900/30 hover:bg-purple-500/25 hover:text-purple-200 text-purple-400/50 rounded transition-colors disabled:opacity-20">+৳{v}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── BETS LIST ── */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-purple-300/40"><span className="text-purple-200 font-bold">{onlineCount.toLocaleString()}</span> online</span>
              </div>
            </div>
            <div className="flex gap-0 mb-1.5">
              {(['all', 'my', 'top'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-1 text-[10px] sm:text-xs font-bold capitalize transition-colors ${
                  activeTab === tab ? 'bg-purple-600/20 text-purple-200 border-b-2 border-purple-400' : 'bg-transparent text-purple-400/40'
                }`}>{tab === 'all' ? 'All Bets' : tab === 'my' ? 'My Bets' : 'Top'}</button>
              ))}
            </div>
            <div className="bg-[#110e30]/80 rounded-xl border border-purple-500/10 p-2 backdrop-blur-sm">
              {activeTab === 'top' ? (
                <>
                  <div className="flex gap-1 mb-2">
                    {(['today','week','month'] as const).map(st => (
                      <button key={st} onClick={() => setTopSubTab(st)} className={`flex-1 py-0.5 text-[9px] sm:text-[10px] font-bold rounded transition-colors ${
                        topSubTab === st ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-400/50'
                      }`}>{st === 'today' ? 'Today' : st === 'week' ? 'Week' : 'Month'}</button>
                    ))}
                  </div>
                  <div className="text-[9px] text-purple-400/30 flex mb-1 px-1">
                    <span className="w-5">#</span><span className="flex-1">Player</span><span className="w-14 text-right">X</span><span className="w-16 text-right">Payout</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {(topSubTab === 'today' ? getTodayTopPlayers() : topSubTab === 'week' ? getWeekTopPlayers() : getMonthTopPlayers()).map((p, i) => (
                      <div key={p.id} className={`flex items-center py-1 px-1 text-[10px] sm:text-xs border-b border-purple-500/5 last:border-0 ${i < 3 ? 'bg-purple-500/5' : ''}`}>
                        <span className={`w-5 font-bold ${i < 3 ? 'text-amber-300' : 'text-purple-400/30'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                        <span className="flex-1 truncate text-purple-100 font-medium">{p.username}</span>
                        <span className="w-14 text-right text-purple-300 font-bold">{p.maxMultiplier.toFixed(2)}x</span>
                        <span className="w-16 text-right text-emerald-400 font-bold">৳{p.payout.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-purple-500/10">
                    <span className="text-purple-200 font-bold text-[10px] sm:text-xs">{activeTab === 'all' ? 'ALL BETS' : 'MY BETS'} <span className="text-purple-400/30">{activeTab === 'all' ? totalRoundPlayers.toLocaleString() : displayedBets.length}</span></span>
                    <span className="text-[9px] text-purple-400/30">💰 <span className="text-emerald-400 font-bold">৳{liveTotalBet.toLocaleString()}</span></span>
                  </div>
                  <div className="text-[9px] text-purple-400/25 flex mb-1 px-1">
                    <span className="flex-1">User</span><span className="w-14 text-right">Bet</span><span className="w-12 text-right">X</span><span className="w-16 text-right">Win</span>
                  </div>
                  {displayedBets.length === 0 && (
                    <p className="text-center text-purple-400/30 text-[10px] py-3">{gameState === 'waiting' ? 'Waiting...' : 'No bets'}</p>
                  )}
                  <div className="max-h-[200px] overflow-y-auto">
                    {displayedBets.map(b => (
                      <div key={b.id} className={`flex items-center py-1 px-1 text-[10px] sm:text-xs border-b border-purple-500/5 last:border-0 ${
                        b.status === 'cashed_out' ? 'bg-emerald-500/5' : b.status === 'lost' ? 'bg-red-500/3' : ''
                      }`}>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] ${b.isReal ? 'bg-purple-500' : 'bg-purple-900/50'} text-white shrink-0`}>{b.isReal ? '⭐' : '👤'}</div>
                          <span className={`truncate max-w-[60px] sm:max-w-[80px] ${b.isReal ? 'text-purple-200 font-bold' : 'text-purple-400/40'}`}>{b.username}</span>
                        </div>
                        <span className="w-14 text-right text-purple-400/40">৳{b.bet_amount.toLocaleString()}</span>
                        <span className={`w-12 text-right font-bold ${b.status === 'cashed_out' ? 'text-purple-300' : b.status === 'lost' ? 'text-red-400' : 'text-purple-400/30'}`}>
                          {b.status === 'cashed_out' && b.cashout_multiplier ? `${b.cashout_multiplier.toFixed(2)}x` : b.status === 'lost' ? '✗' : '•••'}
                        </span>
                        <span className={`w-16 text-right font-bold ${b.status === 'cashed_out' ? 'text-emerald-400' : b.status === 'lost' ? 'text-red-400/50' : 'text-purple-400/30'}`}>
                          {b.status === 'cashed_out' && b.win_amount ? `+৳${b.win_amount.toLocaleString()}` : b.status === 'lost' ? `-৳${b.bet_amount.toLocaleString()}` : '...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
};

export default RocketCrashGame;
