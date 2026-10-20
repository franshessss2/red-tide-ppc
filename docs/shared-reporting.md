# Shared reporting release

This release connects live-mode web, Android and Windows clients to the same
Firebase project (`red-tide-ppc`) and collection paths:

- `datasets/community-v1/zones`
- `datasets/community-v1/reports`

The owner identified the seven legacy root advisory flags as old test data on
21 October 2026. Root `zones` and `reports` are preserved; neither they nor local
sample records are imported into the shared feed. New zone records have geometry
and descriptions but **no status**, and no record-update date. They display
**Status unavailable** until an approved administrator reviews them. No missing
warning should be interpreted as safe water or seafood.

**Community records, not an official clearance.**

## Operator activation

1. Run `npm run test:rules`, `npm run test:sync`, unit tests and the build.
2. Back up existing deployed rules and records through trusted project access.
3. Provision only missing clean zones with `npx tsx scripts/provision-shared-zones.ts`
   (dry run), then `--apply` with Application Default Credentials and explicit
   `GOOGLE_CLOUD_PROJECT=red-tide-ppc`. Creation is conditional; existing records
   are never overwritten. Do not use the legacy `npm run seed -- --force`.
4. Deploy the tested Firestore rules. Enable Firebase Auth Google sign-in and add
   exact hosted domains to its authorized-domain list.
5. The intended admin signs in once with Google, then a trusted operator verifies
   that Firebase user and grants its admin claim using the reviewed admin-claims
   procedure. Email text alone never grants access. Keep approval/rejection manual.
6. Configure the five public `VITE_FIREBASE_*` identifiers on the intended Vercel
   environment, unset forced demo mode, and set `VITE_REQUIRE_FIREBASE=true`.
   Preview and review first; no legacy flags become public warnings in this feed.
7. Publish the reviewed website, then run **Native download checks** manually with
   `live=true`. `/api/client-config` supplies only the allowlisted browser config,
   the project and `community-v1` contract. An unavailable or incompatible endpoint
   fails the native build; it never silently produces a sample release. The normal
   PR workflow continues producing isolated sample test builds.
8. Verify build metadata says `dataMode: firebase`, inspect both packaged apps,
   preserve the Android signing certificate, then replace the two established Drive
   files and update the laptop's installed app with its profile backed up.

## Behavior and limits

An online report becomes pending after server acknowledgment. Every connected
client receives it from Firestore listeners. Submission alone never changes a zone.
An approved administrator manually confirms/rejects; review results and deliberate
zone changes reach all connected clients. Native apps open hosted Admin in the
system browser, avoiding embedded Google OAuth and local passcode moderation.

Without connectivity a write can remain pending in the current SDK session; it is
not a successful shared submission until acknowledged. Do not close the form/app
while it is sending. This release does not promise a durable offline outbox across
app restarts. Feed labels distinguish cached/unacknowledged records from server
delivery. A synced backend does not establish that a coast was scientifically tested.

Local sample records/settings remain stored separately on each device and are not
uploaded automatically. Installed apps need these new downloads; this is not an
automatic application updater. Photo attachment requires an optional configured
Cloudinary unsigned upload preset; text-only reporting does not need Cloudinary.
Reports are publicly readable under the existing product model. Do not submit
personal contact details; abuse prevention/rate limiting remains separate work.

## Acceptance evidence

`npm run test:sync` uses the real Firestore SDK and deployed-rule source against
an explicit local emulator. Three independent clients exercise pending report
fan-out, rejected anonymous moderation, admin confirmation and zone propagation,
offline reconnection without duplicate documents, and rejection without zone change.
It does not submit synthetic reports into the real community feed or prove physical
phone behavior. `npm run test:rules` tests both the legacy and new namespace against
anonymous users, ordinary accounts, forged claims and the approved admin token.

Before calling the physical three-device flow verified: install the new APK, submit
a genuine observation once, check its matching report ID on website and laptop,
then manually review it in hosted Admin and check the same result on all three.
Keep hardware and production activation results distinct from emulator checks.
