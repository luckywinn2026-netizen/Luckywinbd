import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("880")) digits = "0" + digits.slice(3);
  if (!digits.startsWith("0")) digits = "0" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone: rawPhone, password, name } = await req.json();
    if (!rawPhone || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "phone and password (min 6 chars) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(rawPhone);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid BD phone (01XXXXXXXXX)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${phone}@luckywin.app`;
    const displayName = (name && String(name).trim()) || phone;

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await supabase.auth.admin.updateUser(userId, { password });
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: displayName, phone },
      });

      if (createErr || !newUser?.user) {
        return new Response(JSON.stringify({ error: "Failed to create user: " + (createErr?.message || "Unknown") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
    }

    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "payment_agent")
      .single();

    if (!existingRole) {
      await supabase.from("user_roles").insert({ user_id: userId, role: "payment_agent" });
    }

    const { data: existingWallet } = await supabase
      .from("agent_wallets")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingWallet) {
      await supabase.from("agent_wallets").insert({ user_id: userId });
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (existingProfile) {
      await supabase.from("profiles").update({
        username: displayName,
        phone,
      }).eq("user_id", userId);
    } else {
      const { data: refCode } = await supabase.rpc("generate_refer_code");
      const { data: uCode } = await supabase.rpc("generate_user_code");
      await supabase.from("profiles").insert({
        user_id: userId,
        username: displayName,
        phone,
        refer_code: refCode ?? null,
        user_code: uCode ?? null,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      phone,
      message: `Agent created. Login at /agent-login with this number and password.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
