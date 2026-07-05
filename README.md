## Upstream sync status

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
  returned.

### Frontend (api/web/)

- `api/web/src/components/VideoWall/Main.vue` — Video wall reworked as a
  **fullscreen overlay inside the main app** (upstream has a standalone
  `/video` page): 1/2/3/4-column grid, shows all leases live/offline, HLS.js
  playback with lease credentials, buffering badge, Firefox layout fixes.
- `api/web/src/components/CloudTAK/Menu/Videos/VideoRecordingsPage.vue` *(new)* —
  Recordings browser: search/sort, collapsible per-lease groups, file sizes,
  storage totals, admin-only delete.
- `api/web/src/components/CloudTAK/Menu/Videos/VideoRecordingsModal.vue` *(new)* —
  Recording playback/download modal.
- `api/web/src/components/CloudTAK/Menu/MenuVideos.vue` — Video wall button and
  recordings entry in the Videos menu.
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
  database.
- `.dockerignore` *(new)* — keeps local data dirs (recordings, postgis, store)
  and `node_modules` out of the Docker build context.
- `api/package.json`, `api/web/package.json` — custom version scheme.
