# Agent Database Structure & Remove Flow

## Database Tables (Agent সম্পর্কিত)

| Table | Purpose |
|-------|---------|
| **user_roles** | কে agent – `role = 'payment_agent'` এবং `user_id` |
| **profiles** | Agent নাম (`username`), ফোন (`phone`), `user_code`, `telegram_link` |
| **agent_wallets** | প্রতিটি agent এর wallet – `user_id`, `balance`, `total_deposited`, `total_commission` |
| **agent_payment_numbers** | bKash/Nagad নম্বর – `agent_id` (= user_id), `payment_method`, `number`, `rotation_hours` |
| **agent_applications** | Agent আবেদন – approve হলে ওপরের tables এ data যায় |

## Agent নাম কোথায়?

- **profiles.username** – এখানে agent এর নাম থাকে
- Application approve হলে backend `profiles.username` এ নাম set করে
- Admin Agents থেকে Add করলে `profiles` এ আগে থেকে থাকা username use হয়

## Agent Wallet Numbers কোথায়?

- **Table:** `agent_payment_numbers`
- **Columns:** `agent_id` (user_id), `payment_method` (bKash/Nagad), `number`, `rotation_hours`, `sort_order`
- **Supabase:** Table Editor → `agent_payment_numbers`
- **Admin UI:** Payment Agents পেজে প্রতিটি agent এর নিচে "Deposit / Withdraw Rotation" সেকশনে

## Agent পুরোপুরি Remove করার সঠিক উপায়

**কেন agent wallet এখনও দেখাচ্ছে?**  
শুধু `agent_applications` থেকে delete/reject করলে agent remove হয় না। Agent আসলে থাকে:

- `user_roles`
- `agent_wallets`
- `agent_payment_numbers`

### সঠিক Remove পদ্ধতি

1. **Admin UI থেকে:**  
   Admin → Payment Agents → ওই agent এর পাশে **Remove** বাটন ক্লিক করুন।  
   এটা একসাথে delete করবে:
   - `user_roles` (payment_agent)
   - `agent_wallets`
   - `agent_payment_numbers`

2. **Database থেকে manually:**  
   Supabase SQL Editor এ চালান:

```sql
-- user_id দিয়ে replace করুন
DELETE FROM public.agent_payment_numbers WHERE agent_id = 'USER_ID_HERE';
DELETE FROM public.agent_wallets WHERE user_id = 'USER_ID_HERE';
DELETE FROM public.user_roles WHERE user_id = 'USER_ID_HERE' AND role = 'payment_agent';
```

3. **Agent Applications থেকে Revoke:**  
   Approved application এর জন্য "Revoke Agent" বাটন use করুন – এটাও একইভাবে সব table থেকে remove করবে।

## Flow Summary

```
Agent Application (pending)
    → Approve → user_roles + agent_wallets + profiles তৈরি
    → Reject → শুধু agent_applications.status = 'rejected'

Agent Remove (সঠিক উপায়):
    → user_roles, agent_wallets, agent_payment_numbers সব থেকে delete
    → Agent Applications এ approved application এর জন্য "Revoke Agent" বাটন use করুন
    → অথবা Payment Agents পেজে "Remove" বাটন use করুন
```

## Revoke vs Reject

- **Reject:** শুধু pending application – agent তৈরি হয়নি, তাই কিছু delete করার দরকার নেই
- **Revoke:** Approved application – agent already তৈরি; Revoke করলে user_roles, agent_wallets, agent_payment_numbers সব থেকে remove হবে

## Add Agent (নতুন – user থাকতে হবে না)

- Admin phone + password দিয়ে agent add করতে পারবে
- Agent আগে থেকে user হতে হবে না
- Agent `/agent-login` এ ঐ number ও password দিয়ে login করবে
- নতুন agent create করতে হলে **password required** (min 6 chars)
- Supabase function deploy: `supabase functions deploy add-agent-direct`
