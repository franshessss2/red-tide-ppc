# Hosted administrator sign-in

The website handles Google administrator sign-in. Current live Android and
Windows builds open `https://red-tide-ppc.vercel.app/admin` in the system browser;
a hosted sign-in fix does not require new native installers.

Auth starts with browser-session persistence and the Firebase popup resolver.
The button requests the Google popup without first awaiting a persistence
transition. Account selection, verified Google administrator claims, manual
review and Firestore authorization remain required.

The UI explains allowlisted Firebase failures individually instead of calling
every failure a popup problem. Raw SDK messages, credentials, custom data and
arbitrary error codes are never displayed or logged by this handler.

- `auth/popup-blocked`: allow popups for the exact RTP origin, reload and retry.
- `auth/popup-closed-by-user`: finish the Google window before closing it.
- `auth/cancelled-popup-request`: use the latest sign-in attempt.
- `auth/unauthorized-domain`: an operator must inspect the project's authorized
  domains. Do not automatically authorize arbitrary preview hosts.
- Network, unavailable storage and disabled-provider errors have their own
  explanations. Unrecognized errors use a neutral retry message.

On 23 October 2026 the owner reported successful Helium sign-in on the local
compatibility build at `http://127.0.0.1:4193/admin`. This is owner-reported
browser acceptance, not automated evidence of a production administrator session.
Production and `127.0.0.1` were verified as existing authorized domains;
`localhost` was not, so no new auth-domain permissions were added for this test.

No rules, claims, production records or browser security settings were changed.
