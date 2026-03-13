# Railway Deployment Guide

## 1. Railway এ Project তৈরি

1. [railway.app](https://railway.app) এ যান → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. আপনার repo select করুন

## 2. Root Directory সেট করুন

- **Settings** → **Service** → **Root Directory** = `backend`
- এটা জরুরি কারণ backend একটা subfolder এ

## 3. Environment Variables

**Settings** → **Variables** → **Variables** → **Add Variable**

| Variable | Value | Required |
|----------|-------|----------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | ✅ |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key) | ✅ |
| `NODE_ENV` | `production` | Optional |
| `NIXPACKS_NODE_VERSION` | `20` | Optional – Supabase SDK needs Node 20+ |

**Note:** `PORT` Railway নিজে set করে – manually add করার দরকার নেই।

## 4. Deploy

- **Deploy** বাটন ক্লিক করুন অথবা GitHub push করলে auto deploy হবে
- **Deployments** tab এ দেখুন build ও deploy status

## 5. Domain সেট করুন

- **Settings** → **Networking** → **Generate Domain**
- Example: `lucky-bangla-backend-production.up.railway.app`
- এই URL টা frontend এর `.env` এ `VITE_API_URL` এ রাখুন

## 6. Frontend Update

Frontend `.env` বা build config এ:

```
VITE_API_URL=https://your-backend.up.railway.app
```

## Health Check

Deploy complete হলে এ URL এ যান:

```
GET https://your-backend.up.railway.app/health
```

Response: `{ "ok": true, "service": "lucky-bangla-backend" }`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Root Directory = `backend` check করুন |
| 503 / Connection refused | Variables add করুন, redeploy করুন |
| CORS error | Backend এ `cors({ origin: true })` আছে – সব origin allow |
