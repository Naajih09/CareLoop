import { useState } from "react";
import type { Referral, Result } from "../types";
import { suggestUrgency, dueDateFor } from "../rules";

interface Props {
  onCreate: (r: Referral) => void;
  nextCode: string;
}

export default function ScreeningForm({ onCreate, nextCode }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [age, setAge] = useState("");
  const [result, setResult] = useState<Result>("negative");
  const [screenedOn, setScreenedOn] = useState(today);
  const [contactAvailable, setContactAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
      setMessage("Enter a valid age (0 to 120).");
      return;
    }
    if (result === "negative") {
      setMessage("Negative result: no referral needed. Nothing was added to the referral list.");
      setAge("");
      return;
    }
    const suggested = suggestUrgency(result);
    const referral: Referral = {
      id: crypto.randomUUID(),
      patientCode: nextCode,
      age: ageNum,
      result,
      suggestedUrgency: suggested,
      confirmedUrgency: null,
      screenedOn,
      dueBy: dueDateFor(screenedOn, suggested),
      contactAvailable,
      status: "pending_confirmation",
      reminders: 0,
    };
    onCreate(referral);
    setMessage(`Referral ${referral.patientCode} created. A clinician needs to confirm the urgency before follow-up starts.`);
    setAge("");
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>New screening result</h2>
      <p className="muted">Record only an anonymized code and the minimum data needed for follow-up.</p>

      <label>
        Patient code
        <input value={nextCode} readOnly />
      </label>
      <label>
        Age
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
      </label>
      <label>
        Screening date
        <input type="date" value={screenedOn} max={today} onChange={(e) => setScreenedOn(e.target.value)} required />
      </label>
      <label>
        Result
        <select value={result} onChange={(e) => setResult(e.target.value as Result)}>
          <option value="negative">Negative</option>
          <option value="borderline">Borderline</option>
          <option value="positive">Positive</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={contactAvailable} onChange={(e) => setContactAvailable(e.target.checked)} />
        Patient contact details are on file
      </label>

      <button type="submit">Save screening</button>
      {message && <p className="notice">{message}</p>}
    </form>
  );
}
