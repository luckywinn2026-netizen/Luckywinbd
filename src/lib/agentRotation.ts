export interface AgentPaymentNumberEntry {
  id?: string;
  agent_id: string;
  payment_method: string;
  number: string;
  rotation_hours?: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

const HOUR_MS = 60 * 60 * 1000;

const getDurationMs = (entry: AgentPaymentNumberEntry) => {
  const hours = Number(entry.rotation_hours ?? 1);
  return Math.max(1, hours) * HOUR_MS;
};

export const getRotatedAgentNumber = (
  entries: AgentPaymentNumberEntry[],
  paymentMethod: string,
  nowMs = Date.now(),
): AgentPaymentNumberEntry | null => {
  const activeEntries = entries
    .filter((entry) => entry.payment_method === paymentMethod && entry.is_active !== false)
    .sort((a, b) => {
      const orderDelta = Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      if (orderDelta !== 0) return orderDelta;
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });

  if (activeEntries.length === 0) return null;

  const cycleMs = activeEntries.reduce((sum, entry) => sum + getDurationMs(entry), 0);
  if (cycleMs <= 0) return activeEntries[0];

  let offset = ((nowMs % cycleMs) + cycleMs) % cycleMs;

  for (const entry of activeEntries) {
    const durationMs = getDurationMs(entry);
    if (offset < durationMs) {
      return entry;
    }
    offset -= durationMs;
  }

  return activeEntries[0];
};
