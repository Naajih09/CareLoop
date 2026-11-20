import type { Referral, Result, Urgency } from "./types";

/*
 * PLACEHOLDER RULES. These are demonstration logic only and must be replaced
 * with the clinically approved screening protocol before any real use.
 */
export const DAYS_TO_FOLLOW_UP: Record<Urgency, number | null> = {
  none: null,
  routine: 60,
  urgent: 14,
};

export function suggestUrgency(result: Result): Urgency {
  if (result === "positive") return "urgent";
  if (result === "borderline") return "routine";
  return "none";
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueDateFor(screenedOn: string, urgency: Urgency): string | null {
  const days = DAYS_TO_FOLLOW_UP[urgency];
  return days === null ? null : addDays(screenedOn, days);
}

export function isOverdue(r: Referral, todayIso: string): boolean {
  return r.status === "open" && r.dueBy !== null && r.dueBy < todayIso;
}

export interface Summary {
  total: number;
  pendingConfirmation: number;
  open: number;
  overdue: number;
  completed: number; // attended or treated
  lost: number;
  followUpRate: number; // completed / total, 0..1
}

export function summarize(referrals: Referral[], todayIso: string): Summary {
  const count = (pred: (r: Referral) => boolean) => referrals.filter(pred).length;
  const total = referrals.length;
  const completed = count((r) => r.status === "attended" || r.status === "treated");
  return {
    total,
    pendingConfirmation: count((r) => r.status === "pending_confirmation"),
    open: count((r) => r.status === "open"),
    overdue: count((r) => isOverdue(r, todayIso)),
    completed,
    lost: count((r) => r.status === "lost"),
    followUpRate: total === 0 ? 0 : completed / total,
  };
}

export function reminderText(r: Referral, clinicName = "your local health clinic"): string {
  const urgencyLine =
    r.confirmedUrgency === "urgent"
      ? "Your screening result needs prompt follow-up."
      : "Your screening result needs a follow-up visit.";
  return [
    `Hello, this is a reminder from ${clinicName}.`,
    urgencyLine,
    `Please visit the clinic by ${r.dueBy ?? "the date we discussed"} so a clinician can review your results.`,
    "Reply to this message or visit the clinic if you have questions.",
  ].join(" ");
}

export function toCsv(referrals: Referral[]): string {
  const header = [
    "id", "patientCode", "age", "result", "suggestedUrgency", "confirmedUrgency",
    "screenedOn", "dueBy", "contactAvailable", "status", "reminders",
  ];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = referrals.map((r) => header.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(","));
  return [header.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/*
 * Clinical protocol status. Do not change status to approved without a
 * signed approval from a named clinician or public-health lead and a citation.
 */
export const PROTOCOL = {
  version: "0.1-placeholder",
  status: "pending_clinical_approval" as const,
  approvedBy: null as string | null,
  source: null as string | null,
};

export function newPatientCode(): string {
  return `P-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
