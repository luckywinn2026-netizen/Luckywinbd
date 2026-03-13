// Deterministic seeded random for fake leaderboard data
// Changes every 24h for "today", weekly for "this week", monthly for "this month"

const FAKE_NAMES = [
  'Shakib_BD', 'TamimPro', 'MushfiqWin', 'NasirStar', 'MahiKing',
  'RifatLuck', 'RakibX', 'FarhanGold', 'ArifulBet', 'KaziPro',
  'SultanWin', 'NabilAce', 'TonoyMax', 'ImranBD', 'SamirGold',
  'JoyKing', 'ShadowBet', 'TigerPro', 'NayeemX', 'RaselWin',
  'SakibStar', 'HasanLuck', 'MasudPro', 'SohagBD', 'ArifKing',
  'TuhinMax', 'RobiGold', 'FahadPro', 'ZahidWin', 'JahidBet',
  'SumonAce', 'PavelX', 'ShuvoBD', 'RonyKing', 'AlaminPro',
  'BiplabWin', 'ShohelMax', 'RubelGold', 'DidarBet', 'PrantoStar',
];

// Simple seeded PRNG
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getDaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getWeekSeed(): number {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() * 100 + weekNum;
}

function getMonthSeed(): number {
  const d = new Date();
  return d.getFullYear() * 100 + d.getMonth();
}

export type FakeTopPlayer = {
  id: string;
  username: string;
  maxMultiplier: number;
  payout: number;
  betAmount: number;
  rounds: number;
};

function generateTopPlayers(seed: number, count: number, multiplierRange: [number, number], payoutRange: [number, number]): FakeTopPlayer[] {
  const rng = seededRandom(seed);
  const shuffled = [...FAKE_NAMES].sort(() => rng() - 0.5);
  const players: FakeTopPlayer[] = [];

  for (let i = 0; i < count; i++) {
    const name = shuffled[i % shuffled.length];
    const maxMul = multiplierRange[0] + rng() * (multiplierRange[1] - multiplierRange[0]);
    const bet = [50, 100, 200, 500, 1000, 2000, 5000][Math.floor(rng() * 7)];
    const payout = Math.round(payoutRange[0] + rng() * (payoutRange[1] - payoutRange[0]));
    const rounds = Math.floor(5 + rng() * 50);

    players.push({
      id: `top-${seed}-${i}`,
      username: name,
      maxMultiplier: Math.round(maxMul * 100) / 100,
      payout,
      betAmount: bet,
      rounds,
    });
  }

  // Sort by payout descending
  players.sort((a, b) => b.payout - a.payout);
  return players;
}

export function getTodayTopPlayers(): FakeTopPlayer[] {
  return generateTopPlayers(getDaySeed() * 7 + 3, 20, [5, 85], [5000, 150000]);
}

export function getWeekTopPlayers(): FakeTopPlayer[] {
  return generateTopPlayers(getWeekSeed() * 13 + 7, 25, [15, 150], [25000, 500000]);
}

export function getMonthTopPlayers(): FakeTopPlayer[] {
  return generateTopPlayers(getMonthSeed() * 17 + 11, 25, [25, 300], [100000, 2000000]);
}

// Generate fake online count based on Bangladesh time (UTC+6)
// Night (8PM-2AM BDT) = peak 2000-3500, Day = 800-1800
// Changes every ~45-90 seconds randomly to feel organic
export function getFakeOnlineCount(): number {
  const now = Date.now();
  // Use varying interval (not exact minute) for randomness
  const intervalSeed = Math.floor(now / 47000); // ~47 second intervals
  const rng = seededRandom(intervalSeed);
  const jitterRng = seededRandom(intervalSeed + 7919); // second layer of randomness

  // Get Bangladesh hour (UTC+6)
  const bdHour = (new Date().getUTCHours() + 6) % 24;

  let base: number, range: number;

  if (bdHour >= 20 || bdHour < 2) {
    // Peak night: 8PM - 2AM BDT → 2000-3500
    base = 2000;
    range = 1500;
  } else if (bdHour >= 18 && bdHour < 20) {
    // Evening ramp-up: 6PM-8PM → 1500-2800
    base = 1500;
    range = 1300;
  } else if (bdHour >= 2 && bdHour < 6) {
    // Late night drop: 2AM-6AM → 500-1200
    base = 500;
    range = 700;
  } else if (bdHour >= 12 && bdHour < 18) {
    // Afternoon: 12PM-6PM → 1000-2000
    base = 1000;
    range = 1000;
  } else {
    // Morning: 6AM-12PM → 600-1400
    base = 600;
    range = 800;
  }

  // Add small random jitter so it never looks static
  const jitter = Math.floor(jitterRng() * 80) - 40; // ±40
  return Math.floor(base + rng() * range + jitter);
}
