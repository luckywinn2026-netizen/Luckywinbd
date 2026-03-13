# Super Ace – গভীর চেক রিপোর্ট (বাংলায়)

## চেক করা হয়েছে

### ১. Backend (superAceSpin.js)

| বিষয় | স্ট্যাটাস |
|-------|-----------|
| RNG (secureRandom) | ✅ crypto.randomFillSync ব্যবহার |
| Win distribution | ✅ mega ~1.67%, big ~2.5%, medium ~5%, small ~29%, loss ~62% |
| Bootstrap mode | ✅ পুল খালি/কম হলে জেতার টাকা ক্যাপ করা হয় |
| Pool capped | ✅ profit margin নিচে এলে loss |
| Grid generation | ✅ loss/small/medium/big/mega আলাদা গ্রিড |
| Cascade logic | ✅ Golden conversion, multiplier, controlledWinCap |
| Free spins | ✅ 3+ scatter → 10 free spins, retrigger 5 |
| settle_slot_spin RPC | ✅ wallet, game_sessions, super_ace_spin_logs আপডেট |
| get_game_stats RPC | ✅ per-game stats |

### ২. Frontend (SuperAceGame.tsx)

| বিষয় | স্ট্যাটাস |
|-------|-----------|
| API call | ✅ api.superAceSpin({ bet: stake }) |
| Grid display | ✅ initialGrid, cascadeSteps, finalGrid |
| Cascade animation | ✅ step-by-step win positions, payout |
| Win tier overlays | ✅ small/medium/big/mega |
| Free spin mode | ✅ session check, auto-trigger |
| Balance update | ✅ **ঠিক করা হয়েছে** – applyAuthoritativeBalance ব্যবহার |

### ৩. Database / Migrations

| বিষয় | স্ট্যাটাস |
|-------|-----------|
| settle_slot_spin | ✅ wallet, sessions, game_sessions, spin_logs |
| reward_pools | ✅ per-game (super-ace) |
| get_game_stats | ✅ game_sessions থেকে aggregate |

---

## যা ঠিক করা হয়েছে

### Balance Update
- **আগে:** শুধু `refreshBalance()` – DB থেকে আবার fetch
- **এখন:** `applyAuthoritativeBalance(result.newBalance)` – সার্ভারের পাঠানো মান দ্রুত UI-তে দেখায়

---

## সম্ভাব্য সতর্কতা

1. **Concurrent spins:** একই user একসাথে একাধিক spin দিলে race condition হতে পারে। `pg_advisory_xact_lock` settle_slot_spin-এ আছে।
2. **Free spin session:** একাধিক ট্যাবে খেললে session state ভুল হতে পারে – এক ট্যাবেই খেলা ভালো।

---

## Paytable (সংক্ষেপে)

- Spade/Heart/Club: 3→1, 4→2, 5→4
- Diamond: 3→1.2, 4→2.5, 5→5
- Jack: 3→1.5, 4→3, 5→6
- Queen: 3→2, 4→4, 5→8
- King: 3→2.5, 4→5, 5→10
- Ace: 3→4, 4→8, 5→20
- Joker: Wild
- Scatter: 3→5, 4→20, 5→100 (free spins trigger)
