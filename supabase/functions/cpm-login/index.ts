import { createClient } from "@supabase/supabase-js";

const allowedRoles = new Set([
  "super_admin",
  "event_manager",
  "content_manager",
  "analytics_viewer",
]);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function getDefaultKey(keysEnv: string, legacyEnv: string): string {
  const keysJson = Deno.env.get(keysEnv);
  if (keysJson) {
    const keys: unknown = JSON.parse(keysJson);
    if (keys && typeof keys === "object" && "default" in keys) {
      const defaultKey = (keys as Record<string, unknown>).default;
      if (typeof defaultKey === "string" && defaultKey) return defaultKey;
    }
  }

  const legacyKey = Deno.env.get(legacyEnv);
  if (legacyKey) return legacyKey;
  throw new Error(`Missing default key in ${keysEnv} and ${legacyEnv}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid login request" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid login request" }, 400);
  }

  const input = body as Record<string, unknown>;
  const role = input.role;
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const password = input.password;
  if (
    typeof role !== "string" ||
    !allowedRoles.has(role) ||
    !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 128
  ) {
    return jsonResponse({ error: "Invalid CPM credentials" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const secretKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });

    const { data: member, error: memberError } = await admin
      .from("cpm_admin_members")
      .select("user_id")
      .eq("login_username", username)
      .eq("role", role)
      .eq("active", true)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return jsonResponse({ error: "Invalid CPM credentials" }, 401);

    const { data: canAttempt, error: rateLimitError } = await admin.rpc(
      "consume_cpm_login_attempt",
      { p_login_username: username },
    );
    if (rateLimitError) throw rateLimitError;
    if (!canAttempt) return jsonResponse({ error: "Too many attempts. Try again in 15 minutes." }, 429);

    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(member.user_id);
    if (authUserError) throw authUserError;
    const email = authUser.user.email;
    if (!email || !authUser.user.email_confirmed_at) {
      return jsonResponse({ error: "Invalid CPM credentials" }, 401);
    }

    const auth = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { data: authData, error: signInError } = await auth.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !authData.session) {
      return jsonResponse({ error: "Invalid CPM credentials" }, 401);
    }

    const { error: resetError } = await admin.rpc("reset_cpm_login_attempt", {
      p_login_username: username,
    });
    if (resetError) throw resetError;

    return jsonResponse({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });
  } catch (error) {
    console.error("CPM login service failure", error);
    return jsonResponse({ error: "Unable to process CPM login" }, 500);
  }
});
