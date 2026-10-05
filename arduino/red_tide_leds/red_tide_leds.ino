// School demonstration only. One LED at a time limits aggregate current.
const byte pins[] = {13,12,11,10,9,7,6,5,4,3};
char command[24];
byte used = 0;
bool overflow = false;
unsigned long lastCommand = 0;
void off() { for (byte i=0;i<10;i++) digitalWrite(pins[i],LOW); }
void setup() {
  for (byte i=0;i<10;i++) { pinMode(pins[i],OUTPUT); digitalWrite(pins[i],LOW); }
  Serial.begin(9600);
  Serial.println(F("RT1 LED READY"));
}
void loop() {
  while (Serial.available()) {
    char c=Serial.read();
    if(c=='\r') continue;
    if(c=='\n') {
      command[used]=0;
      if (!overflow) {
        if (!strcmp(command,"HELLO")) Serial.println(F("RT1 LED READY"));
        else if (!strcmp(command,"OFF")) { off(); Serial.println(F("RT1 LED OFF")); }
        else if (!strncmp(command,"LED ",4)) {
          char *end;
          long n=strtol(command+4,&end,10);
          if(end!=command+4 && *end==0 && n>=1 && n<=10) {
            off(); digitalWrite(pins[n-1],HIGH); lastCommand=millis();
            Serial.print(F("RT1 LED ")); Serial.println(n);
          } else Serial.println(F("RT1 ERROR COMMAND"));
        } else Serial.println(F("RT1 ERROR COMMAND"));
      } else Serial.println(F("RT1 ERROR LENGTH"));
      used=0; overflow=false;
    } else if(used<sizeof(command)-1 && !overflow) command[used++]=c;
    else overflow=true;
  }
  // A forgotten browser session cannot leave an LED on indefinitely.
  if(millis()-lastCommand>5000UL) off();
}
