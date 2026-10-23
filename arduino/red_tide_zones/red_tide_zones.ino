#include <ZoneProtocol.h>

// Owner confirmed all ten LEDs in the bench sweep on 23 October 2026.
// Physical behavior is REPORTED, not measured GPIO/light feedback. No buzzer.
constexpr rt::PinRole PINS[] = {
  {13,"pp-bay"}, {12,"sta-lourdes"}, {11,"honda-inner"}, {10,"honda-outer"},
  {9,"binuatan"}, {7,"sabang"}, {6,"irawan"}, {5,"any-advisory"},
  {4,"heartbeat"}, {3,"stale"}
};
static_assert(rt::validPins(PINS), "Pins must be unique UNO pins; D0/D1 are reserved");
const uint8_t ANY = 7, HEARTBEAT = 8, STALE = 9;
const uint32_t WATCHDOG_MS = 15000UL;
rt::Frame current = {{'X','X','X','X','X','X','X'},false,false,true};
uint32_t lastFrame = 0, patternStart = 0;
bool received = false, crcOkay = false;
char line[32]; uint8_t used = 0; bool overflow = false;

bool isStale(uint32_t now) { return !received || !current.usable || now - lastFrame >= WATCHDOG_MS; }
void processLine(uint32_t now) {
  line[used] = 0;
  if(overflow) { Serial.println(F("RT1 ERROR LENGTH")); return; }
  if(!strcmp(line,"HELLO")) { Serial.println(F("RT1 ZONES READY")); return; }
  if(!strcmp(line,"STATUS")) {
    Serial.println(isStale(now) || !crcOkay ? F("RT1 STATUS STALE") : F("RT1 STATUS LIVE"));
    return; // Read-only diagnostics never renew the watchdog.
  }
  if(!crcOkay) { Serial.println(F("RT1 ERROR CRC SELFTEST")); return; }
  if(used == 7 && !strncmp(line,"BEEP*",5) && rt::checkedPayload(line,used)) {
    Serial.println(F("RT1 ERROR NO BUZZER"));
    return;
  }
  rt::Frame next;
  if(!rt::parseFrame(line,used,next)) { Serial.println(F("RT1 ERROR FRAME")); return; }
  if(!received || next.usable != current.usable || next.demo != current.demo || memcmp(next.states,current.states,7)) patternStart = now;
  current = next; received = true; lastFrame = now;
  Serial.print(F("RT1 ACK ")); Serial.println(line);
}
void setup() {
  // No buzzer/servo/HC-SR04. D2, D8 and analog pins remain untouched.
  for(uint8_t i=0;i<10;++i) { digitalWrite(PINS[i].pin,LOW); pinMode(PINS[i].pin,OUTPUT); }
  digitalWrite(PINS[STALE].pin,HIGH); // D3 stale; onboard L follows pp-bay on D13.
  Serial.begin(9600);
  crcOkay = rt::goldenCrcPasses();
  Serial.println(crcOkay ? F("RT1 CRC PASS") : F("RT1 ERROR CRC SELFTEST"));
  if(crcOkay) Serial.println(F("RT1 ZONES READY"));
}
void loop() {
  // Bound work per pass so a serial flood cannot starve watchdog/blink updates.
  for(uint8_t budget=0;budget<32 && Serial.available();++budget) {
    const char c=Serial.read();
    if(c=='\n') { processLine(millis()); used=0; overflow=false; }
    else if(c < 32 || c > 126) overflow=true;
    else if(!overflow && used<sizeof(line)-1) line[used++]=c;
    else overflow=true;
  }
  const uint32_t now=millis();
  const bool stale=isStale(now) || !crcOkay;
  for(uint8_t i=0;i<7;++i) digitalWrite(PINS[i].pin,rt::zoneOn(stale?'X':current.states[i],now-patternStart)?HIGH:LOW);
  digitalWrite(PINS[ANY].pin,!stale && current.any?HIGH:LOW);
  digitalWrite(PINS[HEARTBEAT].pin,!stale && rt::heartbeatOn(current.demo,now-patternStart)?HIGH:LOW);
  digitalWrite(PINS[STALE].pin,stale?HIGH:LOW);
}
