# Samsung TV and release commands

All clients build from the shared `src/` and `shared/` interface. Installed iPad and TV apps fetch data from the configured HTTPS backend and work independently of the development Mac.

## Local configuration

```sh
cp .env.deploy.example .env.deploy.local
```

Fill in `API_BASE_URL`, `TV_HOST` and `TIZEN_SIGNING_PROFILE`. Set `APPLE_TEAM_ID` for iOS and the Railway identifiers for backend deployment. `.env.deploy.local` is ignored by Git. Process variables override file values; TV command-line flags override both. Use ordinary dotenv assignments, quoting values that contain spaces; shell commands are not evaluated.

## Samsung TV

```sh
npm ci
npm run build:tizen
npm run deploy:tizen -- --dry-run
npm run deploy:tizen
```

A developer-enabled Samsung TV, Tizen CLI tools and valid Samsung author/distributor certificates for the TV are required. `TIZEN_SDK_PATH` defaults to `~/tizen-studio`. You can override settings with `--host`, `--profile` and `--sdk`. Passwords stay in macOS Keychain; certificates remain outside Git.

The deployer reads the app ID from `tizen/config.xml`. Build outputs and signed packages are ignored. `API_BASE_URL` is required unless `VITE_API_BASE_URL` is set explicitly (for example in ignored `.env.tizen.local`). Backend URLs are public in installed apps.

## iPad / TestFlight

```sh
npm run ios:sync
npm run ios:open
```

Both commands first generate `ios/signing.local.xcconfig` from `APPLE_TEAM_ID`. Debug and Release configurations read it. This generated file is ignored. Open the App scheme in Xcode and archive for App Store Connect. Preserve the existing bundle identifier when updating the same TestFlight app. Optional `.env.native.local` can set a different `VITE_API_BASE_URL` for iPad builds.

Apple account access, signing identities and profiles are machine-local; a fresh clone does not supply them. Increment the build number for later uploads or let Xcode manage it.

## Railway

```sh
npm run check:railway
npm run deploy:railway
```

The deployment command requires `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID` and `RAILWAY_ENVIRONMENT`. It validates them, stages and checks the API-only directory, then uploads that directory with the Railway CLI. It never uploads the repository root with `--no-gitignore`.

For Git-connected deployment, use the root Dockerfile. Keep provider keys in Railway variables, set the health check to `/api/health`, and preserve the `/data` volume for history. No client-side environment file belongs on Railway.
