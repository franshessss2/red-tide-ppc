// Isolated ten-LED bench test. Owner-reported wiring; physical order UNVERIFIED.
// Each output: pin -> its own 220-ohm resistor -> red LED -> common GND.
// No buzzer, servo, ultrasonic sensor or zone/backend connection.
// The onboard UNO L LED also follows D13; bootloader flashes are not this test.

constexpr uint8_t PIN_ORDER[] = {13, 12, 11, 10, 9, 7, 6, 5, 4, 3};
constexpr uint8_t LED_COUNT = sizeof(PIN_ORDER) / sizeof(PIN_ORDER[0]);
constexpr uint32_t STEP_MS = 300UL;
static_assert(LED_COUNT == 10, "The bench test requires ten LED pins");

uint8_t position = 0;
uint32_t lastStep = 0;
bool chasing = false;
char command[16];
uint8_t used = 0;
bool overflow = false;

void allOff() {
  for (uint8_t i = 0; i < LED_COUNT; ++i) digitalWrite(PIN_ORDER[i], LOW);
}

void announce() {
  Serial.print(F("RT1 LED "));
  Serial.print(position + 1);
  Serial.print(F(" D"));
  Serial.println(PIN_ORDER[position]);
}

void showLed(uint8_t index) {
  allOff(); // Break before make, including when a command changes the pin.
  position = index;
  digitalWrite(PIN_ORDER[position], HIGH);
  announce();
  lastStep = millis();
}

void processCommand() {
  command[used] = 0;
  if (overflow) { Serial.println(F("RT1 ERROR LENGTH")); return; }
  if (!strcmp(command, "OFF")) {
    chasing = false; allOff(); Serial.println(F("RT1 ALL OFF")); return;
  }
  if (!strcmp(command, "NEXT")) {
    chasing = false; showLed((position + 1) % LED_COUNT); return;
  }
  if (!strcmp(command, "CHASE")) {
    chasing = true; showLed(0); return;
  }
  if (!strncmp(command, "PIN ", 4)) {
    char *end;
    const long pin = strtol(command + 4, &end, 10);
    if (end != command + 4 && *end == 0) {
      for (uint8_t i = 0; i < LED_COUNT; ++i) {
        if (pin == PIN_ORDER[i]) { chasing = false; showLed(i); return; }
      }
    }
  }
  Serial.println(F("RT1 ERROR COMMAND"));
}

void setup() {
  for (uint8_t i = 0; i < LED_COUNT; ++i) {
    digitalWrite(PIN_ORDER[i], LOW);
    pinMode(PIN_ORDER[i], OUTPUT);
  }
  // D0/D1 reserved for USB serial; D2/D8 and all analog pins left untouched.
  Serial.begin(9600);
  Serial.println(F("RT1 TEN LED MANUAL READY"));
  Serial.println(F("PIN n, NEXT, OFF; optional CHASE uses 300 ms steps"));
}

void loop() {
  for (uint8_t budget = 0; budget < 32 && Serial.available(); ++budget) {
    const char c = Serial.read();
    if (c == '\n') {
      processCommand(); used = 0; overflow = false;
    } else if (c != '\r') {
      if (c < 32 || c > 126 || used >= sizeof(command) - 1) overflow = true;
      else if (!overflow) command[used++] = c;
    }
  }
  const uint32_t now = millis();
  if (chasing && now - lastStep >= STEP_MS) showLed((position + 1) % LED_COUNT);
}
