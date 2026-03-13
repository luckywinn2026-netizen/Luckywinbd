import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
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

    const { application_id, password } = await req.json();
    if (!application_id || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "application_id and password (min 6 chars) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get application
    const { data: app, error: appErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (app.status !== "pending") {
      return new Response(JSON.stringify({ error: "Application already processed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = app.phone.replace(/[^0-9]/g, "");
    const email = `${phone}@luckywin.app`;

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Set password
      await supabase.auth.admin.updateUser(userId, { password });
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: app.name, phone },
      });

      if (createErr || !newUser?.user) {
        return new Response(JSON.stringify({ error: "Failed to create user: " + (createErr?.message || "Unknown") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
    }

    // Assign payment_agent role (upsert to avoid duplicates)
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "payment_agent" },
      { onConflict: "user_id,role" }
    );

    // Create agent wallet if not exists
    const { data: existingWallet } = await supabase
      .from("agent_wallets")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingWallet) {
      await supabase.from("agent_wallets").insert({ user_id: userId });
    }

    // Ensure profile exists so agent shows in Payment Agents list
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();
    if (existingProfile) {
      await supabase.from("profiles").update({
        username: app.name,
        phone: phone,
      }).eq("user_id", userId);
    } else {
      const { data: refCode } = await supabase.rpc("generate_refer_code");
      const { data: uCode } = await supabase.rpc("generate_user_code");
      await supabase.from("profiles").insert({
        user_id: userId,
        username: app.name,
        phone: phone,
        refer_code: refCode ?? null,
        user_code: uCode ?? null,
      });
    }

    // Update application status
    await supabase.from("agent_applications").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: caller.id,
    }).eq("id", application_id);

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      phone,
      message: `Agent ${app.name} approved and account created`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
