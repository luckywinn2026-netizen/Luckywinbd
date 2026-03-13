# Lucky Bangla Play – Full Project Audit Report

## ১. Backend এবং UI Match (সব গেমের জন্য)

### ✅ Server outcome source of truth

| Game | Backend API | Win Amount | Status |
|------|-------------|------------|--------|
| **Lucky 777** | sharedSlotSpin | `winAmount`/`maxWinAmount` থেকে digits derive | ✅ Match |
| **Fortune Gems** | sharedSlotSpin | Outcome tier + mult দিয়ে gem count | ✅ Match |
| **Super Ace** | superAceSpin | Server থেকে full result (grid, totalWin) | ✅ Match |
| **Boxing King** | boxingKingSpin | `result.totalWin`, `result.winTier` | ✅ Match |
| **Golden Book** | sharedSlotSpin | `totalPayout` capped by `maxWinAmount` | ✅ Match |
| **Money Coming** | sharedSlotSpin | `totalWin` capped by `maxWinAmount` | ✅ Match |
| **Lucky Win** | sharedSlotSpin | `outcome.maxWinAmount` | ✅ Match |
| **Lucky Spin** | sharedSlotSpin | `betAmount × serverMultiplier` | ✅ Match |
| **Color Prediction** | colorPredictionRound | Server `payout`, `winning_number` | ✅ Match |
| **Classic Casino, Classic 777** | sharedSlotSpin | Win capped by `maxWinAmount` | ✅ Match |
| **Fruit Party, Fortune Wheel, Tropical Fruits** | sharedSlotSpin | Server outcome + cap | ✅ Match |

**নোট:** কিছু গেমে (Golden Book, Classic Casino) client-side random শুধু display-এর জন্য; payout সবসময় server `maxWinAmount` দিয়ে cap করা।

---

## ২. Small / Medium / Big / Mega Win – RTP, RNG, Profit Margin

### ✅ RTP ও Profit Margin (Admin-editable)

| Location | Description |
|----------|-------------|
| `game_profit_settings` table | Per-game: profit_margin, loss_rate, small/medium/big/jackpot win_pct, pool_pct |
| `AdminProfitSettings.tsx` | Admin UI – profit_margin, min_profit_margin, pool %, win % edit করা যায় |
| `gameOutcome.js:31-56` | `getGameProfitSettings(gameId)` – DB থেকে settings load |
| `gameOutcome.js:113-114` | `configMarginRatio = profit_margin/100` – RTP target = 100 - profit_margin |

### ✅ Win Tiers (small, medium, big, mega)

| Tier | Backend (gameOutcome.js) | Frontend (slotTierUtils.ts) |
|------|--------------------------|-----------------------------|
| small_win | mult 1.2–2x, pool small_win | ratio > 0, < 5 |
| medium_win | mult 2–5x, pool medium_win | ratio ≥ 5, < 10 |
| big_win | mult 10–30x, pool big_win | ratio ≥ 10, < 20 |
| mega_win | mult 50–200x, pool jackpot | ratio ≥ 20 |

### ✅ RNG (Cryptographically Secure)

| File | Implementation |
|------|-----------------|
| `gameOutcome.js:8-12` | `crypto.randomFillSync(arr)` |
| `superAceSpin.js` | `secureRandom()` – crypto |
| `boxingKingSpin.js` | `secureRandom()` – crypto |
| `colorPrediction.js` | `secureRandom()` – crypto |

### ✅ Reward Pools

- `reward_pools` table: small_win, medium_win, big_win, jackpot
- `distribute_bet_to_pools` RPC – bet থেকে pool-এ distribute
- `deduct_from_pool` RPC – win payout করার সময় deduct

---

## ৩. Spinning Speed, No Lag

### Spin Durations

| Game | Reel Spin | Notes |
|------|-----------|-------|
| Money Coming | 150 + reelIndex×50 ms (turbo: 100+30) | ✅ |
| Lucky 777 | 150 + reelIndex×50 ms | ✅ |
| Fortune Gems | ~200 ms min + cascade | ✅ |
| Fortune Wheel, Fruit Party, Classic Casino | 150 + reelIndex×50 ms | ✅ |
| Lucky Spin, Spin Wheel | ~1200 ms (CSS animation) | ✅ |

### No Blocking

- Outcome API call হয় spin শুরুতে বা আগে
- Animation `requestAnimationFrame` / `setTimeout` / `Promise` দিয়ে
- Main thread block করে না

---

## ৪. Admin Popular Games – Home Page

### ✅ Database

- `games.popular` column (boolean)
- Migration: `20260302082526_0369ce11-559d-4aaa-a7f6-6a9fff1d5f71.sql`

### ✅ Home Page (Index.tsx)

```ts
supabase.from('games')
  .select('game_id, name, thumbnail_url, game_type, popular')
  .eq('popular', true)
  .eq('is_active', true)
  .order('sort_order')
```

- শুধু `popular=true` এবং `is_active=true` games দেখায়

### ✅ Admin Panel (AdminGames.tsx)

- `togglePopular(game)` – `games.update({ popular: !game.popular })`
- UI: ⭐ POP button দিয়ে toggle

### Slots Page

- DB থেকে `popular` load করে; fallback হিসেবে default slots-এ `popular: true` আছে
- Merge: `popular: dbGame?.popular ?? slot.popular ?? false` – DB value প্রাধান্য পায়

---

## Summary

| Point | Status | Notes |
|-------|--------|------|
| 1. Backend–UI match | ✅ | সব গেমে server outcome source of truth |
| 2. RTP, RNG, profit margin | ✅ | Admin-editable, crypto RNG, pools safe |
| 3. Spinning speed, no lag | ✅ | ~150–300 ms per reel, no blocking |
| 4. Admin popular games | ✅ | `games.popular` + AdminGames toggle → Home page |
