#include <ZoneProtocol.h>

// Owner-photo mapping: UNVERIFIED until the pin sweep passes. Change pins here only.
constexpr rt::PinRole PINS[] = {
  {3,"pp-bay"}, {4,"sta-lourdes"}, {5,"honda-inner"}, {6,"honda-outer"},
  {7,"binuatan"}, {9,"sabang"}, {10,"irawan"}, {11,"any-advisory"},
  {12,"heartbeat"}, {13,"stale"}, {8,"buzzer"}, {2,"spare"}
};
static_assert(rt::validPins(PINS), "Pins must be unique UNO pins; D0/D1 are reserved");
const bool BUZZER_ACTIVE_LOW = true;
const uint8_t ANY = 7, HEARTBEAT = 8, STALE = 9, BUZZER = 10;
const uint32_t WATCHDOG_MS = 15000UL, BEEP_MS = 120UL;
rt::Frame current = {{'X','X','X','X','X','X','X'},false,false,true};
uint32_t lastFrame = 0, patternStart = 0, beepStart = 0;
bool received = false, beeping = false, everBeeped = false, crcOkay = false;
char line[32]; uint8_t used = 0; bool overflow = false;

void buzzer(bool on) { digitalWrite(PINS[BUZZER].pin, on == BUZZER_ACTIVE_LOW ? LOW : HIGH); }
bool isStale(uint32_t now) { return !received || !current.usable || now - lastFrame >= WATCHDOG_MS; }
void processLine(uint32_t now) {
  line[used] = 0;
  if(overflow) { Serial.println(F("RT1 ERROR LENGTH")); return; }
  if(!strcmp(line,"HELLO")) { Serial.println(F("RT1 ZONES READY")); return; }
  if(!crcOkay) { Serial.println(F("RT1 ERROR CRC SELFTEST")); return; }
  if(used == 7 && !strncmp(line,"BEEP*",5) && rt::checkedPayload(line,used)) {
    // Repeated requests cannot extend a beep; stale always wins.
    if(!beeping && !isStale(now) && (!everBeeped || now-beepStart>=3000UL)) { beeping = true; everBeeped = true; beepStart = now; buzzer(true); }
    return;
  }
  rt::Frame next;
  if(!rt::parseFrame(line,used,next)) { Serial.println(F("RT1 ERROR FRAME")); return; }
  if(!received || next.usable != current.usable || next.demo != current.demo || memcmp(next.states,current.states,7)) patternStart = now;
  current = next; received = true; lastFrame = now;
  Serial.print(F("RT1 ACK ")); Serial.println(line);
}
void setup() {
  // 3-pin active-LOW module: VCC=5V, GND=common, signal pull-up=10k to 5V.
  buzzer(false); // HIGH before OUTPUT, no tone(), no startup sound.
  pinMode(PINS[BUZZER].pin,OUTPUT);
  for(uint8_t i=0;i<10;++i) { digitalWrite(PINS[i].pin,LOW); pinMode(PINS[i].pin,OUTPUT); }
  digitalWrite(PINS[STALE].pin,HIGH); // D13 also mirrors to the onboard L LED.
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
  if(beeping && (now-beepStart>=BEEP_MS || stale)) { beeping=false; buzzer(false); }
  for(uint8_t i=0;i<7;++i) digitalWrite(PINS[i].pin,rt::zoneOn(stale?'X':current.states[i],now-patternStart)?HIGH:LOW);
  digitalWrite(PINS[ANY].pin,!stale && current.any?HIGH:LOW);
  digitalWrite(PINS[HEARTBEAT].pin,!stale && rt::heartbeatOn(current.demo,now-patternStart)?HIGH:LOW);
  digitalWrite(PINS[STALE].pin,stale?HIGH:LOW);
}
