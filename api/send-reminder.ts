/*
 * Vercel Edge Function. Sends an SMS reminder through Twilio.
 * Secrets live only in Vercel environment variables, never in the browser.
 * The patient's phone number is used for the send and is not stored.
 */
export const config = { runtime: "edge" };

const env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const E164 = /^\+[1-9]\d{6,14}$/;
const ROLES = ["coordinator", "clinician", "admin"];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = env.SUPABASE_URL;
  const ANON = env.SUPABASE_ANON_KEY;
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
  const SID = env.TWILIO_ACCOUNT_SID;
  const TOKEN = env.TWILIO_AUTH_TOKEN;
  const FROM = env.TWILIO_FROM;
  if (!SUPABASE_URL || !ANON || !SERVICE || !SID || !TOKEN || !FROM) {
    return json({ error: "Server is not configured" }, 500);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return json({ error: "Sign in required" }, 401);

  // 1. Who is calling?
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: "Session expired. Sign in again." }, 401);
  const user = (await userRes.json()) as { id: string };

  // 2. What clinic and role do they have?
  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=clinic_id,role`,
    { headers: svc }
  );
  const profile = ((await profRes.json()) as { clinic_id: string; role: string }[])[0];
  if (!profile || !ROLES.includes(profile.role)) {
    return json({ error: "Your account is not set up for CareLoop" }, 403);
  }

  // 3. Validate the request.
  let body: { referralId?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (typeof body.referralId !== "string" || typeof body.phone !== "string" || !E164.test(body.phone)) {
    return json({ error: "Enter the patient's phone number in international format, e.g. +2348012345678" }, 400);
  }

  // 4. Referral must belong to the caller's clinic and be open.
  const refRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clinic_referrals?id=eq.${encodeURIComponent(body.referralId)}` +
      `&select=id,clinic_id,status,reminders,due_by`,
    { headers: svc }
  );
  const ref = ((await refRes.json()) as {
    id: string; clinic_id: string; status: string; reminders: number; due_by: string | null;
  }[])[0];
  if (!ref || ref.clinic_id !== profile.clinic_id) return json({ error: "Referral not found" }, 404);
  if (ref.status !== "open") return json({ error: "Reminders can only be sent for open referrals" }, 409);

  // 5. Send through Twilio.
  const clinic = env.CLINIC_NAME ?? "your health clinic";
  const message =
    `Reminder from ${clinic}: please visit by ${ref.due_by ?? "the date we discussed"} ` +
    `so a clinician can review your screening result. Reply or visit the clinic if you have questions.`;
  const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${SID}:${TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: body.phone, From: FROM, Body: message }),
  });
  if (!twilioRes.ok) return json({ error: "The SMS provider rejected the message" }, 502);
  const sent = (await twilioRes.json()) as { sid: string };

  // 6. Log the reminder atomically (no read-modify-write race).
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_reminders`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json" },
    body: JSON.stringify({ ref_id: ref.id }),
  });

  return json({ sent: true, sid: sent.sid });
}
