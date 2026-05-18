# Mobile Release Checklist

This document tracks the App Store and Google Play work for the first public
mobile release of Suldokar's Wake Tools. Mobile releases are store-managed; they
do not use the GitHub/Tauri desktop updater.

## Shared App Details

- App name: `Suldokar's Wake Tools`
- Bundle/app identifier: `com.netartisancollective.suldokarswaketools`
- First public version target: `0.1.0`
- Copyright/attribution:
  - App code © Alexander Saint Clair Bardelmeier
  - Suldokar's Wake © Christian Mehrstam
  - Unofficial fan tool released with permission
- Support URL: GitHub repository or issue tracker
- Privacy policy: required before store submission if the stores request one

## Store Metadata

Prepare the following once, then reuse/adapt between stores:

- Short description
- Full description
- Keywords/search terms
- Category
- Age/content rating answers
- Support URL
- Privacy policy URL
- Copyright holder
- Attribution/permission text
- Release notes for `0.1.0`

Suggested short description:

> Offline character management for Suldokar's Wake.

Suggested full-description spine:

> Suldokar's Wake Tools is an unofficial fan-made character management app for
> Suldokar's Wake, released with Christian Mehrstam's kind permission. It helps
> players create, edit, advance, import, export, and maintain characters
> offline. You need the published Suldokar's Wake game to use this app.

## iOS / App Store

Prereqs:

- Apple Developer account is active.
- Team ID matches `backend/tauri.conf.json` `bundle.iOS.developmentTeam`.
- App Store Connect app record exists for
  `com.netartisancollective.suldokarswaketools`.
- App privacy questionnaire is complete.
- Required iPhone screenshots are prepared.
- iPad screenshots are prepared if the app is shipped for iPad.

Build/upload:

```bash
cd backend
cargo tauri ios build
```

Then upload the archive/build through Xcode Organizer or Transporter.

Validation:

- Install through TestFlight.
- Create, save, reopen, export, import, and delete a character.
- Check light/dark theme.
- Check Settings/About attribution.
- Check file import/export behavior in the iOS sandbox.
- Confirm no desktop updater UI appears on mobile.

## Android / Google Play

Prereqs:

- Google Play Console app record exists for
  `com.netartisancollective.suldokarswaketools`.
- `ANDROID_HOME` and `NDK_HOME` are exported in the build shell.
- Play App Signing is configured.
- Android release keystore is available or Play-managed signing is confirmed.
- Required phone screenshots are prepared.
- Tablet screenshots are prepared if tablet layouts are listed.
- Data safety form is complete.

Build/upload:

```bash
cd backend
cargo tauri android build --aab
```

Upload the `.aab` to Google Play Console.

Validation:

- Install through internal testing.
- Create, save, reopen, export, import, and delete a character.
- Check light/dark theme.
- Check Settings/About attribution.
- Check Android file picker/storage behavior.
- Confirm no desktop updater UI appears on mobile.

## Final Gate

- [ ] iOS build uploaded to App Store Connect.
- [ ] iOS TestFlight smoke test passed.
- [ ] iOS app submitted for review.
- [ ] Android `.aab` uploaded to Google Play Console.
- [ ] Android internal testing smoke test passed.
- [ ] Android app submitted for review.
- [ ] Store approval status is recorded in `PRE_RELEASE_PLAN.md`.
