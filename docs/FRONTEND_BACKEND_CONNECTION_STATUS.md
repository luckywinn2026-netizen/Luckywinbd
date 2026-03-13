# Frontend ↔ Backend Connection Status

## বর্তমান অবস্থা: Frontend **শুধু পুরনো Supabase** use করছে

- Frontend **কোনো জায়গায় Node backend (VITE_API_URL) call করছে না।**
- সব ডেটা ও লজিক **সরাসরি Supabase** এ যাচ্ছে (database + Auth + Edge Functions + RPC)।

---

## যা চেক করা হয়েছে

### 1. VITE_API_URL

- `.env` এ আছে: `VITE_API_URL=http://localhost:4000`
- **কোনো `src` ফাইলে ব্যবহার হয়নি** – কোথাও `import.meta.env.VITE_API_URL` বা backend URL দিয়ে fetch নেই।

### 2. Frontend কোথায় কি use করছে

| কাজ | এখন কোথায় যাচ্ছে | Backend এ আছে কিনা |
|-----|---------------------|---------------------|
| Database (tables) | `supabase.from('...').select/insert/update` | সরাসরি Supabase |
| RPC (adjust_wallet_balance, has_role, get_leaderboard ইত্যাদি) | `supabase.rpc('...')` | সরাসরি Supabase |
| Game outcome (slot/crash) | `supabase.functions.invoke('game-outcome', ...)` | Supabase Edge Function |
| Color prediction | `supabase.functions.invoke('color-prediction-outcome', ...)` | Supabase Edge Function |
| Boxing King / Super Ace | `supabase.functions.invoke('boxing-king-spin', 'super-ace-spin', ...)` | Supabase Edge Function |
| Admin: set password | `fetch(SUPABASE_URL/functions/v1/admin-set-password)` | Supabase Edge Function |
| Admin: approve agent | `fetch(SUPABASE_URL/functions/v1/approve-agent)` | Supabase Edge Function |
| Auth (login/signup/session) | `supabase.auth.*` | Supabase Auth |

### 3. Supabase client

- `src/integrations/supabase/client.ts` শুধু **VITE_SUPABASE_URL** ও **VITE_SUPABASE_PUBLISHABLE_KEY** দিয়ে client বানায়।
- তাই সব `supabase.from()`, `supabase.rpc()`, `supabase.functions.invoke()` সরাসরি **Supabase project** এ যাচ্ছে।

---

## উপসংহার

- **Frontend এখনো পুরনো সেটআপেই আছে:** শুধু Supabase (database + auth + Edge Functions + RPC)।
- **আমাদের বানানো Node backend (port 4000) frontend এর সাথে যুক্ত নয়।**
- তাই আপনি ঠিক দেখছেন: **frontend এখনো “old” database (এবং পুরো Supabase) use করছে;** backend use করছে না।

---

## Backend এর সাথে যুক্ত করতে কি করতে হবে

1. **API base URL:** Frontend এ `VITE_API_URL` use করে একটা API helper (যেমন `src/lib/api.ts`) বানাতে হবে।
2. **Game / RPC / Admin কলগুলো backend দিয়ে পাঠানো:**
   - `supabase.functions.invoke('game-outcome', ...)` → `POST ${VITE_API_URL}/api/games/outcome` (Bearer token সহ)
   - `supabase.functions.invoke('color-prediction-outcome', ...)` → `POST ${VITE_API_URL}/api/games/color-prediction-outcome`
   - `supabase.rpc('adjust_wallet_balance', ...)` ইত্যাদি → `POST ${VITE_API_URL}/api/rpc/adjust_wallet_balance` (body + Bearer)
   - Admin set-password / approve-agent → `POST ${VITE_API_URL}/api/admin/set-password` ও `/api/admin/approve-agent`
3. **Database read:** চাইলে আগের মতোই Supabase client দিয়ে থাকতে পারে (শুধু DB), অথবা কিছু read ও backend দিয়ে proxy করা যাবে।

এভাবে করলে frontend **backend connected** হবে এবং backend শুধু database এর জন্য Supabase use করবে।
