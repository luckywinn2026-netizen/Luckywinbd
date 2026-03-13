# Lucky Bangla Play – Production Readiness Report

## সারাংশ: **PARTIAL READY** (আংশিক প্রস্তুত)

Core features কাজ করছে, তবে production-এর আগে কিছু জিনিস ঠিক করা উচিত।

---

## ✅ যা ঠিক আছে

| বিভাগ | স্ট্যাটাস |
|-------|----------|
| **Build** | `npm run build` সফল |
| **TypeScript** | কোনো error নেই |
| **Lint** | কোনো critical error নেই |
| **Database** | Migrations ঠিক, RLS policies আছে |
| **Auth** | Admin routes সুরক্ষিত, JWT verify |
| **Frontend** | সব route কাজ করে, lazy loading আছে |
| **Backend-UI Match** | Lucky 777, Fortune Gems, bonus rules ঠিক করা হয়েছে |

---

## ⚠️ Production-এর আগে ঠিক করুন (High Priority)

### 1. CORS – সব origin allow করছে
- **ফাইল:** `backend/src/index.js`
- **সমস্যা:** `cors({ origin: true })` – সব domain থেকে request নেয়
- **সমাধান:** Production domain গুলো সাদা তালিকায় দিন:
```js
app.use(cors({ origin: ['https://yourdomain.com', 'https://www.yourdomain.com'] }));
```

### 2. Error Boundary নেই
- **সমস্যা:** কোনো React error হলে পুরো app crash করতে পারে
- **সমাধান:** App root-এ ErrorBoundary যোগ করুন

### 3. Rate Limiting নেই
- **সমস্যা:** API abuse / DDoS এর ঝুঁকি
- **সমাধান:** `express-rate-limit` দিয়ে auth, game, admin endpoints-এ rate limit দিন

---

## 📋 Medium Priority (পরবর্তী আপডেটে)

| আইটেম | বিবরণ |
|-------|--------|
| Fortune Gems paytable | Backend tier thresholds paytable-এর সাথে পুরোপুরি align করা যায় |
| Request validation | Zod বা অন্য schema দিয়ে API body validate করা |
| Admin games 0 count | নতুন DB-এ `games` table seed আছে কিনা যাচাই করুন |

---

## 📋 Lower Priority

| আইটেম | বিবরণ |
|-------|--------|
| Tests | Unit/integration tests যোগ করা |
| Loading states | সব data-dependent view-এ loading/skeleton |

---

## ✅ Checklist

- [ ] CORS production domain সেট করে দিন
- [ ] Error Boundary যোগ করুন
- [ ] Rate limiting যোগ করুন
- [ ] `.env` সঠিকভাবে configure করুন (production URL, keys)
- [ ] `npx supabase db push` দিয়ে migrations চালান
- [ ] Admin user-এ `user_roles` table-এ `role='admin'` আছে কিনা যাচাই করুন

---

## উপসংহার

**Production-এ যাওয়ার আগে:** CORS, Error Boundary, Rate limiting এই তিনটি করুন। বাকি জিনিসগুলো পরে করা যাবে।
