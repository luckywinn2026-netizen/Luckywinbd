import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Recalculate totals from game_sessions
  const { data, error: fetchError } = await supabase
    .from("game_sessions")
    .select("bet_amount, win_amount");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const totalBets = (data || []).reduce((sum: number, r: any) => sum + Number(r.bet_amount), 0);
  const totalWins = (data || []).reduce((sum: number, r: any) => sum + Number(r.win_amount), 0);

  const { error: updateError } = await supabase
    .from("game_stats_summary")
    .update({ total_bets: totalBets, total_wins: totalWins, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, total_bets: totalBets, total_wins: totalWins }), {
    headers: { "Content-Type": "application/json" },
  });
});
