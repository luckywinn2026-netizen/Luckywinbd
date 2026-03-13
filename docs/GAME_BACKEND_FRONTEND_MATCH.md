# Game-by-Game Backend–Frontend Match Check

প্রতিটি game এ frontend কোন API কল করছে এবং backend কি দিচ্ছে তার মিল আছে কিনা চেক।

---

## 1. Games using `POST /api/games/outcome` (api.gameOutcome)

Backend: `backend/src/routes/games.js` → `calculateOutcome(userId, bet_amount, game_type, game_id)`  
Settings: `game_profit_settings` থেকে `game_id` দিয়ে load; না থাকলে `DEFAULT_SETTINGS`।

| Frontend Component | game_id | game_type | Backend | game_profit_settings |
|--------------------|---------|-----------|---------|----------------------|
| **Slots** |
| LuckySpinGame | lucky-spin | slot | ✅ outcome + wheel multiplier logic | ✅ (migration) |
| Lucky777Game | lucky-777 | slot | ✅ | ✅ (original seed) |
| LuckyWinGame | lucky-win | slot | ✅ | ✅ (migration) |
| StarburstGame | starburst | slot | ✅ | ✅ (original seed) |
| MegaMoolahGame | mega-moolah | slot | ✅ | ✅ (original seed) |
| MoneyComingGame | money-coming | slot | ✅ | ✅ (original seed) |
| SpinWheelGame | spin-wheel | slot | ✅ | ✅ (migration) |
| Classic777Game | classic-777 | slot | ✅ | ✅ (original seed) |
| ClassicCasinoGame | classic-casino | slot | ✅ | ✅ (migration) |
| FortuneGemsGame | fortune-gems | slot | ✅ | ✅ (migration) |
| FortuneWheelGame | fortune-wheel | slot | ✅ | ✅ (migration) |
| BikeRacingGame | bike-racing | slot | ✅ | ✅ (migration) |
| FruitPartyGame | fruit-party | slot | ✅ | ✅ (original seed) |
| TropicalFruitsGame | tropical-fruits | slot | ✅ | ✅ (original seed) |
| GoldenBookGame | golden-book | slot | ✅ | ✅ (original seed) |
| BookOfDeadGame | book-of-dead | slot | ✅ | ✅ (original seed) |
| SlotGame (generic) | = route gameId | slot | ✅ | depends on route |
| **Crash** |
| AviatorCrashGame | aviator | crash | ✅ | ✅ (original seed) |
| RocketCrashGame | rocket | crash | ✅ | ✅ (original seed) |
| JetCrashGame | jet | crash | ✅ | ✅ (original seed) |
| TurboCrashGame | turbo | crash | ✅ | ✅ (migration) |
| ChickenRoadGame | chicken-road | crash | ✅ | ✅ (original seed) |
| MultiplierXGame → CrashGame | multi | crash | ✅ | ✅ (migration) |
| **Ludo** |
| LudoKingGame | ludo-king | ludo | ✅ | ✅ (original seed) |

সবগুলো **match**। Backend কোনো game_id এ row না পেলে code এর `DEFAULT_SETTINGS` use করে।

---

## 2. Color Prediction – `POST /api/games/color-prediction-outcome`

| Frontend | Backend | Settings |
|----------|---------|----------|
| ColorPredictionGame → api.colorPredictionOutcome({ bet_amount, bet_type, bet_value, period_id }) | computeOutcome(userId, …) in colorPrediction.js; game_id = `'color-prediction'` | game_profit_settings এ row না থাকলে default object use করে। migration এ **color-prediction** add করা হয়েছে যাতে admin একই UI থেকে tune করতে পারে। |

**Match**।

---

## 3. Boxing King (Sweet Bonanza) – `POST /api/games/boxing-king-spin`

| Frontend | Backend |
|----------|---------|
| SweetBonanzaGame → api.boxingKingSpin({ bet }) | **501 stub** – “Not implemented in backend yet” |

**Mismatch**: Backend এ full logic port করা নেই। Frontend 501 পেলে error দেখায়। চালাতে হলে Supabase Edge Function `boxing-king-spin` logic backend এ port করতে হবে অথবা frontend থেকে সেই Edge Function call করতে হবে (বর্তমান আর্কিটেকচার অনুযায়ী backend দিয়েই যাওয়া উচিত)।

---

## 4. Super Ace (Sweet Bonanza 2) – `POST /api/games/super-ace-spin`

| Frontend | Backend |
|----------|---------|
| SweetBonanza2Game → api.superAceSpin({ bet }) | **501 stub** – “Not implemented in backend yet” |

**Mismatch**: একই ব্যাপার। Full spin logic backend এ নেই।

---

## 5. Crash round (RNG/sync) – RPC `get_or_create_crash_round`

| Frontend | Backend |
|----------|---------|
| useCrashRound(gameId) → api.rpc('get_or_create_crash_round', { p_game_id: gameId }) | Supabase RPC `get_or_create_crash_round` (migration এ define) |

Backend Express শুধু RPC proxy করে (`/api/rpc/:name`)। **Match**।

---

## 6. game_profit_settings coverage

- **Original seed (20260223092704):** lucky-777, classic-777, fruit-party, sweet-bonanza, sweet-bonanza-2, golden-book, book-of-dead, starburst, mega-moolah, money-coming, tropical-fruits, aviator, rocket, jet, chicken-road, ludo-king  
- **Migration 20260308200000:** super-ace, lucky-spin, lucky-win, fortune-gems, fortune-wheel, classic-casino, spin-wheel, bike-racing, turbo, multi, **color-prediction**

সব frontend game_id এর জন্য হয় seed/migration এ row আছে, নয়তো backend code default use করছে। তাই **সব game backend–frontend match** (শুধু boxing-king ও super-ace backend এ stub)।

---

## Summary

| Category | Status |
|----------|--------|
| All games using `/api/games/outcome` | ✅ Frontend ও backend match; game_id অনুযায়ী settings apply |
| Color Prediction | ✅ Match; color-prediction row migration এ add |
| Boxing King (sweet-bonanza) | ⚠️ Backend 501 stub – logic port করতে হবে |
| Super Ace (sweet-bonanza-2) | ⚠️ Backend 501 stub – logic port করতে হবে |
| Crash round RPC | ✅ Match |

**Recommendation:** Boxing King ও Super Ace খেলাতে চাইলে `supabase/functions/boxing-king-spin` ও `supabase/functions/super-ace-spin` এর logic Node backend এ port করে `/api/games/boxing-king-spin` ও `/api/games/super-ace-spin` এ লাগিয়ে দিন।
