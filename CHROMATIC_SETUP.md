# Chromatic Visual Testing for React Native Storybook

This guide explains how to configure a React Native Storybook project to generate APK/IPA builds for [Chromatic](https://www.chromatic.com/) visual testing. Chromatic captures screenshots of every story in your Storybook and compares them across commits to catch unintended visual changes. For React Native, this works by running your app in an emulator in the cloud and connecting to a Storybook server via websockets.

Two setups are covered: **Expo** and **bare React Native (CLI)**.

**Important:** All Chromatic-specific configuration is conditional via environment variables, so the normal app is never affected.

Both follow the same core steps:

1. Conditionally configure Storybook for Chromatic's capture environment
2. Conditionally make Storybook the app's initial view
3. Build release APK / iOS `.app` with the right env vars
4. Generate a `manifest.json`
5. Upload to Chromatic

---

## Environment Variables

Two env vars control the setup. Neither is set by default, so your normal app is unaffected.

| Variable | Purpose | Expo | Bare RN |
|----------|---------|------|---------|
| Storybook toggle | Enables Storybook as the app entry & bundles stories in Metro | `EXPO_PUBLIC_STORYBOOK_ENABLED=true` | `STORYBOOK_ENABLED=true` |
| Chromatic toggle | Enables Chromatic capture options (websockets, host, disables on-device UI/addons) | `EXPO_PUBLIC_CHROMATIC=true` | `CHROMATIC=true` |

When building for Chromatic, **both** variables must be set.

---

## Common Steps (both Expo and bare React Native)

### 1. Conditionally configure the Storybook UI entry point

In `.rnstorybook/index.tsx`, spread the Chromatic options only when the env var is set:

```tsx
// For Expo: process.env.EXPO_PUBLIC_CHROMATIC
// For bare RN: process.env.CHROMATIC
const isChromatic = process.env.CHROMATIC === 'true';

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
  // Only active in Chromatic builds
  ...(isChromatic && {
    enableWebsockets: true,
    host: 'react-native.capture.chromatic.com',
    port: 7007,
    secured: true,
    onDeviceUI: false,
    shouldPersistSelection: false,
  }),
});
```

### 2. Conditionally disable on-device addons

In `.rnstorybook/main.ts`, include addons normally but clear them for Chromatic (there's a Storybook 10 bug where on-device addons break Chromatic captures):

```ts
const isChromatic = process.env.CHROMATIC === 'true';

const main: StorybookConfig = {
  stories: ['../components/**/*.stories.?(ts|tsx|js|jsx)'],
  addons: isChromatic
    ? []
    : [
        '@storybook/addon-ondevice-controls',
        '@storybook/addon-ondevice-actions',
        '@storybook/addon-ondevice-backgrounds',
        '@storybook/addon-ondevice-notes',
      ],
};
```

### 3. Conditionally enable Storybook in Metro

In `metro.config.js`, gate `withStorybook` on the env var so stories aren't bundled in normal app builds:

```js
module.exports = withStorybook(defaultConfig, {
  enabled: process.env.STORYBOOK_ENABLED === 'true',
});
```

### 4. Install the Chromatic CLI

The [Chromatic CLI](https://www.chromatic.com/docs/cli/) is used to generate the manifest and upload builds. Install it as a dev dependency:

```bash
npm install --save-dev chromatic
# or
yarn add --dev chromatic
```

### 5. Install `cross-env`

[`cross-env`](https://github.com/kentcdodds/cross-env) sets environment variables across platforms (macOS, Linux, Windows). It's used in the build scripts to pass `STORYBOOK_ENABLED` and `CHROMATIC` to the build process:

```bash
npm install --save-dev cross-env
# or
yarn add --dev cross-env
```

### 6. Generate the manifest

After building the APK/IPA, generate a `manifest.json` that tells Chromatic which stories exist in the build:

```bash
npx chromatic generate-manifest -o storybook-static
```

This scans the built Storybook metadata and produces the file `storybook-static/manifest.json`.

### 7. Upload to Chromatic

Place the APK (named `storybook.apk`), the iOS build (named `storybook.app`), and the `manifest.json` into a single directory (e.g., `storybook-static/`), then run:

```bash
npx chromatic --project-token <your-token> -d storybook-static
```

You can find your project token in your Chromatic project settings at [chromatic.com](https://www.chromatic.com/). See the [Chromatic React Native docs](https://www.chromatic.com/docs/react-native/) for more details.

---

## Expo Project Setup

This section applies to projects using [Expo](https://docs.expo.dev/) with [Expo Router](https://docs.expo.dev/router/introduction/) for file-based routing.

### Install EAS CLI

[EAS Build](https://docs.expo.dev/build/introduction/) is Expo's build service for creating standalone app binaries (APK, IPA). Install the CLI globally:

```bash
npm install -g eas-cli
```

You'll need an [Expo account](https://expo.dev/signup) (free). Run `eas login` to authenticate. See the [EAS Build setup guide](https://docs.expo.dev/build/setup/) for full details.

### Conditional routing with Expo Router

In `app/_layout.tsx`, use `Stack.Protected` to guard both route groups based on the env var:

```tsx
const StorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

export const unstable_settings = {
  initialRouteName: StorybookEnabled ? "(storybook)/index" : "(pages)/index",
};

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={StorybookEnabled}>
        <Stack.Screen name="(storybook)/index" />
      </Stack.Protected>

      <Stack.Protected guard={!StorybookEnabled}>
        <Stack.Screen name="(pages)/index" />
      </Stack.Protected>
    </Stack>
  );
}
```

When `EXPO_PUBLIC_STORYBOOK_ENABLED` is not set, the app starts at `(pages)/index` and the Storybook route is inaccessible.

### Metro config

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withStorybook } = require("@storybook/react-native/metro/withStorybook");

const defaultConfig = getDefaultConfig(__dirname);

module.exports = withStorybook(defaultConfig, {
  enabled: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true",
});
```

### Add identifiers to `app.json`

EAS Build requires a `bundleIdentifier` (iOS) and `package` (Android) to produce standalone binaries. Add these to your `app.json` (or `app.config.js`):

```json
{
  "ios": {
    "bundleIdentifier": "com.yourapp.storybook"
  },
  "android": {
    "package": "com.yourapp.storybook"
  }
}
```

### Create `eas.json`

[`eas.json`](https://docs.expo.dev/build/eas-json/) defines named build profiles. Each profile can set env vars, platform options, and distribution type. Create dedicated profiles for the Chromatic builds:

```json
{
  "build": {
    "storybook-android": {
      "env": {
        "EXPO_PUBLIC_STORYBOOK_ENABLED": "true",
        "EXPO_PUBLIC_CHROMATIC": "true"
      },
      "android": { "buildType": "apk" },
      "distribution": "internal"
    },
    "storybook-ios": {
      "env": {
        "EXPO_PUBLIC_STORYBOOK_ENABLED": "true",
        "EXPO_PUBLIC_CHROMATIC": "true"
      },
      "ios": { "simulator": true },
      "distribution": "internal"
    }
  }
}
```

### Build commands

The `--local` flag runs the build on your machine instead of Expo's cloud servers (no EAS subscription required). The `--output` flag specifies where to save the resulting binary:

```bash
# Android APK
eas build --profile storybook-android --platform android --local --output storybook-static/storybook.apk

# iOS .app for simulator
eas build --profile storybook-ios --platform ios --local --output storybook-static/storybook.tar.gz

# Generate manifest
npx chromatic generate-manifest -o storybook-static
```

> **Note:** The iOS profile uses `"simulator": true` which produces an unsigned `.app` bundle. This doesn't require an Apple Developer certificate and is what Chromatic expects.

---

## Bare React Native (CLI) Project Setup

This section applies to projects initialized with the [React Native CLI](https://reactnative.dev/docs/getting-started-without-a-framework) (not Expo).

### Prerequisites

Install [`babel-plugin-transform-inline-environment-variables`](https://babeljs.io/docs/babel-plugin-transform-inline-environment-variables) and add it to your Babel config. This replaces `process.env.*` references with their actual values at build time, which is essential for the conditionals to work in the release JS bundle (where `process.env` is otherwise not available):

```bash
npm install --save-dev babel-plugin-transform-inline-environment-variables
```

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['transform-inline-environment-variables'],
};
```

### Conditional app entry

In `App.tsx`, conditionally render Storybook or your normal app:

```tsx
import { HomeScreen } from './src/screens/Home';
import StorybookUIRoot from './.rnstorybook';

const isStorybook = process.env.STORYBOOK_ENABLED === 'true';

export default isStorybook ? StorybookUIRoot : HomeScreen;
```

When `STORYBOOK_ENABLED` is not set, the app renders normally.

### Metro config

```js
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

module.exports = withStorybook(finalConfig, {
  enabled: process.env.STORYBOOK_ENABLED === 'true',
  liteMode: true,
  websockets: 'auto',
});
```

### Build commands

Both env vars must be set for the release build so the Babel plugin inlines them into the JS bundle:

```bash
# Android APK
# Gradle's assembleRelease bundles JS into the APK via Metro, so it runs offline.
# The default config signs with the debug keystore, which is fine for Chromatic.
cross-env STORYBOOK_ENABLED=true CHROMATIC=true \
  sh -c 'cd android && ./gradlew assembleRelease && cd .. && \
  mkdir -p storybook-static && \
  cp android/app/build/outputs/apk/release/app-release.apk storybook-static/storybook.apk'

# iOS .app (simulator, unsigned)
# Building with -sdk iphonesimulator produces an unsigned .app — no Apple Developer
# certificate needed. This is the format Chromatic expects.
cross-env STORYBOOK_ENABLED=true CHROMATIC=true \
  sh -c 'xcodebuild -workspace ios/YourApp.xcworkspace \
  -scheme YourApp -configuration Release \
  -sdk iphonesimulator -derivedDataPath ios/build && \
  mkdir -p storybook-static && \
  cp -r ios/build/Build/Products/Release-iphonesimulator/YourApp.app storybook-static/storybook.app'

# Generate manifest
npx chromatic generate-manifest -o storybook-static
```

---

## Quick Reference: `package.json` scripts

```json
{
  "scripts": {
    "storybook": "cross-env STORYBOOK_ENABLED=true react-native start",
    "build:storybook:android": "cross-env STORYBOOK_ENABLED=true CHROMATIC=true sh -c '...'",
    "build:storybook:ios": "cross-env STORYBOOK_ENABLED=true CHROMATIC=true sh -c '...'",
    "build:storybook:manifest": "npx chromatic generate-manifest -o storybook-static",
    "chromatic:setup": "yarn build:storybook:android && yarn build:storybook:manifest"
  }
}
```

- `yarn storybook` — runs Storybook in dev (no Chromatic options, addons enabled, on-device UI shown)
- `yarn chromatic:setup` — builds a Chromatic-ready APK + manifest (Chromatic options active, no addons, no on-device UI)
