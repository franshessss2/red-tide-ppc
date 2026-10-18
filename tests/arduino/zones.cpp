#include "Arduino.h"
#include "../../arduino/red_tide_zones/red_tide_zones.ino"
#include <iostream>
#include <iomanip>
void send(const std::string &text) { for(char c : text + "\n") Serial.input.push_back(c); while(Serial.available()) loop(); }
std::string checked(const std::string &payload) { std::ostringstream out; out << payload << '*' << std::uppercase << std::hex << std::setw(2) << std::setfill('0') << int(rt::crc8(payload.c_str(),payload.size())); return out.str(); }
int main() {
  setup(); loop();
  assert(highsBeforeOutput.size() == 1 && highsBeforeOutput[0] == 8);
  assert(levels[8] == HIGH && levels[11] == LOW && levels[12] == LOW && levels[13] == HIGH);
  assert(Serial.output.find("RT1 CRC PASS\nRT1 ZONES READY") != std::string::npos);
  assert(rt::goldenCrcPasses());
  // Fixed vector from the shared header; valid frame applies all seven at once.
  send("Z1,AXUSSSS,1,1,0*0C");
  assert(Serial.output.find("RT1 ACK Z1,AXUSSSS,1,1,0*0C") != std::string::npos);
  assert(levels[3] == HIGH && levels[4] == HIGH && levels[5] == HIGH && levels[6] == LOW);
  assert(levels[11] == HIGH && levels[12] == HIGH && levels[13] == LOW);
  clockMs=125; loop(); assert(levels[4] == LOW && levels[5] == HIGH && levels[12] == LOW);
  clockMs=500; loop(); assert(levels[5] == LOW);
  const unsigned long previous = lastFrame;
  send("Z1,SSSSSSS,0,1,1*00"); // bad checksum
  send(checked("Z1,SSSSSSS,1,1,1")); // inconsistent any bit
  send(checked("Z1,SSSSSSS,0,0,1")); // unusable must be seven unknowns
  send(checked("Z1,?SSSSSS,0,1,1"));
  send(std::string(80,'X'));
  assert(lastFrame == previous && current.states[0] == 'A');
  send("Z1,SSSSSSS,0,1,1*7A");
  clockMs=700; loop(); assert(levels[12] == HIGH); // 200ms into demo double pulse
  clockMs=800; loop(); assert(levels[12] == LOW);
  send("BEEP*5C"); assert(levels[8] == LOW);
  clockMs=919; send("BEEP*5C"); assert(levels[8] == LOW);
  clockMs=920; loop(); assert(levels[8] == HIGH); // duplicate did not extend beep
  send("BEEP*5C"); assert(levels[8] == HIGH); // 3-second cooldown
  clockMs=15499; loop(); assert(levels[13] == LOW);
  clockMs=15500; loop(); assert(levels[13] == HIGH && levels[12] == LOW && levels[11] == LOW);
  clockMs=15600; send("HELLO"); send("BEEP*5C"); assert(lastFrame == 500 && levels[8] == HIGH);
  send("Z1,XXXXXXX,0,0,1*54"); assert(levels[13] == HIGH && levels[12] == LOW);
  // Check wraparound using the actual watchdog's unsigned subtraction.
  clockMs=0xfffffff0UL; send("Z1,SSSSSSS,0,1,1*7A");
  assert(!isStale(0x00000010UL));
  assert(isStale(0x00003a88UL));
  assert(modes[2] == 0 && modes[14] == 0 && modes[15] == 0);
  std::cout << "PASS actual zone sketch: CRC, parsing, atomic rejection, patterns, bounded beep, boot/stale/15s/wraparound\n";
}
