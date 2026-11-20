# CareLoop

CareLoop closes the loop between a health screening result and follow-up care. Clinic staff record a screening result, a clinician confirms the urgency, and a care coordinator sends an SMS reminder and tracks each referral until it is attended, treated, or marked lost.

## What the app does

- **Shared database** (Supabase) so the whole clinic sees the same referrals.
- **Staff sign-in** with three roles: coordinator, clinician, admin.
- **Database-enforced permissions:** only clinicians and admins can confirm urgency. This is checked in the database, not just the browser.
- **SMS reminders** through Twilio, sent by a server-side function. Keys never reach the browser.
- **Staff invites:** admins invite colleagues by email from the Staff tab.
- **CSV export** for pilot reporting.
- **Demo mode:** runs with no setup, using sample data in one browser.

## Status: read before using

- The urgency rules in `src/rules.ts` are **placeholders**. `PROTOCOL.status` is `pending_clinical_approval`. Do not use the app for clinical decisions until a named clinician approves the protocol and it is cited.
- The app has not been tested against a live Supabase project or Twilio account in this repository. Test it end to end before any pilot.

## Run locally

```bash
npm install
cp .env.example .env     # fill in the VITE_ values
npm run dev
```

Without the `VITE_` values the app runs in demo mode.

---

## Your steps (things only you can do)

Work through these in order. Each step says what to check when it's done.

### 1. Get the clinical protocol approved (required before any real use)

1. Ask a clinician or public-health lead to review the thresholds in `src/rules.ts`: positive results → urgent (14 days), borderline → routine (60 days).
2. Get a written approval that names the approver, the date, and the version.
3. Provide a citation for the source of the protocol.
4. Update `PROTOCOL` in `src/rules.ts` with `status`, `approvedBy`, `source`, and a new `version`. Also update the footer text in `src/App.tsx` if you change the wording.

Done when: `PROTOCOL.status` is no longer `pending_clinical_approval` and the approver and source are filled in.

### 2. Create the Supabase project

1. Go to supabase.com, create a project, and choose a region close to your users.
2. Open **Project Settings → API**. Copy the **Project URL** and the **anon public key**.
3. Copy the **service_role key**. Keep it private: never commit it or paste it in a public place.

### 3. Create the database tables

1. In Supabase, open **SQL Editor**, paste the entire contents of `supabase/schema.sql`, and run it.
2. Check: **Table Editor** shows `profiles` and `clinic_referrals`.

### 4. Create the first admin account

1. In Supabase, open **Authentication → Users → Add user → Create new user**. Enter your email and a strong password.
2. Copy the user's **UUID** from the users list.
3. Choose a clinic ID. Any UUID works, for example from https://www.uuidgenerator.net.
4. In **SQL Editor**, run:

```sql
insert into public.profiles (id, clinic_id, full_name, role)
values ('YOUR-USER-UUID', 'YOUR-CLINIC-UUID', 'Your Name', 'admin');
```

Done when: you can sign in to the app and see the Staff tab.

### 5. Set the invite redirect (so invited staff can set a password)

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address (for example `https://careloop.vercel.app`).
3. Add the same address under **Redirect URLs**.

Done when: an invite email links back to your app.

### 6. Set up Twilio for SMS

1. Create a Twilio account at twilio.com.
2. Buy an SMS-capable phone number.
3. Check Twilio's coverage for **Nigeria** and the route you need. Sender-ID and route rules vary by country and can block messages.
4. Copy the **Account SID**, **Auth Token**, and your Twilio number.
5. Trial accounts can only message phone numbers you verify in Twilio. Upgrade the account before the pilot.

Done when: a test message reaches a verified phone.

### 7. Deploy on Vercel

1. Create a GitHub repository named `careloop` and push this code:

```bash
git remote add origin https://github.com/YOUR-USERNAME/careloop.git
git push -u origin main
```

2. In Vercel, choose **Add New Project**, import the repository, and use these settings: Framework **Vite**, Build command `npm run build`, Output directory `dist`.
3. Under **Environment Variables**, add each of these:

| Name | Value | Sensitive? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | No |
| `SUPABASE_URL` | Supabase Project URL | No |
| `SUPABASE_ANON_KEY` | Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | **Yes** |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | No |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | **Yes** |
| `TWILIO_FROM` | Your Twilio number, e.g. `+1...` | No |
| `CLINIC_NAME` | Your clinic's name, shown in reminders | No |

4. Click **Deploy**, then **Redeploy** after adding variables if the first build ran without them.

Done when: the live URL loads and you can sign in.

### 8. Test every flow on the live site

- [ ] Sign in as admin. Invite a coordinator and a clinician from the Staff tab. Check that each invite email arrives.
- [ ] Sign in as the coordinator. Create a positive screening. Confirm the coordinator **cannot** see the confirm buttons.
- [ ] Sign in as the clinician. Confirm the referral. Check that its due date appears.
- [ ] Send an SMS reminder to a verified phone number. Check that the reminder count goes up.
- [ ] Mark a referral attended, treated, and lost.
- [ ] Export the CSV and check that it contains no names or phone numbers.
- [ ] Try the coordinator's confirm action directly against the database and check that it is refused.

### 9. Prepare the submission

1. Record a demo video under 3 minutes, showing the live site. Upload it and make the link viewable by anyone.
2. Update the submission form: stage **Prototype**, paste the Vercel link into "Prototype / Deployment Link", and export the deck as a PDF under 5 MB.
3. In the deck, fill the placeholder on slide 7 with verified citations, and add judge test accounts on slide 11 (or remove that line).
4. On slide 2, confirm your age and team details.
5. Check that every claim in the deck matches what the live app does.

### 10. Before any real patient data

- Complete a data protection assessment under the Nigeria Data Protection Act 2023.
- Get consent and clinic approval for the pilot.
- Turn on Supabase backups and check the database region.

---

## Deploying updates

Push to the `main` branch. Vercel redeploys automatically.

## Privacy

- Records use an anonymized patient code, never a name.
- The phone number is entered when a reminder is sent. It goes to Twilio and is not stored in the database.
- The service-role key and Twilio token live only in server environment variables.

## Project layout

- `src/rules.ts`: urgency rules, due dates, overdue logic, and the protocol status
- `src/data.ts`: the data layer; uses Supabase when configured, otherwise demo mode
- `src/components/`: sign-in, screening form, referral list, dashboard, staff invites
- `api/send-reminder.ts`: SMS reminder function (Vercel Edge)
- `api/invite-staff.ts`: staff invite function (Vercel Edge)
- `supabase/schema.sql`: tables, row-level security, and the role guard
