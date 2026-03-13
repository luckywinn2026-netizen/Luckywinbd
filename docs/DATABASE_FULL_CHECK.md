# Full Database Check – Age Theke Ki Ki Ache

Supabase migrations দিয়ে যে ডাটাবেস স্ট্রাকচার ও seed ডাটা আগে থেকেই আছে সেটার পূর্ণ তালিকা।

---

## 1. Custom Types (Enum)

| Type        | Values |
|------------|--------|
| `app_role` | `admin`, `moderator`, `user`, `payment_agent`, `agent` |

*(প্রথমে শুধু admin/moderator/user ছিল; পরে payment_agent ও agent add করা হয়।)*

---

## 2. Tables (সব টেবিল)

| Table | বিবরণ |
|-------|--------|
| **profiles** | User profile (username, phone, refer_code, user_code, forced_result) – auth trigger দিয়ে create |
| **user_roles** | User এর role (admin, moderator, payment_agent, etc.) |
| **wallets** | User wallet balance |
| **user_vip_data** | VIP points, total_bet_amount, last_spin_at, cashback |
| **deposits** | Deposit requests (user_id, amount, method, trx_id, status, ইত্যাদি) |
| **withdrawals** | Withdrawal requests (user_id, amount, method, phone, status, assigned_agent_id) |
| **game_sessions** | প্রতিটি game play (user_id, game_id, bet_amount, win_amount, result, multiplier) |
| **games** | Game list (game_id, game_type, name, emoji, thumbnail_url, sort_order) – **seed আছে** |
| **game_profit_settings** | Per-game profit/win tier settings – **seed আছে (১৬ game + নতুন migration এ আরও)** |
| **game_stats_summary** | Aggregated total_bets, total_wins – **seed row আছে** |
| **game_assets** | Per-game custom assets (symbols, background, music, mascot) |
| **reward_pools** | small_win, medium_win, big_win, jackpot pool balance – **৪টা row seed** |
| **user_win_cooldowns** | User এর last big_win/jackpot যাতে repeat কম হয় |
| **active_players** | Live game এ কে কে আছে (last_active_at) |
| **referrals** | Referral codes ও referred users |
| **payment_methods** | bKash, Nagad, Rocket, ইত্যাদি – **seed আছে (৬টা)** |
| **payment_method_numbers** | Payment method এর নম্বর (agent-specific হতে পারে) |
| **transaction_types** | agent-cashout, send-money, payment – **৩টা seed** |
| **multiplier_settings** | Crash/slot multiplier config – **seed আছে** |
| **crash_settings** | Crash game house_edge, min_crash, max_crash – **seed আছে** |
| **crash_rounds** | Crash game round (game_id, crash_point, server_start_ms) |
| **sub_admin_permissions** | Moderator কে কোন module access |
| **chat_conversations** | Support chat conversation |
| **chat_messages** | Chat messages |
| **chat_faq** | FAQ – **seed আছে** |
| **chat_canned_responses** | Canned replies – **seed আছে** |
| **agent_settings** | Agent chat settings (is_online, max_chats) |
| **agent_applications** | Agent apply করার application |
| **agent_wallets** | Agent wallet balance |
| **agent_commission_settings** | Commission per amount – **seed (1000 টাকায় ৪)** |
| **agent_deposits** | Agent কর্তৃক deposit record |
| **agent_withdrawals** | Agent withdrawal record |
| **agent_settlements** | Agent settlement request |
| **agent_withdraw_commission_settings** | Withdraw commission – **seed (1000 এ ৪)** |
| **agent_payment_numbers** | Agent এর payment numbers |
| **super_ace_sessions** | Super Ace slot free-spin session |
| **super_ace_spin_logs** | Super Ace spin log |
| **cyber_matches** | Cyber/sports match (home_team, away_team, odds, result) |
| **cyber_bets** | User bet on cyber match |
| **cyber_match_markets** | Match এর market (e.g. over/under) |
| **cyber_market_bets** | Market এ user bet |
| **cyber_match_events** | Match events |
| **fake_wins** | Leaderboard/fake win display (যদি use হয়) |

---

## 3. Storage Buckets

| Bucket | ব্যবহার |
|--------|----------|
| **game-thumbnails** | Game thumbnails (public) |
| **payment-icons** | Payment method icons |
| **agent-documents** | Agent application documents (NID, photo) – public read |

---

## 4. RPC / Functions (যেগুলো backend বা frontend use করে)

| Function | কাজ |
|----------|-----|
| **has_role** | User এর role check (admin, moderator, payment_agent, agent) |
| **adjust_wallet_balance** | Balance add/remove (bet, win, withdraw) |
| **add_vip_points** | VIP points add (bet করার পর) |
| **claim_cashback** | Cashback claim |
| **try_daily_spin** | Daily spin allowed কি না |
| **get_leaderboard** | Leaderboard (weekly/alltime) |
| **get_total_bets_and_wins** | Global total bets & wins |
| **get_approved_deposit_total** | Total approved deposits |
| **get_approved_withdrawal_total** | Total approved withdrawals |
| **get_session_stats_by_range** | Session stats from a start time |
| **get_per_game_stats_by_range** | Per-game stats from a start time |
| **get_profit_chart_data** | Chart data (daily/weekly/monthly) |
| **distribute_bet_to_pools** | Bet amount pool এ ভাগ (small/medium/big/jackpot) |
| **deduct_from_pool** | Win payout এ pool থেকে কাটা |
| **get_or_create_crash_round** | Crash game round create বা existing return |
| **cleanup_old_crash_rounds** | পুরানো crash round delete |
| **process_agent_deposit** | Agent deposit process (user_code, amount) |
| **process_agent_withdrawal_approval** | Agent withdraw approve |
| **record_agent_commission** | Agent commission record |
| **load_agent_balance** | Admin কর্তৃক agent wallet এ load |
| **approve_agent_settlement** | Settlement approve |
| **pay_agent_commission** | Commission pay |
| **assign_agent_to_conversation** | Chat এ agent assign |
| **settle_cyber_match** | Cyber match result set ও bet settle |
| **settle_cyber_market** | Cyber market result set |
| **auto_settle_cyber_match** | Auto settle match |
| **auto_settle_cyber_market** | Auto settle market |
| **recalculate_cyber_odds** | Odds recalc |
| **generate_refer_code** | Unique refer code |
| **generate_user_code** | Unique user code |
| **handle_new_user** | Auth trigger: profile, wallet, user_vip_data create |
| **handle_deposit_approval** | Deposit approve হলে wallet update |
| **handle_withdrawal_approval** | Withdrawal approve হলে wallet update |
| **update_game_stats_summary** | game_sessions থেকে summary update |
| **update_updated_at_column** | updated_at trigger |
| **cleanup_stale_active_players** | Stale active_players cleanup |

---

## 5. Seed / Initial Data (আগে থেকেই যেগুলো insert হয়)

- **games**: ১০টা slot + ৫টা crash (super-ace, sweet-bonanza, book-of-dead, lucky-777, … aviator, rocket, jet, turbo, multi)
- **game_profit_settings**: ১৬ game (lucky-777, classic-777, …, chicken-road, ludo-king) + migration `20260308200000` এ আরও ১০ (super-ace, lucky-spin, lucky-win, fortune-gems, fortune-wheel, classic-casino, spin-wheel, bike-racing, turbo, multi)
- **reward_pools**: ৪ row – small_win, medium_win, big_win, jackpot (balance ০)
- **game_stats_summary**: ১ row (total_bets, total_wins = ০)
- **payment_methods**: ৬ – bKash, Nagad, Rocket, UPay, TAP, OKWallet
- **transaction_types**: ৩ – agent-cashout, send-money, payment
- **multiplier_settings**: ১ row
- **crash_settings**: ১ row
- **chat_faq**: কয়েকটা FAQ
- **chat_canned_responses**: কয়েকটা canned response
- **agent_commission_settings**: ১ row (1000 এ ৪)
- **agent_withdraw_commission_settings**: ১ row (1000 এ ৪)

*(কোনো migration এ `wallets` বা `profiles` তে bulk user seed নেই – শুধু handle_new_user trigger দিয়ে signup এ create হয়।)*

---

## 6. সংক্ষেপ

- **টেবিল**: ৩৫+ টেবিল (profiles, wallets, deposits, withdrawals, games, game_sessions, game_profit_settings, reward_pools, agents, chat, cyber, ইত্যাদি)
- **RPC**: ৩০+ function (wallet, VIP, leaderboard, stats, agent, crash, cyber, triggers)
- **Seed**: games, game_profit_settings, reward_pools, payment_methods, transaction_types, multiplier/crash/chat/agent commission settings – সব আগে থেকেই migration এ আছে
- **Storage**: game-thumbnails, payment-icons, agent-documents

সবকিছু migration ফাইলে আছে; Supabase এ migration run করলে এই পুরো ডাটাবেস ও seed একসাথে apply হবে। কোনো আলাদা “full database from scratch” script লাগবে না।
