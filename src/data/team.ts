/**
 * Empty roster slots, deliberately disabled until the owner supplies real data.
 * Fill all three entries, supply real files in public/media/team/, clear each
 * placeholder marking and remove replaced files from TEAM_PLACEHOLDER_ASSETS.
 * Only then set TEAM_SECTION_ENABLED to true; the gate verifies readiness.
 */
export interface TeamMember {
  id: string
  name: string
  /** Owner-supplied role. Phone cards are capped at 160px. */
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
    name: '', // Fill in the exact member name.
    role: '', // Fill in the exact member role.
    initials: '', // Fill in this member's initials.
    posterSrc: '', // Add public/media/team/member-01.jpg, then set /media/team/member-01.jpg.
    videoSrc: '', // Add the real clip in public/media/team/, then set its /media/team/ path.
    placeholder: true,
  },
  {
    id: 'developer',
    name: '', // Fill in the exact member name.
    role: '', // Fill in the exact member role.
    initials: '', // Fill in this member's initials.
    posterSrc: '', // Add public/media/team/member-02.jpg, then set /media/team/member-02.jpg.
    videoSrc: '', // Add the real clip in public/media/team/, then set its /media/team/ path.
    placeholder: true,
  },
  {
    id: 'tester',
    name: '', // Fill in the exact member name.
    role: '', // Fill in the exact member role.
    initials: '', // Fill in this member's initials.
    posterSrc: '', // Add public/media/team/member-03.jpg, then set /media/team/member-03.jpg.
    videoSrc: '', // Add the real clip in public/media/team/, then set its /media/team/ path.
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
