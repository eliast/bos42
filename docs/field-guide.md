# BOS/42 field guide

## Aircraft and motion

The shared server polls public positions within 40 nautical miles of Logan about every five seconds, using ADSB.lol with adsb.fi fallback. Clients share the server’s upstream requests and caches.

Movement between aircraft reports is estimated for at most eight seconds, then held. Positions older than twenty seconds are marked stale; tracks disappear after ninety seconds. A feed interruption displays a warning and retries. Simulated traffic is available only when explicitly selected in Settings.

GPS altitude is converted from the WGS84 ellipsoid to mean sea level using EGM96. Barometric fallback is labelled BARO and is not corrected for local pressure. Gauges show reported groundspeed, altitude, vertical speed and true ground track; these are not cockpit airspeed, magnetic heading or attitude.

Aircraft and vessel models are illustrative and enlarged for visibility. Operator colors describe the operating airline, which can differ from a marketed codeshare. Business-jet shape alone does not establish a private operator. Published routes are metadata and can be absent or outdated.

## Cameras and selection

Window uses a fixed virtual viewpoint. Its elevated perspective helps expose the airport; it is not a visibility or line-of-sight assessment. Explore supports panning, zooming, rotation and tilt. Follow uses the rendered aircraft position and continuous camera damping.

Automatic selection prefers a likely arrival, retains it through a short level-off and holds its first ground report for twelve seconds. If no arrival qualifies, it selects a nearby airborne flight. Selecting a flight keeps it through landing before moving to the next.

Director cycles scenes and uses recent observed approach directions. Approach history covers a bounded fifteen-minute window in server memory; it resets on server restart. Trails show recorded observations, not runway assignments or confirmed landings. If the history API is unavailable, the client can collect temporary session paths and labels that fallback. Missing reports leave gaps.

## Harbor

The backend maintains one shared AISStream WebSocket covering Boston Harbor. Clients poll `/api/vessels` every five seconds. Position motion is estimated for at most twenty seconds, then held.

Moving vessel reports become stale after one minute. Anchored, moored or nearly stationary reports become stale after five minutes. Positions expire after fifteen minutes. Static messages add details without refreshing a position timestamp. Available AIS traffic is not a census of every boat.

Vessel destinations and ETAs are crew-entered and may be outdated; AIS ETA contains no year. Unknown details remain blank. Vessel shape indicates an illustrative type, not an exact ship model.

## Weather and radio

The weather display combines Logan observations and harbor information with source times. FAA advisories describe airport conditions, not a verified delay for the selected flight.

ATC playback is a direct LiveATC stream. It can lag the map, covers multiple aircraft, and is not automatically matched to the selected flight. The first tap may be required by browser autoplay rules. Recovery retries interrupted playback with backoff; deliberate stop cancels recovery. See the provider’s [usage terms](https://www.liveatc.net/legal/).

## Motion and spotting

On iPad, native motion controls use Core Motion. Browser sensor support depends on the browser and permissions. Align establishes the saved view direction for a sensor session. Backgrounding, sensor resets or restarting can require fresh alignment.

Motion rotates a virtual viewpoint. It does not track walking or identify aircraft through the camera. Spotting cues use the saved window bearing and remain approximate; buildings, clouds and actual visibility are not assessed. Optional spotting sound is off by default.

## Flight stories and schedules

The free-feed history service records fresh likely arrivals and climbing departures within eight nautical miles of Logan. It can show previously observed operating days, near-airport time ranges after sufficient prior observations, and same-tail departures observed after an arrival. These are historical observations, not promises about future flights or exact landing times.

History is retained for 35 days, bounded to 40,000 visits, and saved atomically each minute when persistence is configured. Railway’s `/data` bootstrap uses `/data/bos42/flight-story.json` and drops privileges before starting the API. Local development is memory-only unless `FLIGHT_STORY_PATH` is set. Approach trails use a separate temporary store.

The optional FlightAware adapter adds verified schedule information. Gate departure and takeoff remain separate milestones; estimates and actuals remain distinct. Without `AEROAPI_KEY`, the API returns an explicit unconfigured state.

Provider results are cached for ten minutes and concurrent requests are coalesced. The default daily request limit is twenty upstream requests per UTC day **per server process**. It resets on process restart and is not an account-wide billing cap. The adapter only accepts aircraft already present in a fresh feed and rejects conflicting identity matches.

## Privacy and deployment boundaries

Railway serves the API rather than the app interface. The Docker context and staged deployment exclude the frontend, personal viewing defaults, signing material and environment files. Browser clients use the same-origin API in local development; installed clients fetch their configured HTTPS backend.

Git ignores `src/window.local.json`, but those preferences are bundled when building on a machine that has the file. Signing keys and provider credentials must never go in client code, local window defaults or `VITE_` variables.
