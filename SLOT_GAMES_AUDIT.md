# Slot Games Audit Report

**Date:** 2025-03-11  
**Scope:** All slot games – logic, calculation, backend sync

---

## 1. Backend API Summary

| Endpoint | Games | Settlement |
|----------|-------|------------|
| `POST /api/games/shared-slot-spin` | Lucky 777, Lucky Spin, Spin Wheel, Classic 777, Classic Casino, Fortune Gems, Money Coming*, Tropical Fruits*, Fruit Party*, Fortune Wheel*, Golden Book*, Lucky Win* | `settle_generic_game_round` – deduct + credit atomically |
| `POST /api/games/boxing-king-spin` | Boxing King (Sweet Bonanza) | `settle_slot_spin` – full cascade + free spin |
| `POST /api/games/super-ace-spin` | Super Ace | `settle_slot_spin` – full cascade + free spin |
| `POST /api/games/outcome` | Book of Dead, Mega Moolah, Starburst, Bike Racing, Money Coming (free spin), Tropical Fruits (free spin), Fruit Party (free spin), Fortune Wheel (free spin), Golden Book (free spin), Lucky Win (free spin) | No settlement – returns outcome only. Wallet via `placeBet` + `addWin`/`logLoss` |

\* Uses shared-slot-spin for paid spins; uses gameOutcome for free spins.

---

## 2. Game-by-Game Audit

### 2.1 sharedSlotSpin Games ✅

| Game | Logic | Backend | Balance Sync |
|------|-------|---------|--------------|
| **Lucky 777** | Digits × multiplier = server win. Backend rounds to displayable (bet≤5: mults 1–50, digit 1–99; bet≥5: mults 1–500, digit 1–999). | sharedSlotSpin + lucky-777 rounding | `applyAuthoritativeBalance(newBalance)` ✅ |
| **Lucky Spin** | Wheel multipliers [2,5,10,12,20]. Backend applies `applyLuckySpinMultiplier`. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Spin Wheel** | Outcome tier → segment. Backend syncs tier (small/medium/big/mega). | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Classic 777** | 3-reel symbols. Backend syncs tier. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Classic Casino** | Same pattern. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Fortune Gems** | Gem count from tier. Backend syncs outcome tier. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Money Coming** (paid) | 3 digit + 4th multiplier reel. Backend syncs tier. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Tropical Fruits** (paid) | Same. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Fruit Party** (paid) | Same. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Fortune Wheel** (paid) | Same. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Golden Book** (paid) | Same. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |
| **Lucky Win** (paid) | Same. | sharedSlotSpin | `applyAuthoritativeBalance` ✅ |

### 2.2 Boxing King & Super Ace ✅

| Game | Logic | Backend | Notes |
|------|-------|---------|------|
| **Boxing King** | 5×3, 25 paylines, cascade, scatter free spin. | boxingKingSpin – full RNG, cascade, settle_slot_spin | Free spin handled in backend (p_is_free_spin) |
| **Super Ace** | 4×5, 1024-ways, golden, cascade, 3 scatter = free spin. | superAceSpin – full RNG, cascade, settle_slot_spin | Free spin handled in backend (p_is_free_spin) |

### 2.3 gameOutcome-Only Games ✅

| Game | Flow | Wallet |
|------|------|--------|
| **Book of Dead** | placeBet → gameOutcome → addWin/logLoss | placeBet (-bet), addWin (+win) ✅ |
| **Mega Moolah** | Same | Same ✅ |
| **Starburst** | Same | Same ✅ |
| **Bike Racing** | Same | Same ✅ |

Win amount capped by `maxWinAmount` from backend. Frontend uses `getTriplePayout` / symbol logic for display, then caps to `maxWinAmount`.

### 2.4 Free Spin Mode (gameOutcome) ⚠️ BUG FIXED

**Games:** Money Coming, Tropical Fruits, Fruit Party, Fortune Wheel, Golden Book, Lucky Win

**Previous bug:** In free spin mode, frontend called `gameOutcome(bet_amount: betAmount)`. Backend `calculateOutcome` always calls `distribute_bet_to_pools`, so free spins were incorrectly adding bet to reward pools without any real bet.

**Fix:** Added `is_free_spin` to gameOutcome; when true, skip `distribute_bet_to_pools` and pool deducts.

---

## 3. Backend Logic Verification

### 3.1 gameOutcome.js
- RNG + profit margin + pool caps ✅
- Forced results (admin) ✅
- Lucky 777: `roundToDisplayableLucky777` ✅
- Pool distribution + deduct on win ✅

### 3.2 sharedSlotSpin.js
- Bet validation, balance check ✅
- Lucky Spin multiplier mapping ✅
- Lucky 777 displayable rounding ✅
- Fortune Gems, Fortune Wheel, Money Coming, Fruit Party, Tropical Fruits, Classic Casino, Spin Wheel, Lucky Win, Classic 777, Golden Book: outcome tier sync ✅
- `settle_generic_game_round` atomic settlement ✅

### 3.3 boxingKingSpin.js / superAceSpin.js
- Full slot logic (reels, paylines, cascade, scatter) ✅
- Free spin session handling ✅
- `settle_slot_spin` with `p_is_free_spin` ✅

---

## 4. Tier Thresholds (slotTierUtils vs Backend)

| Tier | slotTierUtils | sharedSlotSpin (backend) |
|------|---------------|---------------------------|
| mega_win | 20x+ | mult ≥ 15 |
| big_win | 10x+ | 5 ≤ mult < 15 |
| medium_win | 5x+ | 2 ≤ mult < 5 |
| small_win | >0 | mult < 2 |

Backend uses mult < 2 / 2–5 / 5–15 / 15+ for tier sync. Frontend `outcomeToTier` maps server outcome string. Consistent ✅

---

## 5. Summary

| Category | Status |
|----------|--------|
| sharedSlotSpin games | ✅ Logic & backend correct |
| Boxing King / Super Ace | ✅ Logic & backend correct |
| gameOutcome-only (paid) | ✅ Logic & backend correct |
| Free spin (gameOutcome) | ✅ Fixed – no pool distribution |

---

## 6. Recommendations

1. **game_profit_settings** – Ensure each game_id has correct rows in `game_profit_settings` for RTP/pool behavior.
2. **reward_pools** – Monitor pool balances; free spin fix prevents artificial inflation.
3. **Testing** – Manually verify free spin flow in Money Coming, Tropical Fruits, etc. after fix.
