# Administrator access

Firebase mode uses Google sign-in. A verified Google identity must also carry
the boolean custom claim `admin: true`, assigned by a trusted project operator.
Knowing an email address, knowing the public demo passcode, or changing browser
storage does not grant Firebase permissions. No Google passwords belong in
source, VITE variables, build artifacts or this setup process.

## Activation checklist (manual, separate from merging this PR)

1. Confirm the intended Firebase project and export/back up its current rules.
   Review existing zone/report document shapes before tightening validation.
2. In Firebase Authentication, enable Google and configure its support email.
   Add the intended web deployment's exact domain under authorized domains.
   Do not broadly authorize unrelated previews. Firebase web config must be
   present for the web build; sample-mode builds do not use this login.
3. Sign in on the web with the intended owner account. It initially shows
   **no administrator access**. Verify that account's UID, verified email and
   Google provider in the intended Firebase project's Authentication users.
   Do not approve an account from its display name alone.
4. On a trusted workstation, authenticate Application Default Credentials with
   suitably restricted project permissions. Keep any private credentials outside
   this repository. The utility below defaults to a read-only preview, compares
   BOTH UID and email, refuses disabled/unverified/non-Google accounts on grant,
   and preserves unrelated custom claims:

   ```sh
   node scripts/admin-claims.mjs --project PROJECT_ID --uid VERIFIED_UID --email VERIFIED_EMAIL --grant
   # Only after reviewing the preview and approving the exact identity:
   node scripts/admin-claims.mjs --project PROJECT_ID --uid VERIFIED_UID --email VERIFIED_EMAIL --grant --apply
   ```

5. Run `npm run test:rules`. Deploy the reviewed `firestore.rules` to the explicit
   project using `npx firebase deploy --only firestore:rules --project PROJECT_ID`.
   Merging or deploying the Vercel frontend does **not** deploy Firestore rules.
   Do not assume the old, permissive rules became secure with a frontend deploy.
6. Sign out/in to obtain the new claim. Verify the live public pending report
   submission, authorized approval/rejection/zone update, and an ordinary user's
   denied writes against staging before using production data. This is a manual
   acceptance test; mocked/emulator tests are not proof of live configuration.

## Behavior and boundaries

- `/admin` ignores the legacy store/sessionStorage unlock flag in Firebase mode.
  The Firebase backend also checks the token before moderation SDK writes.
  Deployed rules are the actual enforcement boundary, including direct REST/SDK
  requests that bypass the page. Checking/loading/error states stay locked.
- Google sign-in requests session persistence (for the browser tab/session).
  Sign out explicitly on shared machines. A rejected popup/network operation
  shows an error without silently falling back to the demo passcode.
- Tokens refresh through the Firebase SDK. When it reports lost admin claims,
  moderation controls unmount. Changing claims is not instant revocation of an
  already-issued token: it can remain valid for up to one hour. To remove an
  admin, preview then apply the same utility with `--revoke`, which removes only
  the admin claim and revokes refresh tokens. Follow Firebase's session-revocation
  procedure if immediate invalidation is required; this PR does not implement
  a database-backed revocation-time check.
- Public map reads and pending-report submissions remain available. Reports
  remain publicly readable to preserve the current feed/map behavior. This PR
  does not solve report privacy, upload abuse, rate limiting or audit history.
- Zone creation/geometry/deletion is denied to browser clients, including admins.
  The old public-web-config `npm run seed` can no longer provision zones under
  these rules. Existing zones remain readable. Use a separately reviewed trusted
  Admin SDK provisioning process; never reopen public creation just to seed.
- Approval still consists of the existing report write followed by the zone
  write; the existing partial-failure message remains. This PR does not make that
  operation atomic.
- Missing Firebase configuration still selects the existing local sample backend.
  Sample-mode web, Android and Windows builds retain the public **demo** lock;
  they are not authenticated moderation clients. Google OAuth inside the native
  wrappers is not verified or offered as a native login integration here.
- Keep the label **Community records, not an official clearance.**

## Tests and dependencies

`npm test` covers claim checks, auth listener cleanup/races, denied/error states,
forged legacy unlock state, and the Firebase mutation guard. `npm run test:rules`
runs the real Firestore rules in a localhost emulator using only the reserved
`demo-red-tide-admin` project. It refuses to run against a non-local host.
CI runs this as a separate read-only job, without Firebase credentials.
`npm run test:admin-tool` verifies preview-only defaults, explicit identity checks,
claim preservation and revocation with a fake Admin SDK adapter (no live writes).

Existing `firebase` supplies browser Auth; no new runtime dependency was added.
New development-only dependencies are `@firebase/rules-unit-testing` (assert real
rule allow/deny outcomes), `firebase-tools` (run the local emulator and explicit
operator deployments) and `firebase-admin` (trusted workstation claim utility).
The Admin SDK is never imported by browser code or deployed API routes.

## Rollback

If sign-in setup is incomplete, keep Firebase moderation locked and diagnose
the provider/domain/claim configuration. Do not restore the old unauthenticated
moderation rules as a shortcut. A frontend rollback must preserve the secure
database rules, even if that temporarily disables moderation in older builds.

References: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[custom claims](https://firebase.google.com/docs/auth/admin/custom-claims),
[rules tests](https://firebase.google.com/docs/rules/unit-tests),
[session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
