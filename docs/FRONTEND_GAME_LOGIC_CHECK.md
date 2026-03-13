# Frontend এ Game Logic চেক

## সারাংশ

- **অধিকাংশ গেম:** Win/loss ও টাকার হিসাব **server** থেকে আসে (Supabase Edge Functions / backend)। Frontend শুধু outcome দেখায় ও অ্যানিমেশন করে।
- **একটা জায়গায় আসল game logic frontend এ আছে:** **Daily Spin Wheel** (SpinWheelPage)। সেখানে কোন প্রাইজ হবে সেটা **ক্লায়েন্টই** ঠিক করে।

---

## ১. Server-authoritative (সব ঠিক আছে)

| জায়গা | কী করে | কোথায় outcome |
|--------|--------|------------------|
| Slot games (বেশিরভাগ) | `supabase.functions.invoke('game-outcome', …)` | Server outcome + maxWinAmount দেয়; frontend শুধু display/random cap করে |
| Boxing King (Sweet Bonanza) | `supabase.functions.invoke('boxing-king-spin', …)` | Server পুরো spin + win দেয় |
| Super Ace | `supabase.functions.invoke('super-ace-spin', …)` | Server পুরো spin + win দেয় |
| Color Prediction | `supabase.functions.invoke('color-prediction-outcome', …)` | Server winning_number, payout দেয় |
| Crash games | `get_or_create_crash_round` RPC + game-outcome | Crash point ও win server থেকে |

এগুলোর **টাকা/জয়** সব server থেকে; frontend এ শুধু অ্যানিমেশন/display এর জন্য কিছু `Math.random()` আছে।

---

## ২. Frontend এ game logic আছে (ঠিক করা দরকার)

### Daily Spin Wheel – `src/pages/SpinWheelPage.tsx`

- **কী হয়:**  
  - Server শুধু `try_daily_spin` RPC দিয়ে চেক করে যে ইউজার আজ spin নিতে পারবে কিনা।  
  - **কোন প্রাইজ (Try Again, ৳100 Free Bet, ৳500 Cashback ইত্যাদি) হবে সেটা frontend এ ঠিক হয়** – `pickWeightedIndex()` এ `Math.random()` দিয়ে segment pick করা হয়।
- **সমস্যা:** প্রাইজ পুরোই ক্লায়েন্ট সাইডে। কেউ ডেভটুলস/ম্যানিপুলেশন করে সব সময় ভালো প্রাইজ পেতে পারে, এবং `addWin(prize.value)` / VIP পয়েন্ট দিয়ে আসল ব্যালান্স/পয়েন্ট বেড়ে যায়।
- **করণীয়:** প্রাইজ ঠিক করা **backend/API** এ নিয়ে যাওয়া উচিত। যেমন:  
  - Frontend শুধু “spin করছি” রিকোয়েস্ট পাঠাবে।  
  - Backend `try_daily_spin` চেক করে, তারপর **server-side weighted random** দিয়ে প্রাইজ ঠিক করবে এবং DB/ওয়ালেট আপডেট করবে।  
  - Response এ শুধু `{ prize_index }` বা `{ prize }` দিলে frontend শুধু সেই অনুযায়ী ঘূর্ণন/প্রাইজ দেখাবে।

---

## ৩. শুধু display / cap (টাকা server-authoritative)

- **useMultiplierSettings / pickSpecialIdxFromSettings**  
  - Admin এর multiplier_settings অনুযায়ী ৪র্থ রিলের symbol (1x, 2x, wild ইত্যাদি) frontend এ weighted random দিয়ে পিক হয়।  
  - আসল জয়ের পরিমাণ **server এর maxWinAmount** দিয়ে cap করা। তাই **টাকা server-authoritative**, শুধু দেখানোর সিম্বল ক্লায়েন্ট পিক করে।

- **SlotGame.tsx**  
  - outcome tier অনুযায়ী multiplier range frontend এ `Math.random()` দিয়ে নেওয়া হয়, কিন্তু **win amount সর্বোচ্চ outcome.maxWinAmount** দিয়ে ক্যাপ করা। তাই টাকা আবারও server-authoritative।

---

## ৪. উপসংহার

- **হ্যাঁ, frontend এ একটা জায়গায় game logic আছে:** শুধু **Daily Spin Wheel** – সেখানে কোন প্রাইজ হবে সেটা ক্লায়েন্ট ঠিক করছে।  
- বাকি গেমগুলোতে win/loss ও টাকার হিসাব server থেকে আসে; frontend এ যে random আছে সেগুলো display/cap এর জন্য।

Spin Wheel টা backend/API এ নিয়ে প্রাইজ সিদ্ধান্ত server এ দিলেই সব ঠিক হয়ে যাবে।
