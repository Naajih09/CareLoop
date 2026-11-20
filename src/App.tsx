import { useEffect, useState } from "react";
import type { Referral } from "./types";
import { toCsv, downloadText, PROTOCOL, newPatientCode } from "./rules";
import * as data from "./data";
import type { Session } from "./data";
import Dashboard from "./components/Dashboard";
import ScreeningForm from "./components/ScreeningForm";
import ReferralList from "./components/ReferralList";
import Login from "./components/Login";
import StaffPanel from "./components/StaffPanel";

type Tab = "dashboard" | "screening" | "referrals" | "staff";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    data.restoreSession().then(async (s) => {
      setSession(s);
      if (s) setReferrals(await data.loadReferrals());
      setChecked(true);
    });
  }, []);

  async function onSignedIn(s: Session) {
    setSession(s);
    setReferrals(await data.loadReferrals());
  }

  async function signOut() {
    await data.signOut();
    setSession(null);
    setReferrals([]);
  }

  async function addReferral(r: Referral) {
    setReferrals((prev) => [r, ...prev]);
    try {
      await data.createReferral(r, session!.clinicId, referrals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setReferrals(await data.loadReferrals());
    }
  }

  async function patch(id: string, p: Partial<Referral>) {
    const previous = referrals;
    setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    try {
      await data.patchReferral(id, p, previous);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setReferrals(await data.loadReferrals());
    }
  }

  async function sendReminder(r: Referral, phone: string) {
    await data.sendReminder(r.id, phone);
    setReferrals((prev) => prev.map((x) => (x.id === r.id ? { ...x, reminders: x.reminders + 1 } : x)));
  }

  if (!checked) return <div className="app"><p className="muted">Loading...</p></div>;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>CareLoop</h1>
          <p className="muted small">From screening result to follow-up care</p>
        </div>
        {session && (
          <nav>
            {(["dashboard", "screening", "referrals", ...(session.role === "admin" && !session.demo ? ["staff"] : [])] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? "active" : "secondary"} onClick={() => setTab(t)}>
                {t === "dashboard" ? "Dashboard" : t === "screening" ? "New screening" : t === "referrals" ? "Referrals" : "Staff"}
              </button>
            ))}
            <button className="secondary" onClick={() => downloadText("careloop-referrals.csv", toCsv(referrals))}>Export CSV</button>
            {session.demo ? null : <button className="secondary" onClick={signOut}>Sign out</button>}
          </nav>
        )}
      </header>

      {session && !session.demo && <p className="muted small">Signed in as {session.name} ({session.role})</p>}
      {session?.demo && <p className="notice">Demo mode: sample data, saved in this browser only. Sign-in and SMS need the live version.</p>}
      {error && <p className="notice error" onClick={() => setError(null)}>{error} (tap to dismiss)</p>}

      <main>
        {!session && <Login onSignedIn={onSignedIn} />}
        {session && tab === "dashboard" && <Dashboard referrals={referrals} todayIso={todayIso} />}
        {session && tab === "screening" && (
          <ScreeningForm nextCode={newPatientCode()} onCreate={addReferral} />
        )}
        {session && tab === "staff" && <StaffPanel />}
        {session && tab === "referrals" && (
          <ReferralList
            referrals={referrals}
            todayIso={todayIso}
            session={session}
            onPatch={patch}
            onSendReminder={sendReminder}
          />
        )}
      </main>

      <footer className="muted small">
        Prototype. Urgency rules are placeholders: protocol v{PROTOCOL.version}, status “{PROTOCOL.status.replace(/_/g, " ")}”.
        Not for clinical use until a clinician approves the protocol.
      </footer>
    </div>
  );
}
