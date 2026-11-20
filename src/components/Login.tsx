import { useState } from "react";
import type { Session } from "../data";
import { signIn } from "../data";

export default function Login({ onSignedIn }: { onSignedIn: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signIn(email.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form login" onSubmit={submit}>
      <h2>Sign in to CareLoop</h2>
      <p className="muted small">Accounts are created by your clinic administrator.</p>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      {error && <p className="notice error">{error}</p>}
    </form>
  );
}
