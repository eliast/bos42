# BOS/42 on iPad

Capacitor packages the 3D interface inside an iPad app. Railway supplies flight positions and published routes over HTTPS. Once installed, the app runs without this Mac; internet access is still needed for flights, map tiles and fonts.

- App: **BOS/42**, bundle ID `us.torrez.bos42`.
- Device target: **iPad, iPadOS 16 or newer**, portrait or landscape.
- Native project: `ios/App/App.xcodeproj`, using Swift Package Manager.
- The backend origin is configured by `API_BASE_URL` in ignored `.env.deploy.local`; its health endpoint is `/api/health`.

The Railway address is an API, not the visual app. It serves public aircraft data, Logan weather and FAA BOS status, with no accounts or app authentication. CORS allows the app’s `capacitor://localhost` origin; CORS is not authentication. The allowlisted server upload excludes the frontend, personal camera configuration, native project and environment files.

## Install over USB-C

1. Install **Xcode 26 or newer** from Apple, open it, and complete its first-run setup and iOS platform installation. If command-line tools point at the standalone Command Line Tools installation, prefix Xcode commands with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
2. In Xcode → Settings → Apple Accounts, sign in with your Apple account.
3. Connect the iPad to the Mac with a USB-C data cable. Unlock it and choose **Trust** if asked. In iPad Settings → Privacy & Security, enable **Developer Mode**, follow the restart prompt and confirm. The setting may appear after Xcode first pairs with the device.
4. From the project directory, run:

   ```sh
   npm run ios:sync
   npm run ios:open
   ```

5. Let Xcode resolve its Swift packages. Select the **App** target → **Signing & Capabilities**, enable automatic signing and choose your own team. If that bundle ID is unavailable to your team, use a unique personal identifier in both Xcode and `capacitor.config.ts`.
6. Select your connected iPad as the run destination, then press **Run** (⌘R). Xcode builds, signs and installs BOS/42. If the device asks to trust the developer, follow its prompt under Settings → General → VPN & Device Management.
7. Open BOS/42, confirm the live indicator and moving aircraft, then check My Window, Explore, Follow, rotation and touch gestures. Unplug the cable and verify updates continue on Wi-Fi.

A free Apple account supports personal on-device testing, but its provisioning profiles expire after seven days; you may need to reconnect and reinstall. A paid Apple Developer membership offers additional distribution options. No App Store submission is needed for USB development installation. Future changes to the bundled interface require another build and installation; server-only changes deploy to Railway independently.

References: [Apple: run on a physical device](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices), [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [Personal Team limits](https://developer.apple.com/support/compare-memberships/), [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

## Rebuild the native bundle

Node 22 or newer is required. Run `npm ci` in a fresh checkout, then copy `.env.deploy.example` to `.env.deploy.local` and set `API_BASE_URL` and `APPLE_TEAM_ID`. Build scripts generate ignored local Xcode signing settings automatically. An optional `.env.native.local` file can override `VITE_API_BASE_URL` for iPad only.

```sh
npm run ios:sync
```

This validates the hosted HTTPS API origin, type-checks the app, builds `dist-native/` and copies it into the native project. A missing or local HTTP endpoint fails the build. Capacitor has no remote `server.url`: the interface ships with the app. Browser preview builds still use their local same-origin server and the separate `dist/` directory.

The generated native assets/config are ignored by Git and must be recreated with `ios:sync` after checkout. Source files for the native project, app icon, preferences and Swift packages are retained. Do not run `ios:add` again while the `ios/` directory exists.

## Deploy server changes

Set `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID` and `RAILWAY_ENVIRONMENT` in ignored `.env.deploy.local`. The release script validates those settings and uploads only the checked API staging directory:

```sh
npm test
npm run deploy:railway
```

`--no-gitignore` is scoped to the generated `.railway-build` directory, which contains only the reviewed API files. Do not use it when uploading the workspace or application root.

The Docker image uses Node 22, production dependencies and an unprivileged process. Railway supplies `PORT`; the service binds `0.0.0.0`. A health check at `/api/health` verifies the service independently of provider availability. The default is one always-running replica with shared in-memory request caching. Railway usage is billed under your existing plan.

After deployment, check its status in the dashboard and run:

```sh
BOS42_URL="https://your-api.example" npm run check:live -- 30
```

An aggregate report appears under `artifacts/` without storing individual flight identities. Public feed outages remain possible; the app marks stale data and falls back between ADSB.lol and adsb.fi.

## Verification so far

- All 31 automated tests passed, including native HTTPS validation, CORS, preflight and upstream failure handling.
- Web and native JavaScript builds passed; Capacitor generated and synced the iOS project.
- Railway reported a successful deployment. HTTPS health and live aircraft checks returned 200, with 77 aircraft and a source age of 0.534 seconds at the initial check. Native-origin preflight returned 204; frontend source requests returned 404.
- MapLibre 6.11.2 fixes the sanitizer vulnerability in the earlier renderer. My Window, Explore and Follow were visually checked with live aircraft in the browser, with no console errors observed. npm audits reported no known vulnerabilities in either the app or minimal server dependencies at preparation time.
- Xcode compiled and signed both Debug and Release builds. The user's Apple team and connected iPad were provisioned, Developer Mode was enabled by the user, and the corrected Release app was installed and launched over USB-C on the iPad Pro 11-inch (M4), running iPadOS 18.7.8.
- The first installed build received live flights but stalled while loading the map. Device logs identified a missing MapLibre worker: development served it from the dependency directory, while the production bundle had omitted it. `MapView.tsx` now explicitly imports the worker through Vite's `?worker&url` and configures MapLibre with the emitted asset. Native logs then confirmed `BOS/42 map ready`; the production browser build also rendered the airport and aircraft without console errors. Initialization errors and a 20-second startup timeout now show a recovery message instead of an indefinite spinner.
- The current signing profile expires October 3, 2027. Its duration comes from the selected Apple team; the seven-day limit above applies to free Personal Teams.
- The user confirmed the corrected Release app displays the airport map and aircraft on the physical iPad.
- **Still required:** extended physical iPad touch/performance checks, rotation/safe-area checks, and a background/resume test. The installed release runs independently of the debugger and uses Railway for flight data.
