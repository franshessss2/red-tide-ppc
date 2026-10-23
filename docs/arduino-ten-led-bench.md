# Ten-LED bench checkpoint

REPORTED by owner: UNO-compatible ATmega328P board with CH340 USB serial,
ten red LEDs, each with its own 220 ohm resistor and shared ground.
No buzzer, servo or HC-SR04 is part of this test.

REPORTED pin order: D13, D12, D11, D10, D9, D7, D6, D5, D4, D3.
D8 is skipped. This differs from both the old zone-display wiring and the
earlier proposed consecutive D2-D11 wiring. Neither mapping is substituted.

Use only `arduino/red_tide_led_test/red_tide_led_test.ino` at this checkpoint.
It boots with the external outputs off. `PIN n` holds one mapped LED on until
another command or reset; `NEXT` advances in the reported order and `OFF` clears
all outputs. Optional `CHASE` repeats 300 ms steps. Serial is 9600 baud and
prints the selected position and D-pin. D13 also lights the onboard L indicator. D0/D1 are USB
serial; D2, D8 and analog pins are left untouched. Timers use unsigned elapsed
`millis()` arithmetic; the previous LED goes LOW before the next goes HIGH.

UNVERIFIED: actual resistance, polarity, continuity, LED operation and physical
left-to-right order. A reference picture and successful upload cannot establish
these. With assumed 5 V output, 2 V red-LED drop and 220 ohm resistance, the one
external LED draws approximately 13.6 mA; this is an estimate, not a measurement
or approval for simultaneously lighting all ten outputs. Disconnect power
before changing wiring; leave the separate 9 V supply disconnected for this
USB-powered test. Stop and disconnect power if parts heat or behave abnormally.

The combined sketch, downloadable copy, existing zone sketch and website remain
unchanged. Their old wiring instructions do not describe this new bench test.
No cloud, app-store or zone/report mutation is involved.

After upload, ask the owner to report all ten positions and whether only one
external LED lights at a time. Stop here until that physical confirmation; do
not upload a zone-display sketch or reconnect a buzzer at this checkpoint.

## Recorded checkpoint: 23 October 2026

VERIFIED: generic CH340 USB serial on COM5; board model is owner-reported UNO
compatible. Existing CLI 1.5.1 and AVR core 1.8.8 were used without installation.
The previous board flash was read into `.cache/pre-led-test-flash.hex` (32768
bytes) before the first upload. Combined firmware/download hashes remain
9314F5741E76525B30AAF6890F0885ED9B154CD7269A986A1B4511C51F1A2D34.

VERIFIED: initial automatic test compiled (2464 flash / 203 RAM bytes), uploaded
with `--verify`, and returned 23 correctly mapped pin readings. The initial
startup greeting had leading reset noise. Owner then requested a one-by-one
physical check; the manual version compiled (3770 flash / 244 RAM bytes) and
uploaded successfully with `--verify`. Its startup greeting was clean.
`PIN 8` returned ERROR COMMAND and `PIN 13` returned `RT1 LED 1 D13`.
The serial monitor was closed and its port released after selecting D13.

Historical checkpoint: at this initial upload, physical light/order were awaiting
owner confirmation and no zone firmware or website files had changed.

## Subsequent owner acceptance

REPORTED: the owner subsequently confirmed all ten external LEDs working in the
D13-D9, D7-D3 sweep. That physical gate passed; resistance/current remain
unmeasured. The zone firmware and display page were then updated to this mapping,
uploaded with verification, and tested over USB. The owner confirmed its stale
pattern and later reported the live-feed lights responding. See
`docs/arduino-zones.md` for the current acceptance evidence and remaining checks.
This manual sketch remains a standalone bench/rollback tool. No buzzer is driven.
