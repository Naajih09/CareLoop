/*
 * Vercel Edge Function. Lets a clinic admin invite a staff member.
 * Supabase emails the invitee a link to set a password. The profile row
 * (clinic and role) is created here, so the clinic cannot be chosen by the caller.
 */
export const config = { runtime: "edge" };

const env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};
const ROLES = ["coordinator", "clinician", "admin"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = env.SUPABASE_URL;
  const ANON = env.SUPABASE_ANON_KEY;
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !ANON || !SERVICE) return json({ error: "Server is not configured" }, 500);

  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return json({ error: "Sign in required" }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: "Session expired. Sign in again." }, 401);
  const caller = (await userRes.json()) as { id: string };

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
  const profile = ((await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=clinic_id,role`, { headers: svc })).json()) as
    { clinic_id: string; role: string }[])[0];
  if (!profile || profile.role !== "admin") return json({ error: "Only an admin can invite staff" }, 403);

  let body: { email?: unknown; fullName?: unknown; role?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || !ROLES.includes(role)) {
    return json({ error: "Enter a valid email, name, and role" }, 400);
  }

  // Create the auth user and send the invite email.
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json" },
    body: JSON.stringify({ email, data: { full_name: fullName } }),
  });
  if (!inviteRes.ok) return json({ error: "Could not invite this email. It may already have an account." }, 409);
  const invited = (await inviteRes.json()) as { id?: string; user?: { id: string } };
  const newId = invited.id ?? invited.user?.id;
  if (!newId) return json({ error: "Invite failed" }, 502);

  // Attach the new user to the admin's clinic with the chosen role.
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ id: newId, clinic_id: profile.clinic_id, full_name: fullName, role }),
  });
  if (!profileRes.ok) return json({ error: "Invite sent, but the profile could not be created" }, 502);

  return json({ invited: true });
}
