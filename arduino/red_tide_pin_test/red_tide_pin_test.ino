#include <ZoneProtocol.h>

// Same owner-photo mapping as red_tide_zones. No servo/HC-SR04 may be attached.
constexpr rt::PinRole PINS[] = {
  {3,"pp-bay"}, {4,"sta-lourdes"}, {5,"honda-inner"}, {6,"honda-outer"},
  {7,"binuatan"}, {9,"sabang"}, {10,"irawan"}, {11,"any-advisory"},
  {12,"heartbeat"}, {13,"stale"}, {8,"buzzer"}, {2,"spare"}
};
static_assert(rt::validPins(PINS), "Pins must be unique UNO pins; D0/D1 are reserved");
const bool BUZZER_ACTIVE_LOW = true;
bool passed=false; uint8_t position=0; unsigned long lastStep=0;
void announce() { Serial.print(F("RT1 PIN ")); Serial.print(position+1); Serial.print(F(" D")); Serial.print(PINS[position].pin); Serial.print(' '); Serial.println(PINS[position].role); }
void setup() {
  digitalWrite(PINS[10].pin,BUZZER_ACTIVE_LOW?HIGH:LOW); pinMode(PINS[10].pin,OUTPUT);
  Serial.begin(9600);
  passed=rt::goldenCrcPasses();
  Serial.println(passed?F("RT1 CRC PASS"):F("RT1 ERROR CRC SELFTEST"));
  if(!passed) return;
  for(uint8_t i=0;i<10;++i) { digitalWrite(PINS[i].pin,LOW); pinMode(PINS[i].pin,OUTPUT); }
  Serial.println(F("RT1 PIN TEST READY"));
  announce(); digitalWrite(PINS[position].pin,HIGH); lastStep=millis();
}
void loop() {
  if(!passed || millis()-lastStep<700UL) return;
  digitalWrite(PINS[position].pin,LOW);
  position=(position+1)%10; announce(); digitalWrite(PINS[position].pin,HIGH); lastStep=millis();
}
