#pragma once
// CRC-8/SMBUS: poly 07, init 00, refin/refout false, xorout 00.
// Independent hand calculation for ASCII A (41 hex), after each MSB-first bit:
// 82, 03, 06, 0C, 18, 30, 60, C0. No production CRC function generated this vector.
// The same literal vectors are consumed by JS tests and both sketch self-tests.
#define RT_CRC_VECTORS(V) \
  V("", 0x00) \
  V("A", 0xC0) \
  V("123456789", 0xF4) \
  V("Z1,SSSSSSS,0,1,1", 0x7A) \
  V("Z1,AXUSSSS,1,1,0", 0x0C) \
  V("Z1,XXXXXXX,0,0,1", 0x54) \
  V("BEEP", 0x5C)
