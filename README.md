This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

>**Note**: Make sure you have completed the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) instructions till "Creating a new application" step, before proceeding.

## Step 1: Start the Metro Server

First, you will need to start **Metro**, the JavaScript _bundler_ that ships _with_ React Native.

To start Metro, run the following command from the _root_ of your React Native project:

```bash
# using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Start your Application

Let Metro Bundler run in its _own_ terminal. Open a _new_ terminal from the _root_ of your React Native project. Run the following command to start your _Android_ or _iOS_ app:

### For Android

```bash
# using npm
npm run android

# OR using Yarn
yarn android
```

### For iOS

```bash
# using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up _correctly_, you should see your new app running in your _Android Emulator_ or _iOS Simulator_ shortly provided you have set up your emulator/simulator correctly.

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

## Step 3: Modifying your App

Now that you have successfully run the app, let's modify it.

1. Open `App.tsx` in your text editor of choice and edit some lines.
2. For **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Developer Menu** (<kbd>Ctrl</kbd> + <kbd>M</kbd> (on Window and Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (on macOS)) to see your changes!

   For **iOS**: Hit <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in your iOS Simulator to reload the app and see your changes!

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [Introduction to React Native](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you can't get this to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

# Supabase Backend Artifacts

This repo now includes local Supabase artifacts under `supabase/` for the app-side endpoints already used by the client:

- `supabase/migrations/20260405130000_create_sauti_auth_and_subscriptions.sql`
- `supabase/migrations/20260406113000_create_otp_verification_requests.sql`
- `supabase/functions/register-matrix-user/`
- `supabase/functions/request-otp/`
- `supabase/functions/subscription-status/`
- `supabase/functions/verify-otp/`

## Provider Sync Path

The intended subscription sync path is:

1. Stripe / YooMoney / CloudPayments webhook arrives at a service-role endpoint.
2. The raw provider payload is inserted into `public.subscription_provider_events`.
3. A service-role worker validates and normalizes the event into `public.user_subscriptions`.
4. The `subscription-status` edge function reads `public.user_subscriptions` by `matrix_user_id`.
5. The React Native client caches that response in SecureStore with TTL.

`request-otp`, `verify-otp`, and `register-matrix-user` are structured the same way: provider calls, persistence, and Matrix provisioning are separate dependencies so the production OTP vendor and Matrix admin integration can be wired without changing the app contract.

## Edge Function Runtime Env

The Deno edge functions now expect:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

For `register-matrix-user`, production provisioning also expects:

- `MATRIX_PROVISIONING_API_URL`
- `MATRIX_PROVISIONING_API_TOKEN` (optional, but recommended)

For local OTP smoke testing before a real provider is wired, you can also set:

- `SAUTI_TEST_OTP_CODE`

When `SAUTI_TEST_OTP_CODE` is present, `request-otp` and `verify-otp` run in test mode and accept that exact code.

`MATRIX_PROVISIONING_API_URL` should point to a trusted backend endpoint that creates the Matrix account and returns JSON shaped like:

```json
{
   "userId": "@kwame:sauti.app",
   "accessToken": "access-token",
   "deviceId": "DEVICE1",
   "refreshToken": "refresh-token",
   "expiresInMs": 86400000
}
```

That endpoint can wrap the real Conduit admin mechanism without changing the app or Supabase handler contract.

# Android VPN Validation

Use one physical Android device for the remaining Phase 1 validation of the VPN fallback path.

## Pre-checks

1. Install a debug build on a physical Android device.
2. Confirm the app launches and the Chats screen renders.
3. Connect `adb logcat` before testing:

```bash
adb logcat | grep -i "Sauti\|VpnService\|ReactNativeJS"
```

## Validation Pass

1. Fresh install, first launch:
   Expect VPN permission to be required before tunnel activation.
2. Deny VPN permission:
   Expect proxy status to move to failed, and the in-app warning card to show that traffic is running unprotected.
3. Tap Retry without granting permission:
   Expect the warning card to remain and diagnostics to continue reporting `permissionRequired=true`.
4. Grant VPN permission and retry:
   Expect proxy status to move from connecting to connected.
5. Trigger a simulated failure path on-device:
   Confirm the warning card appears and direct fallback keeps the chat list usable.
6. Send a message while proxy is connected, then while proxy is failed:
   Confirm the UI remains responsive and status banners match the tunnel state.

## Diagnostics Surface

The Android native bridge now exposes `getDiagnostics()` through `SautiProxyModule`. The payload includes:

- `status`
- `isRunning`
- `permissionRequired`
- `lastError`

Expected checkpoints during validation:

- Permission denied: `status=failed`, `permissionRequired=true`
- Tunnel running: `status=connected`, `isRunning=true`
- Service start failure: `status=failed`, `lastError` populated

This prepares the repo for device execution, but the final checklist items for Android proxy/VPN stay partial until the live-device pass is actually run and recorded.
