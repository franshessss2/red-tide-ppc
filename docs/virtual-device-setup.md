# Virtual coastal device: manual setup

This integration is a school demonstration. Every value is simulated. It does
not identify toxic algae, measure toxins or change community warning status.
The original map, drawers, motion and Firebase integration are unchanged.

## What is already built

- `/devices`: a separate dashboard, accessible from **Device simulation** in the
  landing footer. It displays readings, receipt time, connection state and history.
- **Local rehearsal**: adjustable inputs and a send button; works without hardware,
  accounts or storage. Samples live only in this page's memory, clear on navigation
  and never get uploaded. Changing a slider alone does not send a reading.
- `/api/device-readings`: a Vercel function accepting authenticated Wokwi readings
  and serving a public feed of synthetic samples.
- `wokwi/`: firmware, a wired diagram, library list, configuration placeholders and
  the public ISRG Root X1 certificate. No account credentials are included.

## 1. Create the storage manually

Create a **Free** Redis database at [Upstash](https://console.upstash.com/redis).
The [pricing page](https://upstash.com/pricing/redis) lists a free tier for prototypes;
check the current limits in your account. Do not upgrade to a paid plan for this
demonstration. Nothing in this PR creates a database or subscription.

Copy the database's **REST URL** and **REST token** into Vercel's server environment
variables. Do not place either value in Wokwi, a `VITE_` variable or a committed file.

## 2. Configure Vercel manually

In the existing Red Tide project, add these environment variables:

| Name | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Database REST URL, `https://…upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Database REST token |
| `DEVICE_INGEST_TOKEN` | A newly generated, disposable demo token, 32–128 characters |
| `DEVICE_STORAGE_NAMESPACE` | `school-device-production`, or another 1–48 character name using letters, numbers and hyphens |

Generate a token locally with Node:

```sh
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

The demo ingestion token authorizes writes to **one synthetic device only**. It is
not your admin passcode, Redis token or Vercel token. Wokwi's free projects are public;
anyone who sees this demo token could submit synthetic samples until you revoke it.
Rotate/remove it after presenting. Keep real information out of this demonstration.

Use a different namespace for Preview, such as `school-device-preview`, to keep
preview records separate. Redeploy after configuring the variables. Merge this PR
manually only after review; the implementation does not merge or enable auto-merge.

Open `https://YOUR-DOMAIN/api/device-readings`. Before configuration it returns
`{"configured":false,"readings":[]}`. After configuration it returns
`{"configured":true,"readings":[]}` until a sample arrives. If you receive HTML,
the API deployment/routing is incorrect. Storage outages return HTTP 503, not an
empty healthy feed.

Vite's ordinary `npm run dev`/`dev:demo` serves the frontend, not Vercel functions.
Use Local rehearsal there. Test the endpoint on the deployed Vercel preview or
with `vercel dev` and locally configured server variables.

## 3. Create the Wokwi project manually

Open [a new ESP32 project](https://wokwi.com/projects/new/esp32).
Replace `sketch.ino` and `diagram.json` with the files in `wokwi/`; add
`libraries.txt`, `config.h` and `root-ca.h` as project files. The library list names
OneWire, DallasTemperature, Adafruit GFX Library, Adafruit SSD1306 and Adafruit BusIO.

Edit only these values in your Wokwi copy of `config.h`:

```cpp
const char* INGEST_URL = "https://YOUR-RED-TIDE-DOMAIN/api/device-readings";
const char* DEVICE_TOKEN = "YOUR_DISPOSABLE_DEMO_TOKEN";
```

Use the exact HTTPS deployment URL. Avoid preview URLs that require Vercel login:
the virtual ESP32 cannot complete an interactive sign-in. Do not disable project
protection globally just to connect a simulator; use the intended accessible school
deployment. HTTP redirects are not followed by the firmware.

The firmware verifies certificates against ISRG Root X1 and waits for network time
before HTTPS. If your domain uses another CA, replace `root-ca.h` with its verified
public root certificate. Do not use `setInsecure()` to hide TLS failures.

| Component | Connection |
| --- | --- |
| DS18B20 data | GPIO 4, with 4.7 kΩ pull-up to 3.3 V |
| Cloudiness knob signal | GPIO 34 (ADC1) |
| OLED SDA / SCL | GPIO 21 / 22 |
| Send button | GPIO 18 to ground, internal pull-up |

Run the simulation. Change the DS18B20 temperature and turn the potentiometer to
adjust **simulated cloudiness**. Its percentage is a teaching input, not NTU.
The OLED shows the inputs and delivery status. The serial monitor prints HTTP
status codes but never credentials.

Automatic sending occurs every 90 seconds after an accepted sample. Press the
yellow button for a manual attempt. The server accepts new samples at most once
every 30 seconds; retries retain the same session/sequence so a lost response does
not duplicate the latest sample. Older sequences in the retained history are
rejected. Restarting the ESP32 creates a new session.

## 4. Verify the complete connection

1. Start Wokwi and wait for **Reading accepted** on the OLED (HTTP 201 or 200).
2. Open `/devices`, keep **Wokwi connection** selected and click **Refresh readings**.
3. Confirm the temperature, cloudiness and receipt time match the submitted sample.
4. Change the inputs, wait at least 30 seconds and press Send reading. Refresh again.
5. Stop Wokwi. After three minutes without a received sample, the dashboard shows
   offline while keeping the last reading. An API/storage failure instead shows
   connection unavailable and warns that retained readings may be stale.
6. Confirm the original map still has its zone and advisory drawers. Sensor samples
   must not change zones, reports or warning status.

The dashboard checks for readings every 60 seconds while its tab is visible. It
pauses requests in a hidden tab, aborts requests when leaving the page and provides
a manual refresh. This is polling, not instant push delivery.

The server assigns device `wokwi-coast-01` to `honda-inner` (Honda Bay Inner). The
sender cannot choose arbitrary device IDs, zones, provenance or timestamps. History
is limited to 60 records; storage expires 24 hours after the last accepted sample.
The public read endpoint contains only synthetic demonstration data.

## Status codes

| Code | Meaning |
| --- | --- |
| 200 / 201 | Duplicate acknowledged / new sample stored |
| 400 | Invalid JSON, missing fields, unexpected fields or values outside bounds |
| 401 | Wrong or missing demo token |
| 409 | Older sequence in the retained session history |
| 413 / 415 | Body exceeds 2 KB / wrong media type |
| 429 | New sample sent too soon; retry after 30 seconds |
| 503 | Configuration incomplete or storage unavailable |

No configuration values or upstream credential-bearing errors appear in responses.
Writes use an atomic Redis Lua operation for ordering, deduplication, throttling
and bounded history. Storage is external; Vercel instance memory is not treated as
durable data.

## Verification boundaries

Automated tests cover request authentication, validation, payload limits, server
provenance, storage failure handling, REST protocol and dashboard source separation,
cleanup and failed refreshes. They use controlled storage responses. The actual
Wokwi-to-Vercel-to-Upstash connection requires the manual setup above and must be
checked before defense; no cloud account was created or configured by this work.
The firmware has not been compiled or executed in a configured Wokwi project by
this work. Compile it in Wokwi as part of the manual rehearsal above.

## References

- [Wokwi ESP32 networking](https://docs.wokwi.com/guides/esp32-wifi): free public
  gateway, outgoing HTTPS and monitored demo traffic.
- [Wokwi DS18B20](https://docs.wokwi.com/parts/wokwi-ds18b20) and
  [potentiometer](https://docs.wokwi.com/parts/wokwi-potentiometer): virtual inputs.
- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js):
  `/api` Web Standard handlers.
- [Upstash REST](https://upstash.com/docs/redis/features/restapi) and
  [EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval): persistence.
- [Let's Encrypt roots](https://letsencrypt.org/certificates/): public CA anchor.
- [Motion accessibility](https://motion.dev/docs/react-accessibility) and
  [Design Spells](https://designspells.com/): restrained status feedback; sensor
  data stays readable without motion. Existing React Bits-based intro/landing
  visuals are preserved; no UI or animation dependency is added.
