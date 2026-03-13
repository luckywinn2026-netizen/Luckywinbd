# Architecture Audit: Backend vs Supabase Direct

**লক্ষ্য:** Custom backend দিয়ে সব logic, Supabase শুধু database।

## বর্তমান অবস্থা

### ✅ Backend (VITE_API_URL) দিয়ে যায়

| Category | API/Route | ব্যবহার |
|----------|-----------|---------|
| Games | `/api/games/outcome`, `/api/games/shared-slot-spin`, etc. | Slot, Crash, Ludo, Color Prediction |
| Admin | `/api/admin/set-password` | Password set |
| Admin | `/api/admin/approve-agent` | Agent application approve |
| RPC | `/api/rpc/:name` | has_role, load_agent_balance, process_agent_*, approve_agent_settlement, pay_agent_commission, try_daily_spin, get_session_stats, etc. |
| Payments | `/api/payments/deposits`, `/api/payments/withdrawals`, etc. | Deposit, withdraw, form data |
| Daily Spin | `/api/daily-spin/status` | Spin status |

### 🔴 Frontend → Supabase Direct (Backend bypass)

#### 1. **Supabase Auth** (সাধারণত থাকে)
- `supabase.auth.signInWithPassword`, `signOut`, `getUser`
- Login, session – এটা সাধারণত frontend এ থাকে

#### 2. **Supabase Edge Function Direct** (Backend bypass)
- `adminAddAgentDirect` → **Supabase Functions** (`/functions/v1/add-agent-direct`) দিকে direct call
- Backend এ `/api/admin/add-agent-direct` নেই

#### 3. **Supabase Table Direct** (CRUD – backend দিয়ে যাওয়া উচিত)
- **AdminAgents:** user_roles, profiles, agent_wallets, agent_payment_numbers, agent_commission_settings – সব direct
- **AdminAgentApplications:** profiles, user_roles, agent_wallets, agent_payment_numbers, agent_applications – direct
- **AdminDeposits:** deposits select/update – direct
- **AdminWithdrawals:** withdrawals select/update – direct
- **AdminWallets:** profiles, wallets – direct
- **AdminUsers:** profiles, wallets, deposits, withdrawals, game_sessions – direct
- **AdminGames:** games, game_sessions, profiles – direct
- **AdminPromoBanners:** promo_banners – direct
- **AdminSettings:** payment_methods, transaction_types, payment_method_numbers – direct
- **AdminDashboard:** profiles, active_players, reward_pools, games – direct
- **AdminReferrals:** referrals, profiles – direct
- **AdminCrashSettings:** crash_settings – direct
- **AdminGameAssets:** games, game_assets – direct
- **AgentDepositsPage, AgentWithdrawalsPage:** deposits, withdrawals – direct
- **AgentOverview, AgentSettlementsPage:** agent_wallets, deposits, withdrawals, etc. – direct
- **BecomeAgentPage:** agent_applications insert – direct
- **SpinWheelPage:** `supabase.rpc('try_daily_spin')` – direct (api.rpc দিয়ে যাওয়া উচিত)
- **AdminLiveMonitor, AdminAgentPerformance:** profiles – direct

#### 4. **Supabase RPC Direct**
- `SpinWheelPage.tsx`: `supabase.rpc('try_daily_spin')` – backend এ `/api/rpc/try_daily_spin` আছে, কিন্তু এখানে direct call

---

## সারাংশ

| ধরন | সংখ্যা | মন্তব্য |
|-----|--------|---------|
| Backend API | ✅ Games, Payments, Admin (set-password, approve-agent), RPC proxy | ঠিক আছে |
| Supabase Direct | 🔴 Admin CRUD (২০+ pages), add-agent-direct | Backend দিয়ে যাওয়া উচিত |
| Supabase Auth | ✅ Login, session | সাধারণত frontend এ থাকে |

**সিদ্ধান্ত:** Supabase এখন **শুধু database** নয় – অনেক admin CRUD এবং `add-agent-direct` সরাসরি Supabase এ যাচ্ছে। Backend দিয়ে যাওয়ার জন্য সব admin API এবং add-agent-direct backend এ implement করা দরকার।

---

## পরিবর্তনের সুপারিশ

1. **add-agent-direct:** Backend এ `/api/admin/add-agent-direct` যোগ করুন। Frontend থেকে `api.adminAddAgentDirect` backend call করবে, Supabase function দিকে না।

2. **Admin CRUD:** Backend এ admin API routes যোগ করুন (যেমন `/api/admin/agents`, `/api/admin/deposits`, etc.) এবং frontend থেকে সেগুলো call করুন।

3. **SpinWheelPage:** `supabase.rpc('try_daily_spin')` এর বদলে `api.rpc('try_daily_spin')` ব্যবহার করুন।

4. **অগ্রাধিকার:** আগে add-agent-direct backend এ নিয়ে যান, তারপর ধাপে ধাপে Admin CRUD।
