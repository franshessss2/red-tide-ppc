/** Connected Coast: one exhibit story, six chapters, about thirty seconds. */
export const REEL_SCENES = [
  { chapter: 'Our coast', tag: '01 / OUR COAST', title: 'It starts with our coast.', description: 'Seven coastal areas. One community looking out for them.', detail: 'Find your area and read its community record.', duration: 4400, visual: 'coast' },
  { chapter: 'Your observation', tag: '02 / YOUR OBSERVATION', title: 'A small observation. A place to start.', description: 'Notice something unusual? Share what you see and where you saw it.', detail: 'Every report starts pending review.', duration: 4700, visual: 'report' },
  { chapter: 'Human review', tag: '03 / HUMAN REVIEW', title: 'A person reviews every report.', description: 'An administrator approves or rejects the observation before it becomes a reviewed community record.', detail: 'Community review is not laboratory confirmation.', duration: 4900, visual: 'review' },
  { chapter: 'Shared updates', tag: '04 / SHARED UPDATES', title: 'One community. One shared feed.', description: 'Website, Android and Windows receive the same community records when connected.', detail: 'Check the source label. A cached copy is not a fresh server delivery.', duration: 4900, visual: 'shared' },
  { chapter: 'Ten lights', tag: '05 / FROM SCREEN TO BOARD', title: 'The coast, in ten lights.', description: 'RTP sends zone statuses over USB to the Arduino display.', detail: 'Seven zone lights. Three system indicators. A status display, not a red-tide detector.', duration: 5000, visual: 'hardware' },
  { chapter: 'Your turn', tag: '06 / YOUR TURN', title: 'RED TIDE', description: 'Explore the coast. Share observations. Stay informed.', detail: 'Your community. Your coast. Your next observation.', duration: 3800, visual: 'closing' },
] as const
export const REEL_CLOSING_SCENE = REEL_SCENES.length - 1
