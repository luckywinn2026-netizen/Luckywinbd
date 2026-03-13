# Supabase Functions ও RPC সারাংশ

আপনি শুধু **database** এর জন্য Supabase ব্যবহার করবেন। সব business logic এখন **Node.js backend** এ থাকবে।

---

## Supabase `functions` ফোল্ডারে যা আছে (৭টি Edge Function)

| Function | বর্ণনা |
|----------|--------|
| **admin-set-password** | Admin কোনো user এর password set করে। `has_role(admin)` চেক, তারপর `auth.admin.updateUserById`. |
| **approve-agent** | Admin agent application approve করে: user create/update, `payment_agent` role, agent_wallets, application status update. |
| **boxing-king-spin** | Boxing King slot game: bet, profit settings, forced result, grid/cascade/free spins, wallet ও game_sessions update. |
| **color-prediction-outcome** | Color prediction game outcome: profit pool, killing streak, winning number/color, payout calculate. |
| **game-outcome** | Generic game outcome (slot/crash): pool-based RNG, reward pools, forced result, distribute_bet_to_pools, deduct_from_pool. |
| **super-ace-spin** | Super Ace slot: bet, profit settings, grid/cascade/golden joker, free spins, wallet ও game_sessions. |
| **sync-game-stats** | `game_sessions` থেকে total_bets/total_wins হিসাব করে `game_stats_summary` তে update করে। |

---

## Frontend / Functions থেকে ব্যবহৃত RPC (Database functions)

এগুলো **migrations** এ define; backend এটা call করবে (Supabase client দিয়ে)।

| RPC | ব্যবহার |
|-----|---------|
| `has_role(_user_id, _role)` | Admin / moderator / payment_agent / agent চেক |
| `get_total_bets_and_wins()` | Global total bets ও wins |
| `get_leaderboard(time_range)` | Leaderboard (daily/weekly/all) |
| `adjust_wallet_balance(p_user_id, p_amount)` | ওয়ালেট ব্যালান্স +/- |
| `add_vip_points(p_user_id, p_points, p_bet_amount)` | VIP পয়েন্ট যোগ |
| `claim_cashback(p_user_id)` | ক্যাশব্যাক ক্লেইম |
| `try_daily_spin(p_user_id)` | দৈনিক স্পিন অনুমতি |
| `get_or_create_crash_round(p_game_id)` | ক্র্যাশ গেম রাউন্ড |
| `assign_agent_to_conversation(p_conversation_id)` | চ্যাটে এজেন্ট অ্যাসাইন |
| `settle_cyber_market(p_market_id, p_result_key)` | সাইবার মার্কেট সেটল |
| `settle_cyber_match(p_match_id, p_result)` | সাইবার ম্যাচ সেটল |
| `auto_settle_cyber_match(p_match_id)` | অটো সেটল ম্যাচ |
| `process_agent_deposit(...)` | এজেন্ট ডিপজিট প্রসেস |
| `process_agent_withdrawal_approval(...)` | এজেন্ট উইথড্রল অ্যাপ্রুভ |
| `approve_agent_settlement(p_settlement_id, p_admin_id)` | সেটলমেন্ট অ্যাপ্রুভ |
| `pay_agent_commission(p_admin_id, p_agent_id)` | এজেন্ট কমিশন পে |
| `record_agent_commission(...)` | কমিশন রেকর্ড |
| `load_agent_balance(p_agent_user_id, p_amount)` | এজেন্ট ব্যালান্স লোড |
| `get_approved_deposit_total()` | অ্যাপ্রুভড ডিপজিট টোটাল |
| `get_approved_withdrawal_total()` | অ্যাপ্রুভড উইথড্রল টোটাল |
| `get_total_bets_and_wins()` | টোটাল বেটস/উইনস |
| `get_session_stats_by_range(p_start)` | রেঞ্জ অনুযায়ী সেশন স্ট্যাটস |
| `get_per_game_stats_by_range(p_start)` | গেমওয়াইজ স্ট্যাটস |
| `get_profit_chart_data(p_start, p_period)` | প্রফিট চার্ট ডেটা |
| `distribute_bet_to_pools(...)` | বেট রিওয়ার্ড পুলে ভাগ (game-outcome) |
| `deduct_from_pool(p_pool_type, p_amount)` | পুল থেকে টাকা কাট (game-outcome) |

---

## Backend এ কি করবে

- **Supabase** শুধু Database (ও optional Auth)। Backend `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` দিয়ে DB এক্সেস করবে।
- উপরের **৭টি Edge Function** এর লজিক **Node.js API** এ নিয়ে যাবে (একই রিকোয়েস্ট/রেসপন্স)।
- **RPC** গুলো frontend থেকে সরাসরি না ডেকে backend এর API call করবে; backend নিজে `supabase.rpc()` দিয়ে DB functions call করবে।

---

## তৈরি Node.js Backend (`backend/`)

- **RPC proxy:** `POST /api/rpc/:name` – body তে params দিলে backend Supabase এ RPC call করে।
- **Admin:** `POST /api/admin/set-password`, `POST /api/admin/approve-agent` (পোর্ট করা হয়েছে)।
- **Stats:** `POST /api/stats/sync-game-stats` (পোর্ট করা হয়েছে)।
- **Games:**  
  - `POST /api/games/outcome` – পোর্ট করা হয়েছে।  
  - `POST /api/games/color-prediction-outcome` – পোর্ট করা হয়েছে।  
  - `POST /api/games/boxing-king-spin`, `POST /api/games/super-ace-spin` – এখনো stub (৫০১); পরে Supabase থেকে logic নিয়ে পোর্ট করতে হবে।

বিস্তারিত: `backend/README.md` দেখুন।
