# iOS extras (tracked source of truth)

The files in this directory are the canonical copies of patches that
need to live inside the gitignored `backend/gen/apple/` Tauri-generated
project. If `gen/` is ever wiped (e.g. by `cargo tauri ios init
--regenerate`), restore from here:

| Source                       | Destination                                                          |
|------------------------------|----------------------------------------------------------------------|
| `PrivacyInfo.xcprivacy`      | `backend/gen/apple/sw-tools-backend_iOS/PrivacyInfo.xcprivacy`       |

In addition, the following pbxproj edits must be re-applied to
`backend/gen/apple/sw-tools-backend.xcodeproj/project.pbxproj`:

1. PBXBuildFile: add the resource entry referencing PrivacyInfo.xcprivacy.
2. PBXFileReference: register the file (lastKnownFileType = text.xml).
3. PBXGroup (sw-tools-backend_iOS group): add the file ref.
4. PBXResourcesBuildPhase: add the resource entry to the Resources files array.

See git history for the exact UUID layout last used.

The `Info.plist` in `gen/` also carries hand-edited keys
(`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`,
`CFBundleShortVersionString` 1.0.0) — those are regenerated from
`backend/tauri.conf.json` + the source plist values on iOS builds, so
they normally do not need recovery, but verify before App Store upload.
