import { useState } from "react";
import type { Referral, Status, Urgency } from "../types";
import { isOverdue, dueDateFor, reminderText } from "../rules";
import { liveMode } from "../data";
import type { Session } from "../data";

interface Props {
  referrals: Referral[];
  todayIso: string;
  session: Session;
  onPatch: (id: string, patch: Partial<Referral>) => void;
  onSendReminder: (r: Referral, phone: string) => Promise<void>;
}

const LABELS: Record<Status, string> = {
  pending_confirmation: "Awaiting confirmation",
  open: "Open",
  attended: "Attended",
  treated: "Treated",
  lost: "Lost to follow-up",
};

export default function ReferralList({ referrals, todayIso, session, onPatch, onSendReminder }: Props) {
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const canConfirm = session.role === "clinician" || session.role === "admin";

  function confirm(r: Referral, urgency: Urgency) {
    onPatch(r.id, { confirmedUrgency: urgency, dueBy: dueDateFor(r.screenedOn, urgency), status: "open" });
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function send(r: Referral) {
    setNotices((n) => ({ ...n, [r.id]: "Sending..." }));
    try {
      await onSendReminder(r, phones[r.id] ?? "");
      setNotices((n) => ({ ...n, [r.id]: "Reminder sent and logged." }));
      setPhones((p) => ({ ...p, [r.id]: "" }));
    } catch (err) {
      setNotices((n) => ({ ...n, [r.id]: err instanceof Error ? err.message : "Reminder failed." }));
    }
  }

  if (referrals.length === 0) {
    return <p className="muted">No referrals yet. Save a positive or borderline screening to create one.</p>;
  }

  return (
    <section>
      <h2>Referrals</h2>
      <div className="list">
        {referrals.map((r) => {
          const overdue = isOverdue(r, todayIso);
          return (
            <article className={`card referral ${overdue ? "overdue" : ""}`} key={r.id}>
              <header>
                <strong>{r.patientCode}</strong>
                <span className="muted"> · age {r.age} · screened {r.screenedOn}</span>
                <span className={`badge ${r.status}`}>{overdue ? "Overdue" : LABELS[r.status]}</span>
              </header>
              <p className="muted small">
                Result: {r.result}. Suggested urgency: {r.suggestedUrgency}.
                {r.confirmedUrgency && ` Confirmed: ${r.confirmedUrgency}, due ${r.dueBy}.`}
                {!r.contactAvailable && " No contact details on file: arrange a coordinator call."}
                {` Reminders logged: ${r.reminders}.`}
              </p>

              {r.status === "pending_confirmation" && (
                canConfirm ? (
                  <div className="actions">
                    <button onClick={() => confirm(r, r.suggestedUrgency)}>Confirm {r.suggestedUrgency}</button>
                    <button className="secondary" onClick={() => confirm(r, "routine")}>Confirm as routine</button>
                    <button className="secondary" onClick={() => confirm(r, "urgent")}>Confirm as urgent</button>
                  </div>
                ) : (
                  <p className="small muted">Waiting for a clinician to confirm the urgency.</p>
                )
              )}

              {r.status === "open" && (
                <>
                  <div className="actions">
                    {liveMode ? (
                      <>
                        <input
                          className="phone"
                          placeholder="+234..."
                          value={phones[r.id] ?? ""}
                          onChange={(e) => setPhones((p) => ({ ...p, [r.id]: e.target.value }))}
                        />
                        <button className="secondary" onClick={() => send(r)}>Send SMS reminder</button>
                      </>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() => {
                          setDraft({ id: r.id, text: reminderText(r) });
                          setCopied(false);
                        }}
                      >
                        Prepare reminder
                      </button>
                    )}
                    <button onClick={() => onPatch(r.id, { status: "attended" })}>Mark attended</button>
                    <button onClick={() => onPatch(r.id, { status: "treated" })}>Mark treated</button>
                    <button className="danger" onClick={() => onPatch(r.id, { status: "lost" })}>Mark lost</button>
                  </div>
                  {notices[r.id] && <p className="small">{notices[r.id]}</p>}

                  {!liveMode && draft && draft.id === r.id && (
                    <div className="reminder">
                      <textarea readOnly rows={4} value={draft.text} />
                      <div className="actions">
                        <button className="secondary" onClick={copyDraft}>{copied ? "Copied" : "Copy message"}</button>
                        <button onClick={() => { onPatch(r.id, { reminders: r.reminders + 1 }); setDraft(null); }}>
                          I sent it: log reminder
                        </button>
                        <button className="secondary" onClick={() => setDraft(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
