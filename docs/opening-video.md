# Opening film (PR83)

The user-supplied edited `Peak.mp4` plays before the nine-chapter Red Tide showroom. The uploaded file remains unchanged. The earlier portrait reference and its poster are removed from the active repository tree.

The local `public/media/opening-peak.mp4` retains the complete 18.6-second 1920×1080 edited composition, re-encoded as H.264/yuv420p for web delivery. AAC audio uses linear gain 0.5 (approximately -6.02 dB), preserving the requested 50% setting; the player does not halve the gain again. `+faststart` supports progressive playback. The JPEG poster is the first frame.

Initial playback follows the existing first-visit gate. The landing-page replay circle always restarts the complete sequence: video → looping intro → click-to-exit fade → landing. Each replay mounts a fresh video at time zero and resets chapter zero. The intro loops until the visitor clicks it; video end does not navigate straight to landing. Reduced motion retains the existing static intro and skips media, including on replay. `?intro=1` forces the opening; ordinary navigation does not replay it.

## Flow

- Attempt inline playback with sound. Browser sound policy may reject it; retry muted. If both playback attempts fail, continue into the intro.
- Film end fades the film out for 450ms, then starts chapter zero with its full reading interval. Escape also continues. The film has no visible sound or continue controls.
- Keep the landing page inert throughout film and showroom. Keep focus on the film container, transfer it to the showroom action after the film, restore the existing landing action on showroom exit.
- Pause the media and watchdog in hidden tabs. Resume on visibility. Eight seconds without loading or ten seconds without playback progress falls through to the showroom. Decode errors also continue.
- Reduced motion does not mount or fetch the film; use the existing static intro. Cleanup pauses media and clears timers/listeners. Late autoplay rejection from a cleaned-up effect is ignored.
- Fit the entire edited frame with `object-fit: contain`; no cropping of the film on desktop or landscape screens.

References: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay and https://motion.dev/docs/react-animation. Existing Motion owns the showroom/landing transition; the video layer uses an opacity-only fade. Landing, map and Arduino functionality remain unchanged.

## Playback performance (PR86)

Phones, coarse-pointer devices and viewports up to 900px use `opening-peak-mobile.mp4`: 1280x720, 60 FPS, H.264 Constrained Baseline level 3.2, yuv420p, progressive MP4. It retains all 1,116 frames and the complete 18.6-second edit while reducing decoded pixels per frame by 56%. AAC is copied unchanged, including the baked 50% gain. Desktop keeps the original 1080p version. Selection is fixed for each playback, so rotation does not restart the film.

Generate the mobile delivery asset from the existing desktop asset:

```sh
ffmpeg -i public/media/opening-peak.mp4 -map 0:v:0 -map 0:a:0 -vf scale=1280:720 -c:v libx264 -profile:v baseline -level:v 3.2 -preset slow -crf 22 -maxrate 1800k -bufsize 3600k -pix_fmt yuv420p -c:a copy -movflags +faststart public/media/opening-peak-mobile.mp4
```

The covered landing keeps its DOM and focus targets but unmounts Waves and HeroBackdrop for the entire introduction, including replay. Its CSS animations pause while inert. Showroom stages mount only after the opening film finishes, avoiding hidden animated SVG/filter work during video decoding. Canvas effects return after dismissal. This removes competing rendering; actual FPS still depends on device hardware and browser power-saving settings and must be confirmed on the reporting phone.

## Media interaction suppression (PR88)

The film container receives pointer input instead of the video (including its poster). It cancels context menus and dragging locally; Safari/iOS touch callouts and text selection are disabled on this layer. The player has no native controls and requests no download, fullscreen, remote playback or Picture-in-Picture controls, with the legacy Safari AirPlay opt-out as a fallback. Escape, autoplay recovery, end/error handling and replay retain their existing behavior. No document-wide interaction blockers are installed.

These are browser UI restrictions, not download protection. Public MP4 URLs, browser overrides, developer tools and screen recording remain accessible; support for media-control attributes varies by browser. References: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video and https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/disablePictureInPicture.
