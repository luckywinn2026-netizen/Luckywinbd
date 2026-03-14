/**
 * Backend API client. Supabase is used only as database; all RPC and game logic go through this backend.
 */
import { supabase } from '@/integrations/supabase/client';

const rawBase = import.meta.env.VITE_API_URL || '';
const BASE = rawBase && !rawBase.startsWith('http') ? `http://${rawBase}` : rawBase;

export type CrashLiveBet = {
  id: string;
  game_id: string;
  round_id: string;
  user_id: string;
  username_snapshot: string;
  panel_index: number;
  bet_amount: number;
  auto_cashout: number | null;
  status: 'active' | 'cashed_out' | 'lost' | 'cancelled';
  cashout_multiplier: number | null;
  win_amount: number;
  placed_at: string;
  settled_at: string | null;
  updated_at: string;
};

export type CrashStateResponse = {
  round: {
    id: string;
    game_id: string;
    phase: 'waiting' | 'flying' | 'crashed';
    current_multiplier: number;
    countdown_ms: number;
    elapsed_ms: number;
    server_start_ms: number;
    server_now_ms: number;
    crash_point: number | null;
  };
  history: Array<{
    id: string;
    crash_point: number;
    created_at: string;
  }>;
  liveBets: CrashLiveBet[];
};

export type CrashBetActionResponse = {
  bet: CrashLiveBet;
  newBalance: number;
  winAmount?: number;
  cashoutMultiplier?: number;
};

export type LudoMatchState = {
  blue: number[];
  green: number[];
  turn: 'blue' | 'green';
  dice: number;
  rolled: boolean;
  movable: number[];
  winner: 'blue' | 'green' | null;
  phase: 'playing' | 'result';
  consecutiveSixes: { blue: number; green: number };
  aiTurns: Array<{ dice: number; tokenIdx: number | null; skipped: boolean; reason?: string }>;
  lastUserRoll: {
    player: 'blue';
    diceVal: number;
    hadMove: boolean;
  } | null;
  lastAction: {
    player: 'blue' | 'green';
    tokenIdx: number;
    diceVal: number;
    captured: boolean;
    reachedHome: boolean;
  } | null;
  settled: boolean;
  winAmount: number;
};

export type LudoMatchResponse = {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  gameId: string;
  levelIdx: number;
  betAmount: number;
  targetOutcome: 'force_loss' | 'force_win' | 'natural';
  opponent: {
    id: string;
    name: string;
    avatar: string;
    level: number;
    wins: number;
  };
  state: LudoMatchState;
  createdAt: string;
  completedAt: string | null;
} | null;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BASE) {
    console.warn('VITE_API_URL not set; backend calls will fail.');
  }
  const url = path.startsWith('http') ? path : `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

/** POST /api/rpc/:name – replaces supabase.rpc() */
export async function rpc<T = unknown>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  return request<T>(`/api/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** POST /api/games/outcome – replaces supabase.functions.invoke('game-outcome') */
export async function gameOutcome(body: { bet_amount: number; game_type?: string; game_id?: string; is_free_spin?: boolean }) {
  return request<{ outcome: string; maxWinAmount: number; availablePool?: number; multiplier?: number; poolUsed?: string }>(
    '/api/games/outcome',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function sharedSlotSpin(body: { bet: number; game_id: string; game_name: string }) {
  return request<{ outcome: string; maxWinAmount: number; multiplier?: number; newBalance: number; winAmount: number }>(
    '/api/games/shared-slot-spin',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function getCrashState(body: { game_id: string }) {
  return request<CrashStateResponse>('/api/crash/state', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function placeCrashBet(body: {
  game_id: string;
  round_id: string;
  panel_index: number;
  bet_amount: number;
  auto_cashout?: number | null;
}) {
  return request<CrashBetActionResponse>('/api/crash/bet', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cancelCrashBet(body: { bet_id: string }) {
  return request<CrashBetActionResponse>('/api/crash/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cashoutCrashBet(body: { bet_id: string }) {
  return request<CrashBetActionResponse>('/api/crash/cashout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/games/color-prediction-outcome */
export async function colorPredictionOutcome(body: { bet_amount: number; bet_type: string; bet_value: string; period_id?: string }) {
  return request<{ winning_number: number; winning_color: string; winning_colors: string[]; payout: number; is_win: boolean; period_id?: string; streak_penalty?: number }>(
    '/api/games/color-prediction-outcome',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function colorPredictionRound(body: { period_id?: string; timer_mode?: number; bets: Array<{ type: string; value: string; amount: number }> }) {
  return request<{ winning_number: number; winning_color: string; winning_colors: string[]; payout: number; is_win: boolean; period_id?: string; streak_penalty?: number; total_bet: number; newBalance: number }>(
    '/api/games/color-prediction-round',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

/** POST /api/games/boxing-king-spin – may return 501 until ported */
export async function boxingKingSpin(body: { bet: number }) {
  return request<{ initialGrid?: unknown; totalWin?: number; newBalance?: number; error?: string }>(
    '/api/games/boxing-king-spin',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

/** POST /api/games/super-ace-spin – may return 501 until ported */
export async function superAceSpin(body: { bet: number }) {
  return request<{ initialGrid?: unknown; totalWin?: number; newBalance?: number; error?: string }>(
    '/api/games/super-ace-spin',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function startLudoMatch(body: { levelIdx: number }) {
  return request<LudoMatchResponse>('/api/games/ludo/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getLudoMatchState(body: { matchId?: string | null } = {}) {
  return request<LudoMatchResponse>('/api/games/ludo/state', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function rollLudoDice(body: { matchId: string }) {
  return request<LudoMatchResponse>('/api/games/ludo/roll', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function moveLudoToken(body: { matchId: string; tokenIdx: number }) {
  return request<LudoMatchResponse>('/api/games/ludo/move', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function passLudoTurn(body: { matchId: string }) {
  return request<LudoMatchResponse>('/api/games/ludo/pass', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function abandonLudoMatch(body: { matchId: string }) {
  return request<LudoMatchResponse>('/api/games/ludo/abandon', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/admin/set-password */
export async function adminSetPassword(body: { user_id: string; password: string }) {
  return request<{ success: boolean }>('/api/admin/set-password', { method: 'POST', body: JSON.stringify(body) });
}

/** POST /api/admin/approve-agent */
export async function adminApproveAgent(body: { application_id: string; password: string }) {
  return request<{ success: boolean; user_id?: string; phone?: string; message?: string }>(
    '/api/admin/approve-agent',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

/** Create sub-admin with phone + password. Sub-admin logs in at admin panel with same credentials. */
export async function adminCreateSubAdmin(body: { phone: string; password: string; name?: string }) {
  return request<{ success: boolean; user_id?: string; phone?: string; message?: string }>(
    '/api/admin/create-sub-admin',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

/** Add agent directly (phone + password) – no existing user required. Agent logs in at /agent-login with same number & password. */
export async function adminAddAgentDirect(body: { phone: string; password: string; name?: string }) {
  const headers = await getAuthHeaders();
  if (BASE) {
    const res = await fetch(`${BASE.replace(/\/$/, '')}/api/admin/add-agent-direct`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json() as Promise<{ success: boolean; user_id?: string; phone?: string; message?: string }>;
    if (res.status !== 404) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || res.statusText);
    }
  }
  const { data, error } = await supabase.functions.invoke('add-agent-direct', { body });
  if (error) throw new Error(error.message || 'Failed to create agent');
  if (data?.error) throw new Error(data.error);
  return data as { success: boolean; user_id?: string; phone?: string; message?: string };
}

/** Check if backend is configured */
export function isBackendConfigured(): boolean {
  return Boolean(BASE);
}

/** Daily spin status – uses RPC (works with /api/rpc) or falls back to GET /api/daily-spin/status */
export async function getDailySpinStatus(): Promise<{ canSpin: boolean; lastSpinAt: string | null; nextSpinAt: string | null } | null> {
  if (!BASE) return null;
  try {
    const data = await rpc<{ canSpin?: boolean; lastSpinAt?: string | null; nextSpinAt?: string | null }>('get_daily_spin_status', {});
    if (data && typeof data === 'object') {
      return {
        canSpin: data.canSpin ?? true,
        lastSpinAt: data.lastSpinAt ?? null,
        nextSpinAt: data.nextSpinAt ?? null,
      };
    }
  } catch {}
  try {
    const res = await fetch(`${BASE.replace(/\/$/, '')}/api/daily-spin/status`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });
    if (res.ok) return res.json();
  } catch {}
  return null;
}

/** GET /api/payments/check-deposit-trx?trx_id=xxx */
export async function checkDepositTrx(trxId: string) {
  const params = new URLSearchParams({ trx_id: trxId });
  return request<{ duplicate: boolean }>(`/api/payments/check-deposit-trx?${params}`, { method: 'GET' });
}

/** GET /api/payments/deposit-form-data */
export async function getDepositFormData() {
  return request<{
    paymentMethods: unknown[];
    transactionTypes: unknown[];
    paymentMethodNumbers: unknown[];
    agentPaymentNumbers: unknown[];
  }>('/api/payments/deposit-form-data', { method: 'GET' });
}

/** GET /api/payments/withdraw-form-data */
export async function getWithdrawFormData() {
  return request<{
    paymentMethods: Array<{ id: string; name: string; icon: string }>;
    agentPaymentNumbers: unknown[];
  }>('/api/payments/withdraw-form-data', { method: 'GET' });
}

/** GET /api/payments/lucky-agent-data – agents, payment methods, agent numbers */
export async function getLuckyAgentData() {
  return request<{
    agents: Array<{ user_id: string; username: string | null; avatar_url: string | null; telegram_link: string | null }>;
    paymentMethods: Array<{ id: string; name: string; icon: string }>;
    agentPaymentNumbers: Array<{ agent_id: string; payment_method: string; number: string }>;
  }>('/api/payments/lucky-agent-data', { method: 'GET' });
}

/** POST /api/payments/deposits */
export async function createDeposit(body: { amount: number; method: string; trx_id: string; phone: string; assigned_agent_id?: string }) {
  return request<{ success: boolean; id: string }>('/api/payments/deposits', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** RPC: get withdrawable balance (balance minus locked bonus from turnover) */
export async function getWithdrawableBalance(): Promise<number> {
  const data = await rpc<number>('get_withdrawable_balance', {});
  return Number(data ?? 0);
}

/** RPC: get user's bonus turnover progress (required, completed, remaining, locked_amount) */
export async function getBonusTurnover(): Promise<{
  required_turnover: number;
  completed_turnover: number;
  remaining_turnover: number;
  locked_amount: number;
  has_pending: boolean;
}> {
  const data = await rpc<{
    required_turnover: number;
    completed_turnover: number;
    remaining_turnover: number;
    locked_amount: number;
    has_pending: boolean;
  }>('get_user_bonus_turnover', {});
  return {
    required_turnover: Number(data?.required_turnover ?? 0),
    completed_turnover: Number(data?.completed_turnover ?? 0),
    remaining_turnover: Number(data?.remaining_turnover ?? 0),
    locked_amount: Number(data?.locked_amount ?? 0),
    has_pending: Boolean(data?.has_pending ?? false),
  };
}

/** POST /api/payments/withdrawals */
export async function createWithdrawal(body: { amount: number; method: string; phone: string; assigned_agent_id?: string }) {
  return request<{ success: boolean; id: string; withdrawal_code?: string; new_balance: number }>('/api/payments/withdrawals', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** GET /api/payments/withdrawals – for agents/admins */
export async function getWithdrawals() {
  return request<Array<{
    id: string;
    user_id: string;
    amount: number;
    method: string;
    phone: string | null;
    status: string;
    withdrawal_code: string | null;
    created_at: string;
    username?: string;
    user_code?: string;
  }>>('/api/payments/withdrawals', { method: 'GET' });
}

/** POST /api/payments/withdrawals/:id/reject */
export async function rejectWithdrawal(id: string) {
  return request<{ success: boolean }>(`/api/payments/withdrawals/${id}/reject`, {
    method: 'POST',
  });
}

/** POST /api/push/register – save FCM token for Agent/Admin push notifications */
export async function registerPushToken(body: { fcm_token: string; platform?: string; app_variant?: string }) {
  return request<{ success: boolean }>('/api/push/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/push/notify-admin-deposit-approved – Agent calls after approving deposit */
export async function notifyAdminDepositApproved(depositId: string, amount: number) {
  return request<{ success: boolean }>('/api/push/notify-admin-deposit-approved', {
    method: 'POST',
    body: JSON.stringify({ deposit_id: depositId, amount }),
  });
}

/** RPC: admin final approve deposit with optional commission */
export async function adminFinalApproveDeposit(depositId: string, finalAmount: number, commission?: number) {
  return rpc<{ success?: boolean; error?: string; amount?: number }>('admin_final_approve_deposit', {
    p_deposit_id: depositId,
    p_final_amount: finalAmount,
    p_commission: commission ?? null,
  });
}
