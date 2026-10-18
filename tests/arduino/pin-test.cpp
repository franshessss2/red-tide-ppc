#include "Arduino.h"
#include "../../arduino/red_tide_pin_test/red_tide_pin_test.ino"
#include <iostream>
int main() {
  setup();
  assert(passed && rt::goldenCrcPasses());
  assert(highsBeforeOutput.size() == 1 && highsBeforeOutput[0] == 8);
  const uint8_t expected[] = {3,4,5,6,7,9,10,11,12,13};
  for(uint8_t step=0;step<20;++step) {
    assert(position == step%10 && levels[8] == HIGH);
    for(uint8_t i=0;i<10;++i) assert(levels[expected[i]] == (i == step%10 ? HIGH : LOW));
    const unsigned long before=clockMs;
    clockMs=before+699; loop(); assert(position == step%10);
    clockMs=before+700; loop();
  }
  assert(Serial.output.find("RT1 CRC PASS\nRT1 PIN TEST READY") != std::string::npos);
  for(uint8_t i=0;i<10;++i) assert(Serial.output.find(PINS[i].role) != std::string::npos);
  assert(modes[2] == 0 && modes[14] == 0 && modes[15] == 0);
  std::cout << "PASS actual pin sketch: shared CRC vectors, 700ms sweep, role prints, buzzer HIGH, unused pins untouched\n";
}
