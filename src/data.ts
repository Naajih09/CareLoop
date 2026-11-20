import { createClient } from "@supabase/supabase-js";
import type { Referral, Result, Status, Urgency } from "./types";
import { seedReferrals } from "./seed";
import { loadReferrals as loadLocal, saveReferrals as saveLocal } from "./storage";

export type Role = "coordinator" | "clinician" | "admin";
export interface Session {
  role: Role;
  clinicId: string;
  name: string;
  demo: boolean;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const liveMode = Boolean(url && anon);
const sb = liveMode ? createClient(url!, anon!) : null;

const demoSession: Session = { role: "admin", clinicId: "demo", name: "Demo user", demo: true };

interface Row {
  id: string;
  patient_code: string;
  age: number;
  result: Result;
  suggested_urgency: Urgency;
  confirmed_urgency: Urgency | null;
  screened_on: string;
  due_by: string | null;
  contact_available: boolean;
  status: Status;
  reminders: number;
}

const fromRow = (r: Row): Referral => ({
  id: r.id,
  patientCode: r.patient_code,
  age: r.age,
  result: r.result,
  suggestedUrgency: r.suggested_urgency,
  confirmedUrgency: r.confirmed_urgency,
  screenedOn: r.screened_on,
  dueBy: r.due_by,
  contactAvailable: r.contact_available,
  status: r.status,
  reminders: r.reminders,
});

const toRow = (p: Partial<Referral>): Record<string, unknown> => {
  const map: Record<string, string> = {
    patientCode: "patient_code",
    age: "age",
    result: "result",
    suggestedUrgency: "suggested_urgency",
    confirmedUrgency: "confirmed_urgency",
    screenedOn: "screened_on",
    dueBy: "due_by",
    contactAvailable: "contact_available",
    status: "status",
    reminders: "reminders",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (map[k]) out[map[k]] = v;
  return out;
};

async function profileFor(userId: string): Promise<Session> {
  const { data, error } = await sb!
    .from("profiles")
    .select("clinic_id, role, full_name")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("This account is not set up for CareLoop. Ask an admin to add you.");
  return {
    role: data.role as Role,
    clinicId: data.clinic_id,
    name: data.full_name ?? "Staff",
    demo: false,
  };
}

export async function restoreSession(): Promise<Session | null> {
  if (!sb) return demoSession;
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  try {
    return await profileFor(data.session.user.id);
  } catch {
    await sb.auth.signOut();
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<Session> {
  if (!sb) return demoSession;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error("Email or password is incorrect.");
  return profileFor(data.user.id);
}

export async function signOut(): Promise<void> {
  await sb?.auth.signOut();
}

export async function loadReferrals(): Promise<Referral[]> {
  if (!sb) return loadLocal(seedReferrals);
  const { data, error } = await sb
    .from("clinic_referrals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load referrals.");
  return (data as Row[]).map(fromRow);
}

export async function createReferral(r: Referral, clinicId: string, all: Referral[]): Promise<void> {
  if (!sb) {
    saveLocal([r, ...all]);
    return;
  }
  const { data: u } = await sb.auth.getUser();
  const { error } = await sb.from("clinic_referrals").insert({
    id: r.id,
    clinic_id: clinicId,
    created_by: u.user?.id,
    ...toRow(r),
  });
  if (error) throw new Error("Could not save the referral. Check your connection and try again.");
}

export async function patchReferral(id: string, patch: Partial<Referral>, all: Referral[]): Promise<void> {
  if (!sb) {
    saveLocal(all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return;
  }
  const { error } = await sb.from("clinic_referrals").update(toRow(patch)).eq("id", id);
  if (error) throw new Error(error.message.includes("Only a clinician")
    ? "Only a clinician or admin can confirm urgency."
    : "Could not save the change. Try again.");
}

export async function sendReminder(referralId: string, phone: string): Promise<void> {
  if (!sb) throw new Error("SMS reminders need the live version with a sign-in.");
  const { data } = await sb.auth.getSession();
  const res = await fetch("/api/send-reminder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ referralId, phone }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Reminder failed. Try again.");
}

export async function inviteStaff(email: string, fullName: string, role: Role): Promise<void> {
  if (!sb) throw new Error("Staff invites need the live version.");
  const { data } = await sb.auth.getSession();
  const res = await fetch("/api/invite-staff", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ email, fullName, role }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Invite failed.");
}
