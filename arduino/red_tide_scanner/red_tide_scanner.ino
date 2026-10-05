#include <Servo.h>
// Reported wiring: TRIG D10, ECHO D11, servo D12, buzzer D8.
const byte TRIG=10, ECHO=11, SERVO=12, BUZZER=8;
Servo scanner;
int angle=90, direction=1;
bool scanning=false;
unsigned long lastStep=0, lastCommand=0;
char command[24]; byte used=0; bool overflow=false;
void stopScan() { scanning=false; scanner.detach(); noTone(BUZZER); }
void setup() {
  pinMode(TRIG,OUTPUT); digitalWrite(TRIG,LOW); pinMode(ECHO,INPUT);
  pinMode(BUZZER,OUTPUT); digitalWrite(BUZZER,LOW);
  Serial.begin(9600); Serial.println(F("RT1 SCANNER READY"));
}
void loop() {
  while(Serial.available()) {
    char c=Serial.read(); if(c=='\r') continue;
    if(c=='\n') {
      command[used]=0;
      if(!overflow) {
        if(!strcmp(command,"HELLO")) Serial.println(F("RT1 SCANNER READY"));
        else if(!strcmp(command,"START")) {
          if(!scanning) { angle=90; direction=1; scanner.attach(SERVO); scanner.write(angle); lastStep=millis(); }
          scanning=true; lastCommand=millis(); Serial.println(F("RT1 SCANNER STARTED"));
        } else if(!strcmp(command,"KEEP")) lastCommand=millis();
        else if(!strcmp(command,"STOP")) { stopScan(); Serial.println(F("RT1 SCANNER STOPPED")); }
        else if(!strcmp(command,"BEEP")) { tone(BUZZER,1500,120); Serial.println(F("RT1 SCANNER BEEP")); }
        else Serial.println(F("RT1 ERROR COMMAND"));
      } else Serial.println(F("RT1 ERROR LENGTH"));
      used=0; overflow=false;
    } else if(used<sizeof(command)-1 && !overflow) command[used++]=c;
    else overflow=true;
  }
  if(scanning && millis()-lastCommand>5000UL) stopScan();
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
