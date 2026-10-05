# Physical Arduino USB demonstration

This optional demo uses Frans's existing two UNO-labelled boards. It is separate
from the ESP32/Wokwi cloud feed. It does not change map warnings, Firebase,
the intro or the landing page. Do not merge PR #72 without Frans's approval.

## Recorded wiring

| Board | Part | Pin |
|---|---|---|
| Scanner | HC-SR04 TRIG | D10 |
| Scanner | HC-SR04 ECHO | D11 |
| Scanner | Servo signal | D12 |
| Scanner | Buzzer signal | D8 |
| Scanner | Sensor power | 5V / GND |
| Scanner | Servo power | Breadboard 5V / GND supplied by UNO |
| Scanner | Buzzer ground | Breadboard GND |
| LEDs | Positions 1–10, left to right | D13,D12,D11,D10,D9,D7,D6,D5,D4,D3 |
| LEDs | Common ground | UNO GND to breadboard |

Ten LEDs have ten individual resistors. The photographed resistors appear to be
220 ohms, red-red-brown-gold (5% tolerance). The entire assembly has not been
electrically verified. Servo and buzzer exact model/type are not confirmed.
Keep all parts dry. Disconnect USB before changing wiring. Do not connect a
9V battery to the 5V rail. If servo movement causes resets, stop and review its
power supply; do not compensate in software or connect another supply blindly.

## First: LED board

1. Leave the scanner disconnected. Connect LED board by USB.
2. Open `arduino/red_tide_leds/red_tide_leds.ino` in Arduino IDE.
3. Select Arduino Uno and COM5 (Frans verified COM5; another computer may differ).
4. Click Verify. Then Upload. Upload replaces the old sketch; old source is unavailable.
5. Open Serial Monitor, set 9600 baud and Newline. Expect `RT1 LED READY`.
6. Send `LED 1`: only the leftmost LED should light, then turn off after 5 seconds.
7. Repeat `LED 2` through `LED 10`. Record mismatches; don't rewire while powered.
8. Send `OFF`. Close Serial Monitor before the browser connects.

Only one LED is driven at once. Do not substitute an all-on pattern without
checking total and per-port current limits.

## Then: scanner board

1. Disconnect LED board; connect scanner USB and identify its own COM port.
2. Install the Arduino Servo library using Library Manager if not already available.
3. Open `arduino/red_tide_scanner/red_tide_scanner.ino`. Select Uno and correct port.
4. Verify, then Upload. Keep the servo arm clear of obstacles.
5. Serial Monitor: 9600 baud, Newline. Send `START` then `KEEP` at least every
   few seconds. Without a command for five seconds, scanning stops.
6. Samples look like `RT1 SAMPLE 90 25`: angle in degrees, distance in cm.
   Distance `-1` means invalid/no echo; it does not mean zero distance.
7. `STOP` stops scanning. `BEEP` attempts a short tone; active buzzers may behave differently.
8. Close Serial Monitor.

## Browser connection

Run the existing project with `npm run dev`, then open `/arduino-demo.html` on
the localhost URL in desktop Chrome/Edge. After deployment the same path is
available on HTTPS. Use the browser on the laptop physically connected by USB.
No Redis credentials, Wi-Fi module, cloud relay or paid service is needed.

Select the board type, press Connect USB, choose its serial port and wait for
firmware identification. Test LED buttons or scanner Start/Stop/Test buzzer.
Switching away from the tab disconnects it. Firmware stops scanning after loss
of its five-second heartbeat. Reconnect explicitly when returning.

This version intentionally connects one board at a time and does not relay
scanner readings to the other board. LED tests and buzzer tests are manually
controlled demonstrations. No red-tide detection or health warning is inferred.

## Validation limits

Hardware upload, actual USB permissions, servo power stability and LED ordering
must be tested manually on Frans's laptop. These cannot be verified against the
remote workspace. Firmware compilation requires Arduino AVR core and Servo;
do not claim physical validation from a website build.

References: https://developer.chrome.com/docs/capabilities/serial and
https://docs.arduino.cc/libraries/servo/ . Tutorials supplied by Frans:
https://youtu.be/SJnW7U9kr_k and https://youtu.be/SvLObGL-5ZY . User-recorded
pin mapping takes precedence over tutorial wiring.

## Manual results reported by Frans — 5 October 2026

Both sketches compiled and were uploaded in Arduino IDE for Arduino Uno.
The LED board identified itself on COM5 and Frans reported LEDs 1–10 responding.
The scanner identified itself, returned a valid 8 cm sample, moved its servo,
and sounded the buzzer on BEEP. Continued KEEP commands prevented the expected
five-second scan timeout. Browser-to-hardware testing remains pending.
These are user-reported checks, not remotely observed electrical measurements.
