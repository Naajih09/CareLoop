import type { Referral } from "../types";
import { summarize } from "../rules";

export default function Dashboard({ referrals, todayIso }: { referrals: Referral[]; todayIso: string }) {
  const s = summarize(referrals, todayIso);
  const pct = Math.round(s.followUpRate * 100);
  const stats: [string, number | string][] = [
    ["Total referrals", s.total],
    ["Awaiting clinician confirmation", s.pendingConfirmation],
    ["Open", s.open],
    ["Overdue", s.overdue],
    ["Completed (attended or treated)", s.completed],
    ["Lost to follow-up", s.lost],
    ["Follow-up rate", `${pct}%`],
  ];
  return (
    <section>
      <h2>Loop closure dashboard</h2>
      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="card stat" key={label}>
            <div className="value">{value}</div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>
      <p className="muted small">
        Follow-up rate is completed referrals divided by all referrals. Overdue means an open referral past its due date.
      </p>
    </section>
  );
}
