import type { Referral } from "./types";
import { dueDateFor } from "./rules";

// Synthetic sample records only. No real patient data.
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

function make(
  id: string,
  patientCode: string,
  age: number,
  result: Referral["result"],
  screenedOn: string,
  status: Referral["status"],
  contactAvailable: boolean,
  reminders: number,
  urgency: "routine" | "urgent" = result === "positive" ? "urgent" : "routine"
): Referral {
  return {
    id,
    patientCode,
    age,
    result,
    suggestedUrgency: result === "positive" ? "urgent" : "routine",
    confirmedUrgency: status === "pending_confirmation" ? null : urgency,
    screenedOn,
    dueBy: status === "pending_confirmation" ? null : dueDateFor(screenedOn, urgency),
    contactAvailable,
    status,
    reminders,
  };
}

export const seedReferrals: Referral[] = [
  make("r1", "P-0101", 52, "positive", daysAgo(20), "open", true, 1, "urgent"),
  make("r2", "P-0102", 44, "borderline", daysAgo(5), "pending_confirmation", true, 0),
  make("r3", "P-0103", 61, "positive", daysAgo(35), "treated", true, 2, "urgent"),
  make("r4", "P-0104", 38, "borderline", daysAgo(70), "lost", false, 3, "routine"),
  make("r5", "P-0105", 47, "borderline", daysAgo(10), "attended", true, 1, "routine"),
];
