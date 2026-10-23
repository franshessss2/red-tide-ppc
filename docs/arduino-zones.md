# UNO zone-status display

**REPORTED — intended use:** a school demonstration of app community records, not a detector or official advisory. Keep the exact label **Community records, not an official clearance.** Off alone never means safe: a dead LED, absent power or failed wiring can also look dark.

**REPORTED — bench, 23 October 2026:** the owner confirmed all ten external LEDs light individually on D13–D9, then D7–D3, each with a reported 220 ohm resistor and common GND. No buzzer, servo or HC-SR04 is connected. This confirms the owner's observation, not measured resistance/current or zone-pattern acceptance. The separate combined-hardware issue [#80](https://github.com/franshessss2/red-tide-ppc/issues/80) remains unresolved.

## Separate wiring and firmware

Use `arduino/red_tide_zones/red_tide_zones.ino` with `/arduino-zones`. The existing `/arduino.html` retains its separate diagnostic modes and links to this React route. **Do not use the combined sketch on this wiring:** its HC-SR04 D10/D11 and servo D12 collide with LEDs here. Disconnect servo and HC-SR04 power/signal wiring first. Do not combine their supply rails for this minimal display.

All pins are in one `constexpr PINS` table at the top of each zone/sweep sketch. Compile-time guards reject duplicate pins, D0/D1 and pins outside UNO D2–A5. A hardware-free test checks that the two tables agree. D2, D8 and analog pins remain unused. Earlier zone builds used a different mapping; use the firmware and page from the same version. The combined sketch and its public download remain unchanged and require their old wiring.

| LED | Role | Pin |
| --- | --- | --- |
| 1 | `pp-bay` | D13 |
| 2 | `sta-lourdes` | D12 |
| 3 | `honda-inner` | D11 |
| 4 | `honda-outer` | D10 |
| 5 | `binuatan` | D9 |
| 6 | `sabang` | D7 |
| 7 | `irawan` | D6 |
| 8 | Any advisory | D5 |
| 9 | Heartbeat | D4 |
| 10 | Stale | D3 |
| — | Unused, no buzzer | D8 |
| — | Unused | D2 |

D13 also drives the onboard L LED on UNO R3. It mirrors pp-bay during sketch operation; bootloader flashes are not status information.

## Bench checklist before wiring or upload

These checks are for the owner; their results are **UNVERIFIED** until recorded.

- Unplug USB and every supply before changing connections or measuring resistance/continuity.
- Identify the exact UNO, buzzer and servo models. Check every breadboard rail for splits, reversed polarity and shorts.
- Measure all ten LED resistors individually, isolating parallel paths. Record resistance and tolerance. The older guide specifies 220 Ω and reports photographed red-red-brown-gold parts, not ten measured resistances.
- Use diode mode to identify LED anode/cathode and approximate forward voltage; record color. The sketches assume active-HIGH: pin → individual resistor → anode; cathode → common ground.
- Disconnect servo power AND signal, and HC-SR04 wiring. Check they cannot backfeed the display. A future servo test needs a separately rated regulated supply with common ground, not its positive rail tied to USB-powered UNO 5V. Measure servo-supply voltage, operating/stall-current requirements and rail dips separately before any combined investigation. Do not intentionally stall an unknown servo.
- Keep the buzzer disconnected. This version never configures D8 and rejects beep commands; adding a buzzer later needs a separate wiring and firmware review.
- Calculate peak current before simultaneous operation: `sum((Vrail_max − Vf_min)/R_min) + Ibuzzer_max`, plus pull-up current while LOW. Add UNO/sensor loads separately. Exact worst-case current is unknown until parts are identified/measured. Illustratively, ten 220 Ω LEDs at 5V with 2V forward drop draw ~136 mA before the buzzer; at assumed 5.25V, 1.8V drop and −5% resistors, ~165 mA. These are assumptions, not measurements or approval of the wiring. Target roughly 3–5 mA per LED with suitable resistors, or use a driver if needed. Observe UNO per-pin, port-group and MCU current limits; absolute maxima are not design budgets.
- With suitable current limiting, upload the pin test and compare each serial role with the actual lit LED. Record all ten; stop and correct the table/wiring if any differ. Confirm the buzzer stays silent.

## Patterns and safety

| State | Output |
| --- | --- |
| `advisory` / A | Steady on |
| `safe` / S | Off: no community warning recorded, not a safety clearance |
| `unconfirmed` / U | 500 ms on / 500 ms off |
| `unknown` / X | 125 ms on / 125 ms off |
| Any advisory | LED 8 on if any of the seven mapped states is A; off when stale |
| Usable demo | LED 9: 100 ms on, 100 off, 100 on, 700 off |
| Usable synced Firebase | LED 9: 100 ms on, 900 off |
| Boot/source unusable/no valid status frame for 15 s | Seven fast-blinking unknowns; LED 8 dark; LED 9 off; LED 10 on |

Patterns are firmware-local, not browser-timed. Only accepted status frames renew the 15-second watchdog. HELLO, malformed input and BEEP cannot extend it. New frames apply atomically. Repeated same-state frames do not restart blink phases. Unsigned 32-bit elapsed arithmetic covers `millis()` rollover.

No sound: there is no buzzer output or beep button in this version. CRC self-test failure leaves the display stale. `BEEP*5C` is rejected as `RT1 ERROR NO BUZZER` and never refreshes the status timer.

## Store/read-only boundary

The route is lazy-loaded; no Web Serial implementation is imported by the eager app graph. App.tsx already owns subscriptions. The new route only selects `zones`, `zonesReady`, `zonesFeed` and `backendKind`; it does not edit `store.ts`, initialize another backend or read the sample localStorage key.

- Stable seven zone IDs map to fixed LED positions regardless of name-sorted array order. Missing, duplicate or malformed records become X; never S.
- Ready demo backend + `zonesFeed.phase === 'sample'`, no error: usable demo.
- Ready Firebase backend + `zonesFeed.phase === 'synced'`, no error and non-null `lastSyncedAt`: usable real server snapshot; only here remove **Demo zone-status display**.
- Loading/cached/pending/error, not-ready or inconsistent backend/feed state: stale and demo-labelled, even if the store retains records.
- `lastSyncedAt` is server snapshot receipt time, not a coast sampling date or continuous server heartbeat. Its age alone and `zone.lastUpdated` age do not invalidate an unchanged record. Existing feed metadata cannot prove continuous server availability.
- Reports feed errors do not override an independently synced zone feed. This display makes no report-feed health claim.

Serial messages may identify/acknowledge this board or affect link diagnostics only. They never invoke store mutations, write zones/reports, submit reports or call ingestion endpoints. Page tests spy on all relevant app/backend mutations, direct store setState and fetch while injecting ACKs, samples and hostile update requests. This is tested software isolation, not a physical-device acceptance claim.

## Protocol

9600 baud, ASCII, LF-terminated (page handles CRLF replies). Own greeting: `RT1 ZONES READY`; `HELLO` requests it. Combined/scanner/LED greetings do not enable this route.

`Z1,<seven SAUX states>,<any 0/1>,<usable 0/1>,<demo 0/1>*HH\n`

CRC-8/SMBUS: polynomial 0x07, initial 0x00, no reflection, final XOR 0x00. HH is two uppercase hex digits over every ASCII byte before `*`, including all commas and the demo bit; excludes the star, CRC and newline. Payload length is 16; complete line before LF is 19 bytes. An unusable frame must have seven X and any=0. Firmware verifies the any bit matches the seven states.

Firmware replies `RT1 ACK <exact accepted frame>`. The page accepts only an exact echo of its pending validated frame. No sequence numbers or reorder logic; serial is ordered. One frame awaits acknowledgment at a time, with changes coalesced to the latest snapshot. Send immediately after identification, on change, and every two seconds. The page declares the connection unhealthy after four seconds without its ACK; identification times out after eight seconds. Firmware has an independent 15-second watchdog. ACK confirms command acceptance, not actual LED illumination, electrical correctness or server freshness.

`BEEP*5C\n` is retained as a CRC test vector but rejected by this LED-only firmware. Read-only `STATUS` replies `RT1 STATUS LIVE` or `RT1 STATUS STALE`; it describes the firmware timer/source flag, not measured lights or verified cloud availability. STATUS, HELLO and rejected commands never renew the watchdog. Error lines and other input cannot alter app data. Input buffers and per-loop serial processing are bounded.

Shared golden literals are in `arduino/libraries/RedTideZones/src/GoldenCrc.h`, consumed by JS tests and both sketch startup tests. Independent hand calculation for ASCII A=0x41, after each MSB-first step: **82, 03, 06, 0C, 18, 30, 60, C0**. JS also verifies literals using an independent whole-message polynomial division. Frame literals include `Z1,SSSSSSS,0,1,1*7A` and `Z1,AXUSSSS,1,1,0*0C`.

## Hidden tab and cleanup

The visible notice says to keep this tab visible and the computer awake. On hide/unmount/disconnect, send best-effort stale, stop periodic sends and release USB. Returning requires explicit reconnect. Timers can be throttled/suspended; the final write might never run. No Worker or background-delivery guarantee is claimed. A powered UNO independently enters stale within 15 seconds after the last accepted status. If USB removal removes board power, no LED can remain lit. Actual browser sleep/power-management and physical USB behavior remain unverified.

## Build/test, never automatic upload

The sketches use the repository-owned `RedTideZones` library. For Arduino IDE, install/copy that library into the sketchbook libraries folder; keep its two headers together. No Servo or other external library is required.

```sh
arduino-cli compile --fqbn arduino:avr:uno --libraries arduino/libraries arduino/red_tide_zones
arduino-cli compile --fqbn arduino:avr:uno --libraries arduino/libraries arduino/red_tide_pin_test
node scripts/test-zone-firmware.mjs
npx vitest run src/arduino src/pages/ArduinoZones.test.tsx
npm run build -- --manifest
node scripts/check-zone-bundle.mjs
```

Hardware-free C++ tests need an existing C++11 compiler (`CXX`, default `c++`). They execute the actual .ino files against fake GPIO/serial and compile-negative pin probes. CI compiles both UNO targets with CLI 1.5.1/core 1.8.8 and runs host tests. Nothing uploads firmware or opens a real USB port.

The separate pin-test sketch prints `RT1 PIN TEST READY`, then role and D-pin, lights one mapped output for 700 ms, turns it off and advances. It repeats the ten positions. Its CRC self-test must pass before LED output starts. It never beeps. Successful compilation/simulation does not confirm physical LED order.

Physical acceptance still needs each zone's A/U/X/S patterns, maximum simultaneous current, tab hide/close, USB loss and reconnect. Keep #80 open until its separate combined-hardware investigation passes. Buzzer testing is excluded from this LED-only firmware.

## Recorded LED-only acceptance: 23 October 2026

- **VERIFIED:** CLI 1.5.1/core 1.8.8 compiled the zone sketch (3884 bytes flash, 466 bytes RAM) and pin sweep (3008 flash, 386 RAM). Zone upload on owner-confirmed COM5 completed with readback verification. The preceding flash was backed up locally before upload.
- **VERIFIED serial behavior:** startup CRC/identity, exact valid-frame ACKs, malformed/CRC/flag rejection, explicit stale frames, STATUS LIVE/STALE, rejected BEEP, and the 15-second watchdog despite HELLO/BEEP traffic. These checks read and exercised serial only; they did not write app records.
- **REPORTED physical behavior:** owner confirmed all ten LEDs individually in the bench sweep and the stale pattern (seven fast blinking, D3 steady, D5/D4 off). After connecting the page to the live feed, the owner reported the lights responding during their test. This is not a recorded per-zone matrix or a current measurement.
- **VERIFIED browser connection:** local display showed a usable Firebase server snapshot and USB acknowledged, requesting seven S states. The display remains dependent on a visible tab and awake computer.
- **REPORTED buzzer:** a separate two-wire TMB12A05 sounded during a manual 5V/GND test. It was disconnected; no buzzer drive is implemented or connected. A suitable driver is required before a later integration.
- **UNVERIFIED:** electrical measurements, every physical A/U/X/S pattern and sleep/USB-loss behavior. Host C++ simulation could not run locally because no host C++ compiler was available; CI must run it before merge.

For this mapping, the worst steady zone pattern plus heartbeat lights nine external LEDs: eight in the ATmega328P PB0-PB5/PD5-PD7 source-current group and one on D4. At assumed 5V, 2V LED drop and 220 ohms, that is about 123mA total / 109mA in that group. At assumed 5.25V, 1.8V drop and -5% resistance, it is about 149mA / 132mA. These are estimates, not measured compliance. Higher 330/470 ohm LED resistors provide more headroom; MCU core and onboard loads also count. Absolute current limits are not design budgets. See the [UNO specifications](https://store.arduino.cc/products/arduino-uno-rev3/) and [ATmega328P electrical limits](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf).
