# Money Coming Slot Game – Logic ও Flow রিপোর্ট

## ১. গেম কি দিয়ে তৈরি

- **ফাইল:** `src/games/slots/money-coming/MoneyComingGame.tsx`
- **টাইপ:** ৩ ডিজিট রিল (০–৯) + ৪র্থ রিলে স্পেশাল (1x, 2x, …, 500x, WILD, SCATTER)
- **পayout:** `(৩ ডিজিটের সংখ্যা) × (৪র্থ রিলের মাল্টিপ্লায়ার)` = জয়ের পরিমাণ (৳)

---

## ২. Spin এ কি কি ধাপে হয় (step-by-step)

### Step 1: User Spin ক্লিক করে

- `spin()` চালু হয়।
- Min bet চেক: `betAmount >= 0.5`।
- **Normal spin:** `placeBet(betAmount, 'Money Coming', 'slot')` → ব্যালান্স থেকে টাকা কাটে এবং DB তে `adjust_wallet_balance(-amount)` + `add_vip_points` কল হয়।
- Free spin মোডে বেট কাটা হয় না।

### Step 2: Server থেকে outcome নেওয়া

```ts
const { data } = await supabase.functions.invoke('game-outcome', {
  body: { bet_amount: betAmount, game_type: 'slot', game_id: 'money-coming' },
});
outcome = { outcome: 'loss' | 'small_win' | 'medium_win' | 'big_win' | 'mega_win', maxWinAmount: number }
```

- **Win/loss সিদ্ধান্ত পুরো server (game-outcome Edge Function) থেকে।**
- `outcome.outcome` = জিতেছে নাকি হেরেছে + কোন টিয়ার।
- `outcome.maxWinAmount` = server যে সর্বোচ্চ জয় দেবে তার সিলিং; frontend এর জয় এটা দিয়ে cap করা হয়।

### Step 3: Free spin এ cap

- Free spin মোডে জয় থাকলে:  
  `maxWinAmount = Math.min(maxWinAmount, betAmount * 3)`  
  অর্থাৎ ফ্রি স্পিনে জয় সীমিত।

### Step 4: Bet tier অনুযায়ী “কয়টা রিল সচল”

- `getActiveReelCount(betAmount)`:
  - ৳5: ১ রিল (শুধু ৩য় ডিজিট সচল, বাকি ০)
  - ৳10: ২ রিল (২য় + ৩য় সচল, ১ম = ০)
  - ৳20+: ৩ রিলই সচল

### Step 5: ৪র্থ রিলের সিম্বল (স্পেশাল) পিক করা

- **কোন সিম্বল (1x, 2x, …, 500x, WILD, SCATTER) দেখাবে সেটা frontend ঠিক করে**, কিন্তু পরবর্তীতে জয় **server এর maxWinAmount** দিয়ে cap করা হয়।

লজিক সংক্ষেপে:

- **mega_win:** ৪র্থ রিল = 25x / 100x / 200x এর মধ্যে র‍্যান্ডম।
- **big_win:** ৪র্থ রিল = 3x / 5x এর মধ্যে র‍্যান্ডম।
- **Free spin:** ৩, ৪, ৫, ৬, ৯ (কিছু মাল্টিপ্লায়ার/স্পেশাল) র‍্যান্ডম।
- **Bet tier ১ রিল (৳5):** শুধু 1x, 2x, 3x এর মধ্যে র‍্যান্ডম।
- **Bet tier ২ রিল (৳10):** 1x–10x ওয়েটেড র‍্যান্ডম।
- **Bet tier ৩ রিল (৳20+):** `getMultiplierSettings()` + `pickSpecialIdxFromSettings(ms)` → DB (multiplier_settings) অনুযায়ী weighted random।

Loss এ ৩০% চান্সে “tease” হিসেবে ৪র্থ রিলে 500x দেখায় (কিন্তু পayout ০)।

### Step 6: ৪র্থ রিল server cap এর ভিতরে রাখা

- `hardCap = outcome.maxWinAmount` (জয় না হলে ০)।
- ৪র্থ রিলের মাল্টিপ্লায়ার এত বড় হলে যাতে (অন্তত ১ × mult) cap ছাড়িয়ে না যায়, সেটা চেক করা হয়; নাহলে নিচের দিকের মাল্টিপ্লায়ারে নামিয়ে আনা হয় (যাতে দেখানো জয় কখনো hardCap ছাড়ায় না)।

### Step 7: ৩ ডিজিট (রিল ১–৩) জেনারেট করা

- **Loss:** সবসময় `[0, 0, 0]` → দেখায় 000, পayout ০।
- **Win:**  
  - outcome tier অনুযায়ী একটা `targetNumber` নেওয়া হয় (র‍্যান্ডম রেঞ্জ, কিন্তু `maxCombined` এর নিচে; maxCombined = hardCap / effectiveMult)।  
  - তার থেকে `finalDigits = [শতক, দশক, একক]` বের করা হয়।  
  - Bet tier ১/২ এর জন্য যথাক্রমে প্রথম এক/দুই ডিজিট ০ ফিক্স করা হয়।

অর্থাৎ **যে ৩ ডিজিট দেখাবে সেটা frontend র‍্যান্ডম জেনারেট করে**, কিন্তু এমন ভাবে যে `(সংখ্যা × ৪র্থ রিল মাল্টিপ্লায়ার)` কখনোই server এর `maxWinAmount` ছাড়ায় না।

### Step 8: রিল স্টেট আপডেট + অ্যানিমেশন

- `setReelDigits(finalDigits)`, `setSpecialIdx(specialResult)`, `setSpinId(...)`।
- ৪টা রিল এক এক করে থামে; প্রতিটি থামলে `handleReelStop()` → `setStoppedReels(prev => prev + 1)`।

### Step 9: সব রিল থামার পর evaluation (useEffect, stoppedReels === 4)

- `outcomeRef.current` (server outcome) দিয়ে প্রথমেই চেক:
  - **`outcome === 'loss'`** → পayout = ০, `handleLoss()` → `logLoss(...)` + game_sessions এ loss insert।
  - **Win** হলে:
    - ৩ ডিজিট থেকে সংখ্যা: `combinedNumber = d1*100 + d2*10 + d3`।
    - ৪র্থ রিল থেকে মাল্টিপ্লায়ার (mult), WILD হলে আগে spin এ ঠিক করা `wildMultRef.current` ব্যবহার।
    - `totalWin = combinedNumber × mult`।
    - **হার্ড ক্যাপ:** `cappedWin = min(totalWin, outcome.maxWinAmount)`।  
      অর্থাৎ **যতই ডিজিট/মাল্টিপ্লায়ার দেখাক, ইউজার পায় সর্বোচ্চ server এর maxWinAmount।**
    - `processWin(cappedWin)` → `addWin(cappedWin, ...)`।

### Step 10: ওয়ালেট ও DB আপডেট

- **addWin(cappedWin, …):**
  - Local state: balance += cappedWin।
  - `supabase.rpc('adjust_wallet_balance', { p_user_id, p_amount: cappedWin })`।
  - `game_sessions` এ insert: bet_amount, win_amount = cappedWin, result = 'win', multiplier, game_id = 'money-coming'।
- **logLoss(...):**
  - শুধু `game_sessions` এ insert: result = 'loss', win_amount = 0।

---

## ৩. সংক্ষেপে কে কি ঠিক করে

| জিনিস | কোথায় ঠিক হয় | মন্তব্য |
|--------|------------------|----------|
| জিতবে নাকি হারবে + max জয় কত | **Server** (game-outcome) | পুরো নিয়ন্ত্রণ server এ |
| সর্বোচ্চ যে টাকা ইউজার পাবে | **Server** (maxWinAmount) | Frontend কখনো এটা ছাড়িয়ে দেয় না |
| ৩ ডিজিট (কি সংখ্যা দেখাবে) | **Frontend** | Server এর cap এর ভিতরে রেখে র‍্যান্ডম |
| ৪র্থ রিলের সিম্বল (1x, 2x, …, WILD, SCATTER) | **Frontend** | DB multiplier_settings + outcome tier অনুযায়ী; আবার cap দিয়ে ক্লিপ করা |
| স্ক্যাটার → ১০ ফ্রি স্পিন | **Frontend** | লজিক frontend; ফ্রি স্পিনে জয় cap (bet×3) frontend এ |
| ব্যালান্স কাটা / জয় যোগ / game_sessions | **WalletContext** (Supabase RPC + insert) | placeBet → adjust_wallet_balance(-), addWin → adjust_wallet_balance(+), game_sessions |

---

## ৪. সুরক্ষা (টাকার দিক থেকে)

- **জয়ের পরিমাণ:** সবসময় `outcome.maxWinAmount` দিয়ে cap; তাই ক্লায়েন্ট কখনো server এর চেয়ে বেশি জয় দিতে পারবে না।
- **জয়/হার সিদ্ধান্ত:** পুরোটা server (game-outcome) থেকে; frontend শুধু দেখানোর জন্য ডিজিট ও ৪র্থ রিল পিক করে।

---

## ৫. এক নজরে ফ্লো

```
User Spin ক্লিক
  → placeBet (balance কাটা + adjust_wallet_balance RPC)
  → game-outcome invoke (server outcome + maxWinAmount)
  → ৪র্থ রিল সিম্বল পিক (outcome tier + bet tier + DB settings, cap দিয়ে ক্লিপ)
  → ৩ ডিজিট জেনারেট (outcome অনুযায়ী, maxWinAmount cap এর ভিতরে)
  → রিল অ্যানিমেশন, এক এক করে থামা
  → stoppedReels === 4 হলে evaluation
       → loss: logLoss, game_sessions (loss)
       → win: totalWin = digits × mult, cappedWin = min(totalWin, maxWinAmount)
               addWin(cappedWin) → adjust_wallet_balance(+) + game_sessions (win)
```

এই লজিক অনুযায়ী Money Coming গেম **টাকার দিক থেকে server-authoritative**; frontend শুধু ভিজ্যুয়াল ও cap এর ভিতরে র‍্যান্ডম জেনারেট করে।
