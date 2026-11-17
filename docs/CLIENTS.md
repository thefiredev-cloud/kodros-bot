# Desktop and iOS apps

Both clients use the same API as the web app. Leave `pnpm dev` running first.

## Desktop app (Electron)

The Electron shell loads the same web UI. Leave `pnpm dev` running, then:

```bash
pnpm --filter @meshbot/desktop dev
```

Native red / yellow / green buttons close, minimize, and zoom that window. They do nothing in the browser tab. On first launch the desktop app asks whether bots should keep using Docker or run on this Mac as you. Docker stays the default. macOS shows no permission prompt for that choice; the consent is Kodros's.

Development defaults to `http://127.0.0.1:5173`. A packaged build has no default and asks for your server's address on first launch (HTTPS, except for loopback addresses), then remembers it. Use **Kodros → Change Server…** to change it. `MESHBOT_WEB_URL` is the explicit startup override.

### Desktop Bot Mode

Hermes Bot Mode is bundled in the Electron app (from [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) `apps/desktop/src/plugins/hermes-bots`). It is a local roster of named bots with one canonical Bot Chat each. No Hermes API key is invented or required.

With `pnpm --filter @meshbot/desktop dev` running:

1. Choose **Kodros → Bot Mode** (or **Open Bot Mode** on the connection screen).
2. Create an agent (`researcher`, `ops`, …) or open the default Hermes row.
3. Click a bot to pin and open its forever Bot Chat. **Sessions** lists that bot's stored conversations.
4. **Open Kodros** returns to the connected Kodros application (model + application + compute).

Roster state is stored in the desktop user-data directory (`bot-mode.json`, mode `0600`). The Expo/iOS client is unchanged.

Packaged installers (optional, unsigned):

```bash
pnpm --filter @meshbot/desktop pack:linux   # AppImage and .deb
pnpm --filter @meshbot/desktop pack:mac     # dmg and zip, unsigned
pnpm --filter @meshbot/desktop pack:win     # NSIS installer, unsigned
```

Outputs land in `apps/desktop/out/` (app id `ai.meshvault.desktop`, publisher Tanner Osterkamp, no auto-update channel). The `ci` workflow builds the same unsigned artifacts on Ubuntu, macOS and Windows runners for every push and pull request and keeps them for 14 days. Those builds still need a running API and web origin.
The public Mac download must be signed with a Developer ID Application certificate and notarized by Apple, and the Windows installer needs a code-signing certificate; an unsigned package is only a smoke-test artifact.

For a direct-download macOS release, provide the Developer ID Application certificate and App Store Connect API notarization inputs to electron-builder, then run the release-only command:

```bash
export CSC_LINK='<certificate file, URL, or base64 data>'
export CSC_KEY_PASSWORD='<certificate password>'
export APPLE_API_KEY='<absolute path to AuthKey_*.p8>'
export APPLE_API_KEY_ID='<App Store Connect key id>'
export APPLE_API_ISSUER='<App Store Connect issuer id>'
pnpm --filter @meshbot/desktop release:mac
```

The preflight names every missing field before TypeScript compilation or packaging. It does not print credential values. The release config writes only to `apps/desktop/out/release/`, requires a valid signing identity, enables hardened runtime, and uses electron-builder's built-in notarization. Ordinary unsigned `pack` builds stay in `apps/desktop/out/` and cannot be mistaken for release output. Verify the produced app and disk image before publishing either artifact:

```bash
MESH_RELEASE_DIR="apps/desktop/out/release"
MESH_APP="$(find "$MESH_RELEASE_DIR" -maxdepth 2 -type d -name 'Kodros.app' -print -quit)"
test -n "$MESH_APP"
codesign --verify --deep --strict --verbose=2 "$MESH_APP"
codesign -dvv "$MESH_APP" 2>&1 | grep -F 'Authority=Developer ID Application:'
xcrun stapler validate "$MESH_APP"
MESH_DMG="$(find "$MESH_RELEASE_DIR" -maxdepth 1 -type f -name '*.dmg' -print -quit)"
test -n "$MESH_DMG"
hdiutil verify "$MESH_DMG"
```

## iOS app (Expo)

Mobile is the existing Expo app (`apps/mobile`). Leave `pnpm dev` running, then:

```bash
pnpm --filter @meshbot/mobile start
```

Point the app at your API origin (`EXPO_PUBLIC_API_URL`, or **Use a custom server** on the sign-in screen).

Before a production iPhone build, supply the exact Apple and Expo identity assigned to this app:

```bash
export MESHBOT_IOS_BUNDLE_IDENTIFIER='<assigned bundle id>'
export MESHBOT_IOS_BUILD_NUMBER='<next build number>'
export MESHBOT_EXPO_OWNER='<Expo account>'
export MESHBOT_EXPO_PROJECT_ID='<EAS project id>'
pnpm --filter @meshbot/mobile release:ios:check
cd apps/mobile && eas build --platform ios --profile production
```

The same variables feed the `production` profile in `apps/mobile/eas.json` from the shell or Expo's production environment. Development does not require them. The preflight exits before EAS or Xcode when any value is missing.

