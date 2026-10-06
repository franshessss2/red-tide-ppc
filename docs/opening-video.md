# Opening reference film (PR83)

The user-supplied `1000001525.mp4` plays before the nine-chapter Red Tide showroom. This is the original Google AI Studio promotional reference, not a newly branded Red Tide film. Its promotional text and creator branding remain visible. The original upload remains unchanged outside the repository.

The local `public/media/opening-reference.mp4` preserves the H.264 video stream and complete 18.6-second portrait composition. AAC audio is re-encoded with linear gain 0.5 (approximately -6.02 dB); the player does not halve the gain again. This applies on mobile browsers that do not implement programmatic volume. `+faststart` moves MP4 metadata before the media payload. The local JPEG poster is its first frame.

Playback follows the existing first-visit intro gate. Returning visitors, deep links and replay do not download the film; replay runs the existing nine chapters. `?intro=1` explicitly forces the full opening. This change does not make the website a native app or change the gate to every launch.

## Flow

- Attempt inline playback with sound. Browser sound policy may reject it; retry muted and expose a sound toggle.
- Film end or Continue to Red Tide fades the film out for 450ms, then starts chapter zero with its full reading interval. Escape also continues. Enter/Space activate the focused native control.
- Keep the landing page inert throughout film and showroom. Trap focus within film controls, transfer it to the showroom action after the film, restore the existing landing action on showroom exit.
- Pause the media and watchdog in hidden tabs. Resume on visibility. Eight seconds without loading or ten seconds without playback progress falls through to the showroom. Decode errors also continue.
- Reduced motion does not mount or fetch the film; use the existing static intro. Cleanup pauses media and clears timers/listeners. Late autoplay rejection from a cleaned-up effect is ignored.
- Fit the entire portrait frame with `object-fit: contain`; no cropping of the film on desktop or landscape screens. Controls have 44px minimum hit areas.

References: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay and https://motion.dev/docs/react-animation. Existing Motion owns the showroom/landing transition; the video layer uses an opacity-only fade. Landing, map and Arduino functionality remain unchanged.
