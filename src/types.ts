export type Result = "negative" | "borderline" | "positive";
export type Urgency = "none" | "routine" | "urgent";
export type Status = "pending_confirmation" | "open" | "attended" | "treated" | "lost";

export interface Referral {
  id: string;
  patientCode: string; // anonymized code, never a name
  age: number;
  result: Result;
  suggestedUrgency: Urgency;
  confirmedUrgency: Urgency | null;
  screenedOn: string; // YYYY-MM-DD
  dueBy: string | null; // YYYY-MM-DD, set once confirmed
  contactAvailable: boolean;
  status: Status;
  reminders: number;
}
