import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STAFF_DOMAIN = "ltd-sandy-shores.example";

const EMPLOYEE_ROLES = new Set([
  "vendeur_novice",
  "vendeur_intermediaire",
  "vendeur_experimente",
  "pompiste_novice",
  "pompiste_intermediaire",
  "pompiste_experimente",
  "chef_equipe",
  "livreur",
  "responsable_pompiste",
  "responsable_vente",
]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeUsername(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

function staffEmail(username) {
  return `${normalizeUsername(username)}@${STAFF_DOMAIN}`;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireDirection(req) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Connexion direction requise.");

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const userResult = await client.auth.getUser();
  const user = userResult.data && userResult.data.user;
  if (userResult.error || !user) throw new Error("Session invalide.");

  const profileResult = await admin
    .from("profiles")
    .select("staff_role")
    .eq("id", user.id)
    .single();

  const staffRole = profileResult.data && profileResult.data.staff_role;
  if (profileResult.error || !["patron", "copatron"].includes(staffRole)) {
    throw new Error("Accès réservé à la direction.");
  }

  return user;
}

async function bootstrapDirection(username, password) {
  username = normalizeUsername(username);

  const bootResult = await admin
    .from("direction_bootstrap")
    .select("username,display_name,staff_role,salt,password_hash,used")
    .eq("username", username)
    .single();

  const boot = bootResult.data;
  if (bootResult.error || !boot) throw new Error("Identifiant direction inconnu.");
  if (boot.used) throw new Error("Ce compte direction a déjà été activé.");

  const expected = await sha256(`${boot.salt}:${username}:${password}`);
  if (expected !== boot.password_hash) {
    throw new Error("Mot de passe temporaire incorrect.");
  }

  const email = staffEmail(username);
  let userId = "";

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: boot.display_name,
      staff_username: username,
    },
  });

  if (created.error || !created.data.user) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw listed.error;

    const existing = (listed.data.users || []).find(

