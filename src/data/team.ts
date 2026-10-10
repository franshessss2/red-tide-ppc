/**
 * The landing "Team" strip.
 *
 * PLACEHOLDER ROSTER — the three `name` strings below are stand-ins. Replace
 * them (and, if you like, the clip files they point at) with the real team;
 * nothing else in the section needs to change.
 *
 * While the roster is still placeholders, `TEAM_SECTION_ENABLED` stays `false`
 * and `<TeamSection />` renders nothing. Flip it to `true` once real names (and
 * clips, if desired) are in — that single constant is the on/off switch.
 *
 * `videoSrc` is optional on purpose: a member with no clip keeps the still
 * poster, and the section never mounts a decoder for them. Clips live in
 * `public/media/team/` and are played under the single-decoder policy in
 * `src/motion/videoSlot.ts` — see `TeamSection.tsx`.
 */
export interface TeamMember {
  id: string
  name: string
  role: string
  /** One clause only. The phone cards are capped at 120px tall. */
  detail: string
  /** Two characters, shown on the poster the video crossfades over. */
  initials: string
  videoSrc?: string
}

/**
 * Single on/off switch for the whole strip. `false` while `TEAM_MEMBERS` below
 * still contains placeholder entries; the landing then renders nothing where
 * the section would be. Set `true` once the real roster replaces them.
 */
export const TEAM_SECTION_ENABLED = false

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    id: 'reports',
    name: 'Team member 01',
    role: 'Reports & photo triage',
    detail: 'Reviews what people send in from the water.',
    initials: '01',
    videoSrc: '/media/team/member-01.mp4',
  },
  {
    id: 'zones',
    name: 'Team member 02',
    role: 'Zone records & advisories',
    detail: 'Keeps the seven coastal zones honest.',
    initials: '02',
    videoSrc: '/media/team/member-02.mp4',
  },
  {
    id: 'devices',
    name: 'Team member 03',
    role: 'Device link & data',
    detail: 'Wires the ESP32 buoy to the live feed.',
    initials: '03',
    videoSrc: '/media/team/member-03.mp4',
  },
]
