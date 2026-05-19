# Mobile Release Checklist

App Store and Google Play work for the first public mobile release of
Suldokar's Wake Tools. Mobile releases are store-managed; they do not use the
GitHub/Tauri desktop updater.

## Shared App Details

- App name: `Suldokar's Wake Tools`
- Bundle/app identifier: `com.netartisancollective.suldokarswaketools`
- First public version target: `1.0.0`
- Copyright/attribution:
  - App code © Alexander Saint Clair Bardelmeier
  - Suldokar's Wake © Christian Mehrstam
  - Unofficial fan tool released with permission
- Support URL: GitHub repository or issue tracker
- Privacy policy URL: required by both stores

## Store Metadata

Prepare once, reuse between stores:

- Short description
- Full description
- Keywords / search terms
- Category
- Age / content rating answers
- Support URL
- Privacy policy URL
- Copyright holder
- Attribution / permission text
- Release notes for `1.0.0` (mirror the entries from `CHANGELOG.md`)

Suggested short description:

> Offline character management for Suldokar's Wake.

Suggested full-description spine:

> Suldokar's Wake Tools is an unofficial fan-made character management app for
> Suldokar's Wake, released with Christian Mehrstam's kind permission. It helps
> players create, edit, advance, import, export, and maintain characters
> offline. You need the published Suldokar's Wake game to use this app.

## iOS / App Store

Prereqs:

- Apple Developer account active.
- Team ID matches `backend/tauri.conf.json` `bundle.iOS.developmentTeam`.
- App Store Connect app record exists for
  `com.netartisancollective.suldokarswaketools`.
- App privacy questionnaire complete on App Store Connect (declares 0
  data collected, 0 tracking — matches the in-bundle `PrivacyInfo.xcprivacy`).
- Required-reason API privacy manifest IS present at
  `backend/gen/apple/sw-tools-backend_iOS/PrivacyInfo.xcprivacy` and the
  Xcode project bundles it as a resource. Canonical copy + pbxproj patch
  notes live in `backend/ios-extras/`. If `gen/` is ever regenerated
  (`cargo tauri ios init --regenerate`), restore from there before
  building for upload.
- 6.9" iPhone (iPhone 16 Pro Max) screenshots in
  `screenshots/ios/iphone-16-pro-max/` (App Store accepts these at the
  iOS-26 1320 × 2868 resolution as well as the older 1290 × 2796).
- iPad screenshots if the app ships for iPad.

Build / upload:

```bash
cd backend
cargo tauri ios build
```

Then upload the archive through Xcode Organizer or Transporter.

Validation:

- Install through TestFlight.
- Create, save, reopen, export, import, and delete a character.
- Check light/dark theme.
- Check Settings/About attribution.
- Check file import/export through the iOS Files app sandbox.
- Confirm no desktop updater UI appears on mobile.

## Android / Google Play

Prereqs:

- Google Play Console app record exists for
  `com.netartisancollective.suldokarswaketools`.
- Play App Signing enrolled — Google manages the release key, the
  developer uploads with an upload-key keystore.
- Upload keystore lives OUTSIDE the repo (e.g. `~/keystores/sw-tools-upload.jks`)
  and its credentials are NOT committed.
- `ANDROID_HOME` and `NDK_HOME` exported in the build shell.
- Phone screenshots in `screenshots/android/medium-phone/` (1080 × 2400
  is fine for Play Store phone tier).
- Tablet screenshots if tablet layouts are listed.
- Data Safety form complete (declare 0 data collected, 0 shared — the
  app is fully offline).

Build path (mirrors the established Whitehack Tools flow):

The Tauri-generated `backend/gen/android/app/build.gradle.kts` has NO
`signingConfigs` block — same as `whitehack-tools-kotlin`. Signed AABs are
produced through Android Studio's signed-bundle wizard rather than from
the command line.

```text
1. Open backend/gen/android in Android Studio.
2. Build > Generate Signed Bundle / APK > Android App Bundle.
3. Choose the existing upload keystore + alias.
4. Build variant: release, signing: V1 + V2.
5. Output: app-release.aab in backend/gen/android/app/release/.
```

CLI fallback if Android Studio is unavailable:

```bash
cd backend
cargo tauri android build --aab
# Then sign the unsigned AAB with `jarsigner` + `bundletool` using the
# upload keystore.
```

Pre-upload sanity:

- `aapt dump badging app-release.aab` (or `bundletool dump manifest`)
  should report `versionName='1.0.0'` and `versionCode='1'` (or higher
  than the last submitted code if this isn't the first upload).

Upload the `.aab` to Google Play Console (Internal testing → Production).

Validation:

- Install through internal testing.
- Create, save, reopen, export, import, and delete a character.
- Check light/dark theme.
- Check Settings/About attribution.
- Check Android file-picker / Downloads behavior.
- Confirm no desktop updater UI appears on mobile.

## Final Gate

- [ ] iOS build uploaded to App Store Connect.
- [ ] iOS TestFlight smoke test passed.
- [ ] iOS app submitted for review.
- [ ] Android `.aab` uploaded to Google Play Console.
- [ ] Android internal testing smoke test passed.
- [ ] Android app submitted for review.
- [ ] Store approval status recorded in `PRE_RELEASE_PLAN.md`.
