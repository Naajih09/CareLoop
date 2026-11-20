import type { Referral } from "./types";

const KEY = "careloop.referrals.v1";

export function loadReferrals(fallback: Referral[]): Referral[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Referral[]) : fallback;
  } catch {
    return fallback; // storage blocked or corrupt: fall back to sample data
  }
}

export function saveReferrals(referrals: Referral[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(referrals));
  } catch {
    // storage unavailable: app keeps working in memory
  }
}

export function clearReferrals(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
