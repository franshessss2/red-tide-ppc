#include <ZoneProtocol.h>

// Same owner-reported, bench-confirmed mapping as red_tide_zones. LEDs only.
constexpr rt::PinRole PINS[] = {
  {13,"pp-bay"}, {12,"sta-lourdes"}, {11,"honda-inner"}, {10,"honda-outer"},
  {9,"binuatan"}, {7,"sabang"}, {6,"irawan"}, {5,"any-advisory"},
  {4,"heartbeat"}, {3,"stale"}
};
static_assert(rt::validPins(PINS), "Pins must be unique UNO pins; D0/D1 are reserved");
bool passed=false; uint8_t position=0; unsigned long lastStep=0;
void announce() { Serial.print(F("RT1 PIN ")); Serial.print(position+1); Serial.print(F(" D")); Serial.print(PINS[position].pin); Serial.print(' '); Serial.println(PINS[position].role); }
void setup() {
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
