import { useState } from "react";
import type { Role } from "../data";
import { inviteStaff } from "../data";

export default function StaffPanel() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("coordinator");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await inviteStaff(email, fullName, role);
      setMessage({ ok: true, text: `Invite sent to ${email}. They will set a password from the email link.` });
      setEmail("");
      setFullName("");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Invite failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Invite staff</h2>
      <p className="muted small">Only admins see this. Each invitee gets an email to set their password.</p>
      <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="coordinator">Coordinator (records and follows up)</option>
          <option value="clinician">Clinician (also confirms urgency)</option>
          <option value="admin">Admin (also invites staff)</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>{busy ? "Sending..." : "Send invite"}</button>
      {message && <p className={`notice ${message.ok ? "" : "error"}`}>{message.text}</p>}
    </form>
  );
}
