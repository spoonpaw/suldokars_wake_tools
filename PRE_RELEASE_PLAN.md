# Pre-Release Plan

This checklist is for turning the current updater-test builds into a clean first
public release of Suldokar's Wake Tools.

## Goal

Ship one polished public release with accurate docs, clean version history,
working installers, mobile store submissions, and no stale promises from
earlier app scope.

Current public GitHub releases:

- `v0.0.1` — updater/build testing
- `v0.0.2` — updater/build testing, currently marked latest

## Version Strategy

Recommended path:

- Treat `v0.0.1` and `v0.0.2` as private test releases.
- Delete those GitHub releases and their tags after the final release commit is
  ready.
- Publish the first public release as `v0.1.0`.

Why `v0.1.0`:

- It is still clearly pre-1.0 software.
- It is greater than the updater-test versions, so any stray `0.0.x` installs
  can still update forward.
- After deleting the old GitHub releases/tags, the release page will show only
  the first public release.

Literal fresh-start alternative:

- Delete `v0.0.1` and `v0.0.2`.
- Reset all app/package versions to `0.0.1`.
- Recreate `v0.0.1` from the final release commit.

Caveat: existing test installs at `0.0.2` will not auto-update down to `0.0.1`;
they must be manually reinstalled. Use this only if nobody else needs the
updater path from the test builds.

## Phase 1: Public Repo Polish

- [x] Update README so it describes the current character manager.
- [x] Remove dropped feature claims from README.
- [x] Update `CHANGELOG.md` so it no longer lists dropped public features.
- [x] Add a real `LICENSE` file for the MIT app code.
- [x] Update `backend/Cargo.toml` metadata:
  - `authors`
  - `license`
  - `repository`
- [x] Add a short `NOTICE` attribution file.
- [x] Confirm `.tauri/`, `dist/`, build outputs, and signing keys are not
  tracked.
- [ ] Add screenshots or GIFs:
  - character list
  - creation wizard
  - character sheet
  - settings/about page
- [x] Add install notes to README or release notes for macOS, Windows, and
  Linux.
- [x] Add mobile release notes/checklist references for App Store and Google
  Play submission.
- [x] Add `MOBILE_RELEASE.md` for the App Store / Google Play release process.

## Phase 2: App QA

- [x] Run frontend checks:
  ```bash
  cd frontend
  npm run check
  npm run lint
  npm run test
  ```
- [x] Run backend checks:
  ```bash
  cd backend
  cargo check
  ```
- [x] Note current test coverage status: `npm run test` passes, but no test
  files exist yet.
- [x] Build production frontend:
  ```bash
  cd frontend
  npm run build
  ```
- [x] Build desktop bundle:
  ```bash
  ./build.sh
  ```
- [x] Review npm audit output from release builds.
- [x] Apply safe npm audit fixes. Remaining audit output is low-severity
  `cookie <0.7.0` through SvelteKit; npm only offers a breaking force fix that
  would downgrade SvelteKit, so leave it for an upstream SvelteKit update.
- [ ] Smoke-test a fresh install:
  - launch app
  - create an Apt character
  - create a Core character
  - create a Prime character
  - quit and reopen
  - confirm characters persist
  - export one character
  - import exported character
  - delete a character
  - toggle light/dark theme
  - check Settings/About page
- [ ] Smoke-test from release installer assets, not just dev builds.
- [ ] Smoke-test mobile builds:
  - iOS Simulator
  - iOS physical device
  - Android emulator
  - Android physical device
- [ ] Confirm no rules-reference or standalone dice-roller UI is advertised or
  reachable.

## Phase 3: Final Version Bump

Recommended final public version: `0.1.0`.

Update all version fields together:

- [ ] `package.json`
- [ ] `frontend/package.json`
- [ ] `backend/tauri.conf.json`
- [ ] `backend/Cargo.toml`
- [ ] `CHANGELOG.md`

Then commit:

```bash
git add package.json frontend/package.json backend/tauri.conf.json backend/Cargo.toml CHANGELOG.md
git commit -m "Prepare v0.1.0 release"
```

## Phase 4: Clean Up Test Releases

Do this only after the final release commit is ready and pushed.

Delete the test releases and tags:

```bash
gh release delete v0.0.1 --cleanup-tag --yes
gh release delete v0.0.2 --cleanup-tag --yes
git fetch --prune --tags
```

Verify:

```bash
gh release list --limit 10
git tag --sort=v:refname
```

If `gh release delete --cleanup-tag` fails or is unavailable, delete releases in
the GitHub UI, then delete tags manually:

```bash
git push origin :refs/tags/v0.0.1
git push origin :refs/tags/v0.0.2
git tag -d v0.0.1 v0.0.2
```

## Phase 5: Build Release Artifacts

Tag the final release commit:

```bash
git tag v0.1.0
git push origin main --tags
```

Build macOS artifacts:

```bash
./scripts/release-mac.sh
```

Expected macOS output:

- `dist/0.1.0/SuldokarsWakeTools_0.1.0_universal.dmg`
- `dist/0.1.0/SuldokarsWakeTools_0.1.0_universal.app.tar.gz`
- `dist/0.1.0/SuldokarsWakeTools_0.1.0_universal.app.tar.gz.sig`
- `dist/0.1.0/latest.json`

Build/upload Windows and Linux artifacts if they are part of the first public
release. Follow `RELEASING.md` and merge platform entries into `latest.json`.

## Phase 6: Mobile Store Preparation

Mobile releases are store-managed, not updater-managed. Do this after the final
version bump and before public announcement.

- [ ] Confirm mobile app id / bundle id:
  - iOS: `com.netartisancollective.suldokarswaketools`
  - Android: app id from generated Android project
- [x] Local iOS tooling preflight: Xcode is installed.
- [ ] Local Android tooling preflight: Java 17 is installed, but `ANDROID_HOME`
  and `NDK_HOME` must be exported before Android builds can run from this
  shell.
- [ ] Confirm signing credentials:
  - Apple developer team
  - Android keystore / Play App Signing setup
- [ ] Confirm store metadata:
  - app name
  - short description
  - full description
  - category
  - age/content rating
  - support URL
  - privacy policy URL, if required
  - copyright / attribution language
- [ ] Prepare required store screenshots:
  - iPhone sizes required by App Store Connect
  - iPad sizes if shipping iPad
  - Android phone screenshots
  - Android tablet screenshots if shipping tablet layouts
- [ ] Build iOS release archive and upload to App Store Connect.
- [ ] Build Android release bundle (`.aab`) and upload to Google Play Console.
- [ ] Submit both mobile builds for review.
- [ ] Record store review status and any follow-up fixes.

Use `MOBILE_SETUP.md` for local setup notes and `MOBILE_RELEASE.md` for store
submission. Add any App Store / Play Store release lessons back to the docs as
they are discovered.

## Phase 7: Publish GitHub Release

Create the release:

```bash
gh release create v0.1.0 dist/0.1.0/* \
  --title "v0.1.0" \
  --notes-file RELEASE_NOTES_0.1.0.md
```

Release notes should include:

- what Suldokar's Wake Tools is
- supported platforms
- installer guidance
- current scope: character management
- unofficial fan-tool permission/attribution note
- known limitations
- updater behavior

Verify the live release:

```bash
gh release view v0.1.0 --json tagName,name,isDraft,isPrerelease,publishedAt,assets,url
curl -fsSL https://github.com/spoonpaw/suldokars_wake_tools/releases/latest/download/latest.json | jq .
```

## Phase 8: Final Smoke Test

- [ ] Download the release installer from GitHub.
- [ ] Install it as a user would.
- [ ] Launch and repeat the core smoke-test flow.
- [ ] Confirm release assets download successfully.
- [ ] Confirm `latest.json` points to the final release assets.
- [ ] Confirm old test releases are gone from GitHub.
- [ ] Confirm README, changelog, release notes, and license look correct on
  GitHub.
- [ ] Confirm App Store and Google Play submissions are either approved or
  intentionally scheduled.

## Phase 9: Announcement

Before posting:

- [ ] Confirm Christian's permission is represented accurately and respectfully.
- [ ] Include a direct GitHub release link, not just the repo root.
- [ ] Say what the app does now.
- [ ] Avoid promising future features.
- [ ] Mention that users need the published game.
- [ ] Include mobile store links if approved.
- [ ] Invite bug reports through GitHub Issues.

Suggested short announcement:

> Suldokar's Wake Tools is now available as an unofficial fan-made character
> management app for Suldokar's Wake, released with Christian Mehrstam's kind
> permission. It supports character creation, editing, advancement tracking,
> equipment, harm, import/export, and offline storage. You still need the
> published game to use it.
