/**
 * The landing "Team" strip.
 *
 * ROSTER SHAPE IS FINAL — three entries, in this order: Creator, then
 * Front-end and back-end developer, then Tester. The `role` strings and the
 * six asset paths below are the real ones and must not be edited.
 *
 * WHAT IS STILL A STAND-IN: the three `name` strings, and the three clips
 * currently sitting in `public/media/team/` (they are the sample files from
 * the section's first PR, not footage of anyone). Both are marked as such —
 * `placeholder: true` per entry, and `TEAM_PLACEHOLDER_ASSETS` for the files.
 *
 * HOW TO FINISH THE ROSTER
 *   1. Drop the real clips and posters at the six paths below.
 *   2. Replace a `name`, and only then clear that entry's `placeholder`.
 *   3. Remove each real file's path from `TEAM_PLACEHOLDER_ASSETS`.
 *   4. Set `TEAM_SECTION_ENABLED = true`.
 * `src/data/team.gate.test.ts` fails if the flag is on while any of those
 * steps is outstanding, so the switch cannot be flipped early by accident.
 *
 * `videoSrc` is optional on purpose: a member with no clip keeps the still
 * poster, and the section never mounts a decoder for them. Clips are played
 * under the single-decoder policy in `src/motion/videoSlot.ts` — see
 * `TeamSection.tsx`.
 */
export interface TeamMember {
  id: string
  name: string
  /** Fixed by the roster. One short line; the phone cards are capped at 160px. */
  role: string
  /** Two characters, shown until the poster image loads and if it fails. */
  initials: string
  /** Still image for the card, and the `poster` of the clip it crossfades to. */
  posterSrc?: string
  videoSrc?: string
  /**
   * `true` while this entry's `name` is still a stand-in. Clear it only when
   * the real name is in — never to make the gate test pass.
   */
  placeholder: boolean
}

/**
 * Single on/off switch for the whole strip. `false` while any entry below is
 * still marked `placeholder` or any of its six assets is missing or itself a
 * placeholder; the landing then renders nothing where the section would be.
 */
export const TEAM_SECTION_ENABLED = false

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    id: 'creator',
    name: 'Team member 01',
    role: 'Creator',
    initials: '01',
    posterSrc: '/media/team/member-01.jpg',
    videoSrc: '/media/team/member-01.mp4',
    placeholder: true,
  },
  {
    id: 'developer',
    name: 'Team member 02',
    role: 'Front-end and back-end developer',
    initials: '02',
    posterSrc: '/media/team/member-02.jpg',
    videoSrc: '/media/team/member-02.mp4',
    placeholder: true,
  },
  {
    id: 'tester',
    name: 'Team member 03',
    role: 'Tester',
    initials: '03',
    posterSrc: '/media/team/member-03.jpg',
    videoSrc: '/media/team/member-03.mp4',
    placeholder: true,
  },
]

/**
 * Asset paths that exist on disk but are not the real thing yet — the three
 * sample clips shipped with the section's first PR. A file stays listed here
 * until the real one replaces it; the gate test treats a listed path exactly
 * like a missing one, so existing-but-fake media cannot enable the strip.
 */
export const TEAM_PLACEHOLDER_ASSETS: readonly string[] = [
  '/media/team/member-01.mp4',
  '/media/team/member-02.mp4',
  '/media/team/member-03.mp4',
]

/** Every asset path the roster points at, posters and clips, in roster order. */
export function teamAssetPaths(members: readonly TeamMember[] = TEAM_MEMBERS): string[] {
  return members.flatMap((member) => [member.posterSrc, member.videoSrc].filter((src): src is string => Boolean(src)))
}
