#include <Servo.h>
#include <stdlib.h>
#include <string.h>
// Combined wiring requires LEDs on D2-D7, D9, D13, A0 and A1.
const byte ledPins[]={2,3,4,5,6,7,9,13,A0,A1};
unsigned long lastLed=0;
void ledsOff(){ for(byte i=0;i<10;i++) digitalWrite(ledPins[i],LOW); }
// Reported wiring: TRIG D10, ECHO D11, servo D12, buzzer D8.
const byte TRIG=10, ECHO=11, SERVO=12, BUZZER=8;
Servo scanner;
int angle=90, direction=1;
bool scanning=false;
unsigned long lastStep=0, lastCommand=0;
char command[24]; byte used=0; bool overflow=false;
void stopScan() { scanning=false; scanner.detach(); noTone(BUZZER); }
void setup() {
  for(byte i=0;i<10;i++) pinMode(ledPins[i],OUTPUT);
  ledsOff();
  pinMode(TRIG,OUTPUT); digitalWrite(TRIG,LOW); pinMode(ECHO,INPUT);
  pinMode(BUZZER,OUTPUT); digitalWrite(BUZZER,LOW);
  Serial.begin(9600); Serial.println(F("RT1 COMBINED READY"));
}
void loop() {
  while(Serial.available()) {
    char c=Serial.read(); if(c=='\r') continue;
    if(c=='\n') {
      command[used]=0;
      if(!overflow) {
        if(!strcmp(command,"HELLO")) Serial.println(F("RT1 COMBINED READY"));
        else if(!strcmp(command,"START")) {
          if(!scanning) { angle=90; direction=1; scanner.attach(SERVO); scanner.write(angle); lastStep=millis(); }
          scanning=true; lastCommand=millis(); Serial.println(F("RT1 SCANNER STARTED"));
        } else if(!strcmp(command,"KEEP")) lastCommand=millis();
        else if(!strcmp(command,"STOP")) { stopScan(); ledsOff(); Serial.println(F("RT1 SCANNER STOPPED")); }
        else if(!strcmp(command,"BEEP")) { tone(BUZZER,1500,120); Serial.println(F("RT1 SCANNER BEEP")); }
        else if(!strcmp(command,"OFF")) { ledsOff(); Serial.println(F("RT1 LED OFF")); }
        else if(!strncmp(command,"LED ",4)) {
          char *end; long n=strtol(command+4,&end,10);
          if(end!=command+4 && *end==0 && n>=1 && n<=10) {
            ledsOff(); digitalWrite(ledPins[n-1],HIGH); lastLed=millis();
            Serial.print(F("RT1 LED ")); Serial.println(n);
          } else Serial.println(F("RT1 ERROR COMMAND"));
        } else Serial.println(F("RT1 ERROR COMMAND"));
      } else Serial.println(F("RT1 ERROR LENGTH"));
      used=0; overflow=false;
    } else if(used<sizeof(command)-1 && !overflow) command[used++]=c;
    else overflow=true;
  }
  if(millis()-lastLed>5000UL) ledsOff();
  if(scanning && millis()-lastCommand>5000UL) { stopScan(); ledsOff(); }
  if(scanning && millis()-lastStep>=100UL) {
    lastStep=millis();
    digitalWrite(TRIG,LOW); delayMicroseconds(2);
    digitalWrite(TRIG,HIGH); delayMicroseconds(10); digitalWrite(TRIG,LOW);
    unsigned long duration=pulseIn(ECHO,HIGH,25000UL);
    long distance=duration ? duration/58UL : -1;
    if(distance<2 || distance>400) distance=-1;
    Serial.print(F("RT1 SAMPLE ")); Serial.print(angle); Serial.print(' '); Serial.println(distance);
    angle+=direction*2;
    if(angle>=150) { angle=150; direction=-1; }
    if(angle<=30) { angle=30; direction=1; }
    scanner.write(angle);
  }
}
