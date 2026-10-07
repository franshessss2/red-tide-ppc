/** One source for presentation copy, chapter labels and visible reading time. */
export const REEL_SCENES = [
  { chapter: 'Introducing', tag: 'RED TIDE · PRODUCT OVERVIEW', title: 'Introducing', description: 'A shared view of the coast.', duration: 3000, visual: 'orbit' },
  { chapter: 'Identity', tag: 'PUERTO PRINCESA · PALAWAN', title: 'RED TIDE', description: 'Explore. Observe. Stay informed.', duration: 3000, visual: 'identity' },
  { chapter: 'Coastal zones', tag: '01 / EXPLORE', title: 'Explore coastal zones.', description: 'Find your coastal area. Read its community record.', detail: 'Seven approximate coastal areas around Puerto Princesa.', duration: 3800, visual: 'coast' },
  { chapter: 'Observations', tag: '02 / OBSERVE', title: 'Report observations.', description: 'Describe what you notice. Add a photo when it helps.', detail: 'Every submission starts pending review.', duration: 3900, visual: 'report' },
  { chapter: 'Admin review', tag: '03 / REVIEW', title: 'Review before warning.', description: 'An admin can approve or reject a report. Approval can raise a community warning.', detail: 'A review is not laboratory confirmation.', duration: 4300, visual: 'review' },
  { chapter: 'Warnings', tag: '04 / STAY INFORMED', title: 'Read the status clearly.', description: 'Community warnings and unavailable status have different meanings.', detail: 'No recorded alert does not establish safe water.', duration: 4100, visual: 'warning' },
  { chapter: 'Sources', tag: '05 / CHECK THE SOURCE', title: 'Know what you are seeing.', description: 'Source labels distinguish sample records, cached copies and server delivery.', detail: 'Check official BFAR bulletins for official advice.', duration: 4300, visual: 'source' },
  { chapter: 'Arduino', tag: '06 / CONNECT BY USB', title: 'Meet the hardware.', description: 'Connect an Arduino UNO from the hardware page to scan distance, test LEDs and sound the buzzer.', detail: 'A school demonstration of device communication, not a red-tide detector.', duration: 4400, visual: 'hardware' },
  { chapter: 'Community', tag: 'COMMUNITY COASTAL MONITORING', title: 'RED TIDE', description: 'Explore the coast. Share observations. Follow community warnings.', duration: 3400, visual: 'closing' },
] as const;

export const REEL_CLOSING_SCENE = REEL_SCENES.length - 1;
