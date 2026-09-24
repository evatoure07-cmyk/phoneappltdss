import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const STAFF_DOMAIN = 'ltd-sandy-shores.example'
const EMPLOYEE_ROLES = new Set([
  'vendeur_novice','vendeur_intermediaire','vendeur_experimente',
  'pompiste_novice','pompiste_intermediaire','pompiste_experimente',
  'chef_equipe','livreur','responsable_pompiste','responsable_vente'
])

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizeUsername(value: unknown) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '').replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '')
}

function staffEmail(username: string) {
  return `${normalizeUsername(username)}@${STAFF_DOMAIN}`
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function requireDirection(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Connexion direction requise.')
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error } = await anon.auth.getUser()
  if (error || !user) throw new Error('Session invalide.')
  const { data: profile, error: profileError } = await admin
    .from('profiles').select('staff_role').eq('id', user.id).single()
  if (profileError || !['patron','copatron'].includes(profile?.staff_role)) {
    throw new Error('Accès réservé à la direction.')
  }
  return user
}

async function bootstrapDirection(username: string, password: string) {
  username = normalizeUsername(username)
  const { data: boot, error } = await admin
    .from('direction_bootstrap')
    .select('username,display_name,staff_role,salt,password_hash,used')
    .eq('username', username).single()
  if (error || !boot) throw new Error('Identifiant direction inconnu.')
  if (boot.used) throw new Error('Ce compte direction a déjà été activé.')
  const expected = await sha256(`${boot.salt}:${username}:${password}`)
  if (expected !== boot.password_hash) throw new Error('Mot de passe temporaire incorrect.')

  const email = staffEmail(username)
  let userId = ''
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: boot.display_name, staff_username: username },
  })
  if (created.error || !created.data.user) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = listed.data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!existing) throw created.error ?? new Error('Création du compte direction impossible.')
    userId = existing.id
    const changed = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (changed.error) throw changed.error
  } else {
    userId = created.data.user.id
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    display_name: boot.display_name,
    email,
    staff_username: username,
    staff_role: boot.staff_role,
    role: 'admin',
    must_change_password: true,
  }, { onConflict: 'id' })
  if (profileError) throw profileError

  const { error: usedError } = await admin.from('direction_bootstrap')
    .update({ used: true, used_at: new Date().toISOString() }).eq('username', username)
  if (usedError) throw usedError
  return { ok: true, username }
}

async function createStaff(req: Request, body: Record<string, unknown>) {
  await requireDirection(req)
  const username = normalizeUsername(body.username)
  const password = String(body.password ?? '')
  const displayName = String(body.display_name ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const staffRole = String(body.staff_role ?? '')
  if (!username || !username.includes('.')) throw new Error('L’identifiant doit être au format prénom.nom.')
  if (password.length < 8) throw new Error('Le mot de passe temporaire doit contenir au moins 8 caractères.')
  if (!displayName) throw new Error('Nom de l’employé obligatoire.')
  if (!EMPLOYEE_ROLES.has(staffRole)) throw new Error('Rôle employé invalide.')

  const email = staffEmail(username)
  const exists = await admin.from('profiles').select('id').ilike('staff_username', username).maybeSingle()
  if (exists.data) throw new Error('Cet identifiant est déjà utilisé.')

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, phone, staff_username: username },
  })
  if (error || !data.user) throw error ?? new Error('Création impossible.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id,
    display_name: displayName,
    email,
    phone,
    staff_username: username,
    staff_role: staffRole,
    role: 'employee',
    must_change_password: true,
  }, { onConflict: 'id' })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw profileError
  }
  return { ok: true, user_id: data.user.id, username }
}

async function resetStaffPassword(req: Request, body: Record<string, unknown>) {
  await requireDirection(req)
  const userId = String(body.user_id ?? '')
  const password = String(body.password ?? '')
  if (!userId) throw new Error('Compte introuvable.')
  if (password.length < 8) throw new Error('Le mot de passe temporaire doit contenir au moins 8 caractères.')
  const { data: target, error } = await admin.from('profiles')
    .select('id,staff_role').eq('id', userId).single()
  if (error || !target?.staff_role) throw new Error('Ce compte n’est pas un compte employé.')
  const changed = await admin.auth.admin.updateUserById(userId, { password })
  if (changed.error) throw changed.error
  const updated = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId)
  if (updated.error) throw updated.error
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405)
  try {
    const body = await req.json() as Record<string, unknown>
    const action = String(body.action ?? '')
    if (action === 'bootstrap_direction') {
      return json(await bootstrapDirection(String(body.username ?? ''), String(body.password ?? '')))
    }
    if (action === 'create_staff') return json(await createStaff(req, body))
    if (action === 'reset_staff_password') return json(await resetStaffPassword(req, body))
    return json({ error: 'Action inconnue.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return json({ error: message }, 400)
  }
})
