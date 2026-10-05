# Combined Arduino UNO

School prototype: distance measurements and manually selected LED outputs. Not waterproof and does not detect red tide or toxins.

Unplug all power before rewiring. The old LED wiring overlaps scanner pins and cannot be reused unchanged.

| Connection | UNO pin |
|---|---|
| HC-SR04 TRIG | D10 |
| HC-SR04 ECHO | D11 |
| HC-SR04 VCC / GND | 5V / GND |
| Servo signal | D12 |
| Existing buzzer positive / negative | D8 / GND |
| LEDs 1 through 10 | D2, D3, D4, D5, D6, D7, D9, D13, A0, A1 |

Each LED uses its own 220-ohm series resistor: pin → resistor → LED anode; cathode → common GND. One LED at a time. A0/A1 are digital outputs in this sketch. Keep D0/D1 free for USB serial.

Servo red connects to a separate regulated 5V supply, brown/black to supply GND. Connect supply GND to UNO GND. Do not connect supply positive to UNO 5V while USB powers the board. Both breadboards need a common ground; clipping them together does not connect their rails.

1. Open arduino/red_tide_combined/red_tide_combined.ino in Arduino IDE.
2. Select Arduino UNO and the actual USB port; upload.
3. Close Serial Monitor. Open /arduino.html in desktop Chrome or Edge.
4. Select Combined UNO, connect USB, then start scanning and test LEDs/buzzer.

The older /arduino-demo.html address remains available. Separate LED/scanner sketches are still selectable.

Serial Monitor: 9600 baud, New Line. HELLO returns RT1 COMBINED READY. START, KEEP, STOP, BEEP, OFF and LED 1 through LED 10 are supported. Send KEEP at least every 2–3 seconds during manual scanning. Without KEEP, scanning stops after five seconds. LEDs turn off five seconds after their LED command, independently of KEEP. STOP turns scanning and LEDs off. Browser sends KEEP automatically and disconnects when its tab is hidden.

Firmware requires the Servo library. Arduino IDE verification/upload and physical combined wiring tests are manual; host validation does not establish electrical correctness.
