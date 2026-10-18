#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include "GoldenCrc.h"

namespace rt {
struct PinRole { uint8_t pin; const char *role; };
// C++11 constexpr recursion permits compile-time guards on UNO's AVR compiler.
template<size_t N> constexpr bool uniquePin(const PinRole (&p)[N], size_t i, size_t j) {
  return j == N || (p[i].pin != p[j].pin && uniquePin(p, i, j + 1));
}
template<size_t N> constexpr bool validPins(const PinRole (&p)[N], size_t i = 0) {
  return i == N || (p[i].pin >= 2 && p[i].pin <= 19 && uniquePin(p, i, i + 1) && validPins(p, i + 1));
}
inline uint8_t crc8(const char *data, size_t n) {
  uint8_t crc = 0;
  for(size_t i = 0; i < n; ++i) {
    crc ^= static_cast<uint8_t>(data[i]);
    for(uint8_t bit = 0; bit < 8; ++bit) crc = (crc & 0x80) ? (crc << 1) ^ 0x07 : crc << 1;
  }
  return crc;
}
inline bool goldenCrcPasses() {
  #define CHECK_VECTOR(text, expected) if(crc8(text, sizeof(text) - 1) != expected) return false;
  RT_CRC_VECTORS(CHECK_VECTOR)
  #undef CHECK_VECTOR
  return true;
}
inline int hexValue(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1; }
inline bool checkedPayload(const char *line, size_t n) {
  if(n < 3 || line[n - 3] != '*') return false;
  const int hi = hexValue(line[n - 2]), lo = hexValue(line[n - 1]);
  return hi >= 0 && lo >= 0 && crc8(line, n - 3) == (hi * 16 + lo);
}
struct Frame { char states[7]; bool any; bool usable; bool demo; };
inline bool parseFrame(const char *line, size_t n, Frame &out) {
  if(n != 19 || !checkedPayload(line, n) || strncmp(line, "Z1,", 3) || line[10] != ',' || line[12] != ',' || line[14] != ',') return false;
  bool any = false;
  for(uint8_t i = 0; i < 7; ++i) {
    const char c = line[3 + i];
    if(c != 'S' && c != 'A' && c != 'U' && c != 'X') return false;
    any |= c == 'A';
  }
  for(uint8_t i = 11; i <= 15; i += 2) if(line[i] != '0' && line[i] != '1') return false;
  if(any != (line[11] == '1')) return false;
  if(line[13] == '0' && (any || strncmp(line + 3, "XXXXXXX", 7))) return false;
  // Commit to out only after every check, never partially apply a bad line.
  memcpy(out.states, line + 3, 7);
  out.any = any; out.usable = line[13] == '1'; out.demo = line[15] == '1';
  return true;
}
inline bool zoneOn(char state, uint32_t elapsed) {
  return state == 'A' || (state == 'U' && elapsed % 1000 < 500) || (state == 'X' && elapsed % 250 < 125);
}
inline bool heartbeatOn(bool demo, uint32_t elapsed) {
  const uint16_t phase = elapsed % 1000;
  return phase < 100 || (demo && phase >= 200 && phase < 300);
}
} // namespace rt
