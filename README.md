## About this fork

This is a fork of [dfpc-coe/CloudTAK](https://github.com/dfpc-coe/CloudTAK)
maintained for **our own server deployment** — it is not a general-purpose
distribution, and changes here are tailored to our environment.

**Versioning:** this fork uses its own version scheme in
`api/package.json` / `api/web/package.json` instead of upstream's semver.

### Upstream sync status

| | |
|---|---|
| **Last synced with upstream** | 2026-07-05 |
| **Upstream commit at sync** | `f4d19bf29` (v13.32.0, 2026-07-04) |
| **Version after sync** | `TG.002.0` (upstream base 13.32.0) |

To pull in new upstream changes:

```bash
git fetch upstream            # upstream = https://github.com/dfpc-coe/CloudTAK
git merge upstream/main
```

Conflicts will almost always be in the files listed below — resolve keeping the
custom feature set, then **update the sync date and commit in the table above**.

## Changes vs upstream

Everything custom here is part of the **video recordings & video wall
feature set**, plus a few operational tweaks. Modified/added files:

### Backend (api/)

- `api/lib/control/video-service.ts` — Recording storage support: `/recordings`
  helpers (`recordingFilePath`, `streamRecordingSegment`, `segmentFileSize`,
  `hlsUrlForPath`), prefix-scan fallback for segment file sizes.
  **Security:** video lease credentials are random hex via `crypto.randomBytes`
  (upstream uses guessable `read<id>`/`write<id>` usernames and weak
  `Math.random` passwords). Also fixes upstream's `segmenets` typo in the
  `Recording` schema (`segments`, with a default).
- `api/routes/video-lease.ts` — Recordings API: `GET /video/recordings` (all
  recordings across leases with lease metadata), path-based segment
  download/delete/playback including orphaned recordings found on disk,
  access control (owner / shared / admin), recordings directory deleted from
  disk when a lease is deleted. Fix: metadata endpoint passes
  `ProtocolPopulation.READ` so real (not placeholder) read credentials are
  returned. Also: `GET /video/entitlement` (current user's lease limits) and
  entitlement enforcement on lease create/update. `GET /video/wall` applies
  the same visibility rule as the lease list (admins see everything, users see
  own + channel-shared leases; active paths filtered to match). Non-admin max
  lease duration raised from 24 hours to 30 days.
- `api/lib/entitlement.ts` *(new)* — Optional external entitlement API client:
  when `ENTITLEMENT_API_URL` + `ENTITLEMENT_API_TOKEN` are set, video-lease
  creation is limited (max lease count per account) and stream recording can
  be disallowed, per the policy returned by the API. Cached with
  stale-on-error fallback; system admins and self-hosted installs (vars
  unset) are unaffected.
- `api/routes/connection-video-lease.ts` — same entitlement enforcement and
  30-day non-admin duration cap for connection-owned leases.

### Frontend (api/web/)

- `api/web/src/components/VideoWall/Main.vue` — Video wall reworked as a
  **fullscreen overlay inside the main app** (upstream has a standalone
  `/video` page): shows the caller's visible leases live/offline (online
  streams sorted first, re-sorted as the 30 s poll flips state; new streams
  trigger a rebuild and newly-live streams fetch their HLS URL), HLS.js
  playback with lease credentials plus a native-HLS fallback for pre-17.1 iOS
  Safari (credentials via mediamtx query params), Auto/1/2/3/4-column layout
  switcher persisted in localStorage (manual counts scroll vertically with
  16:9 cells), single scrollable column + slimmed header + safe-area insets
  on phones, parallel metadata fetches, overlays no longer block native video
  controls, Firefox layout fixes.
- `api/web/src/components/CloudTAK/Menu/Videos/VideoRecordingsPage.vue` *(new)* —
  Recordings browser: search/sort, collapsible per-lease groups, file sizes,
  storage totals, admin-only delete.
- `api/web/src/components/CloudTAK/Menu/Videos/VideoRecordingsModal.vue` *(new)* —
  Recording playback/download modal.
- `api/web/src/components/CloudTAK/Menu/MenuVideos.vue` — Video wall button and
  recordings entry in the Videos menu; lease-usage indicator ("N of M plan
  leases used"); recordings entry shows a "Recording Not Available" upsell
  overlay (message text supplied by the entitlement API) when the plan
  disallows recording.
- `api/web/src/components/CloudTAK/Menu/Videos/VideoLeaseModal.vue` — Record
  Stream toggle shows the same upsell overlay when recording is not entitled
  (toggle snaps back off). Lease duration is a unit + value control
  (Hours/Days, digits-only input; Permanent offered to system admins only)
  instead of fixed hour presets.
- `api/web/src/components/CloudTAK/util/FloatingVideo.vue` — Debounced buffering
  overlay, reduced HLS buffer for live streams.
- `api/web/src/App.vue` — Polls `/api/video/paths` every 30s for the sidebar
  active-video badge; the "new version available" banner is hidden (upgrades
  are managed centrally).
- `api/web/src/stores/modules/menu.ts` — `activeVideoCount` badge on the Videos
  menu item.
- `api/web/src/components/CloudTAK/MainMenuContents.vue` — App-switcher dropdown
  removed (its "Video Wall" link pointed at the deleted `/video` page).
- `api/web/video.html`, `api/web/src/pages/video/main.ts` *(deleted)* — the
  standalone `/video` page is replaced by the in-app overlay.
- `api/web/vite.config.ts` — Removed the `video` build entry; dev proxy target
  overridable via `CLOUDTAK_API_TARGET`.

### Operational

- `docker-compose.yml` — Persistent bind mounts: `.docker-media-recordings` →
  `/recordings` (api + media containers) and `.docker-postgis` for the
  database. `ENTITLEMENT_API_URL` / `ENTITLEMENT_API_TOKEN` passed to the api
  container (empty by default).
- `.dockerignore` *(new)* — keeps local data dirs (recordings, postgis, store)
  and `node_modules` out of the Docker build context.
- `api/package.json`, `api/web/package.json` — custom version scheme.
