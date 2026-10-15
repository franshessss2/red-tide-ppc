// Hardware-free GPIO/serial harness. Production sketches are included unchanged.
#pragma once
#include <stdint.h>
#include <deque>
#include <string>
#include <sstream>
#include <vector>
#include <cassert>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define F(text) text
uint32_t clockMs = 0;
int levels[20] = {}, modes[20] = {};
std::vector<int> highsBeforeOutput;
unsigned long millis() { return clockMs; }
void digitalWrite(uint8_t pin, int value) { assert(pin >= 2 && pin < 20); levels[pin] = value; }
void pinMode(uint8_t pin, int mode) { if(levels[pin] == HIGH) highsBeforeOutput.push_back(pin); modes[pin] = mode; }
struct SerialMock {
  std::deque<char> input;
  std::string output;
  void begin(int baud) { assert(baud == 9600); }
  int available() { return input.size(); }
  char read() { char c = input.front(); input.pop_front(); return c; }
  template<typename T> void print(T value) { std::ostringstream text; text << value; output += text.str(); }
  void print(uint8_t value) { print(static_cast<int>(value)); }
  template<typename T> void println(T value) { print(value); output += '\n'; }
} Serial;
