#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_system.h>
#include <time.h>
#include "config.h"
#include "root-ca.h"

// ADC1 stays usable while ESP32 Wi-Fi is active.
const int TEMP_PIN = 4, CLOUD_PIN = 34, BUTTON_PIN = 18;
const unsigned long SAMPLE_INTERVAL = 90000, RETRY_INTERVAL = 30000;
OneWire oneWire(TEMP_PIN);
DallasTemperature probe(&oneWire);
Adafruit_SSD1306 screen(128, 64, &Wire, -1);
String sessionId, pending;
unsigned long sequenceNumber = 0, nextSend = 0, lastDisplay = 0;
bool buttonHeld = false, clockStarted = false;
String delivery = "Waiting";

bool configured() {
  return String(INGEST_URL).startsWith("https://") &&
    String(INGEST_URL).indexOf("YOUR-RED-TIDE") == -1 &&
    strlen(DEVICE_TOKEN) >= 32 && String(DEVICE_TOKEN).indexOf("REPLACE_") == -1;
}

bool readInputs(float &temperature, float &cloudiness) {
  probe.requestTemperatures();
  temperature = probe.getTempCByIndex(0);
  cloudiness = analogRead(CLOUD_PIN) * 100.0f / 4095.0f;
  return isfinite(temperature) && temperature >= -55 && temperature <= 125;
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  analogReadResolution(12);
  probe.begin();
  Wire.begin(21, 22);
  screen.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  screen.clearDisplay();
  sessionId = String(esp_random(), HEX) + "-" + String(esp_random(), HEX);
  WiFi.begin("Wokwi-GUEST", "", 6);
  WiFi.setAutoReconnect(true);
  Serial.println("Red Tide virtual station. All inputs are simulated.");
}

void loop() {
  const unsigned long now = millis();
  bool pressed = digitalRead(BUTTON_PIN) == LOW;
  bool manual = pressed && !buttonHeld;
  buttonHeld = pressed;
  float temperature = 0, cloudiness = 0;
  bool valid = false;
  if (now - lastDisplay >= 1000 || manual) {
    valid = readInputs(temperature, cloudiness);
    lastDisplay = now;
    screen.clearDisplay(); screen.setTextSize(1); screen.setTextColor(SSD1306_WHITE);
    screen.setCursor(0, 0); screen.println("RED TIDE / SIMULATED");
    if (valid) {
      screen.printf("Temp: %.1f C\n", temperature);
      screen.printf("Cloud knob: %.0f %%\n", cloudiness);
    } else screen.println("Probe disconnected");
    screen.println(WiFi.status() == WL_CONNECTED ? "WiFi connected" : "WiFi reconnecting");
    screen.println(configured() ? delivery : "Configure URL/token");
    screen.display();
  }
  if (!configured() || WiFi.status() != WL_CONNECTED) { delay(20); return; }
  if (!clockStarted) { configTime(0, 0, "pool.ntp.org", "time.google.com"); clockStarted = true; }
  // Certificate expiry checks require an actual clock. Never disable TLS checks.
  if (time(nullptr) < 1700000000) { delivery = "Waiting for clock"; delay(100); return; }
  if (!manual && (long)(now - nextSend) < 0) { delay(20); return; }
  if (pending.isEmpty()) {
    if (!valid) valid = readInputs(temperature, cloudiness);
    if (!valid) { delivery = "Probe error"; nextSend = now + RETRY_INTERVAL; return; }
    char sample[360];
    snprintf(sample, sizeof(sample), "{\"deviceId\":\"wokwi-coast-01\",\"sessionId\":\"%s\",\"sequence\":%lu,\"temperatureC\":%.2f,\"cloudinessPercent\":%.2f}", sessionId.c_str(), sequenceNumber, temperature, cloudiness);
    pending = sample;
  }
  WiFiClientSecure client;
  client.setCACert(ROOT_CA);
  client.setHandshakeTimeout(10);
  HTTPClient http;
  http.setConnectTimeout(10000); http.setTimeout(10000);
  // No redirects: avoids accidentally sending the demo token to another host.
  if (!http.begin(client, INGEST_URL)) { delivery = "HTTPS setup failed"; nextSend = now + RETRY_INTERVAL; return; }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int status = http.POST(pending);
  Serial.printf("Delivery HTTP %d (credentials not logged)\n", status);
  if (status == 200 || status == 201) {
    pending = ""; sequenceNumber++; delivery = "Reading accepted"; nextSend = millis() + SAMPLE_INTERVAL;
  } else {
    delivery = status == 401 ? "Check demo token" : status == 503 ? "Server not ready" : status == 429 ? "Wait 30 seconds" : "Delivery retry";
    nextSend = millis() + RETRY_INTERVAL;
    // Older pending sequences cannot overwrite newer accepted readings.
    if (status == 409) { pending = ""; sequenceNumber++; }
  }
  http.end();
}
