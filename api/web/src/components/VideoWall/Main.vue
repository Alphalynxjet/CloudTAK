<template>
    <div class='video-wall-root'>
        <!-- Header -->
        <div class='wall-header'>
            <button class='back-btn' title='Back to CloudTAK' @click='goBack'>
                <IconArrowLeft :size='18' stroke='1.5' />
                <span>CloudTAK</span>
            </button>
            <div class='wall-header-divider' />
            <IconDeviceTv :size='22' stroke='1' />
            <span class='wall-title'>Video Wall</span>
            <span v-if='liveCount' class='live-badge'>{{ liveCount }} LIVE</span>
            <div class='wall-header-right'>
                <span class='stream-count'>{{ streams.length }} stream{{ streams.length !== 1 ? 's' : '' }}</span>
                <button class='refresh-btn' title='Refresh' @click='load'>
                    <IconRefresh :size='18' stroke='1.5' />
                </button>
            </div>
        </div>

        <!-- Grid -->
        <div class='wall-body'>
            <TablerLoading v-if='loading' label='Loading streams…' />
            <div v-else-if='loadError' class='wall-empty'>
                <div class='wall-empty-label' style='color:#fc8181'>Failed to load streams</div>
                <div class='wall-empty-sub' style='color:#fc8181; max-width:500px; text-align:center;'>{{ loadError }}</div>
                <button class='wall-empty-btn' @click='load'>Retry</button>
            </div>
            <div v-else-if='streams.length === 0' class='wall-empty'>
                <IconDeviceTv :size='56' stroke='0.75' class='wall-empty-icon' />
                <div class='wall-empty-label'>No streams configured</div>
                <div class='wall-empty-sub'>Open CloudTAK → Videos → Leases to set up a video stream</div>
                <button class='wall-empty-btn' @click='goBack'>Open CloudTAK</button>
            </div>
            <div v-else class='wall-grid' :style='gridStyle'>
                <div
                    v-for='s in streams'
                    :key='s.lease.id'
                    class='wall-cell'
                    :class='{ "cell-live": s.live }'
                >
                    <!-- Live player -->
                    <template v-if='s.live && s.hlsUrl'>
                        <VideoWallPlayer
                            :key='`player-${s.lease.id}`'
                            :hls-url='s.hlsUrl'
                            :stream-id='String(s.lease.id)'
                        />
                    </template>

                    <!-- Offline placeholder -->
                    <template v-else>
                        <div class='cell-offline'>
                            <IconVideoOff :size='36' stroke='0.75' class='cell-offline-icon' />
                            <div class='cell-offline-label'>{{ s.lease.name || 'Unnamed' }}</div>
                            <div class='cell-offline-sub'>Offline</div>
                        </div>
                    </template>

                    <!-- Overlay badges -->
                    <div class='cell-badges'>
                        <span v-if='s.live' class='badge-live'>● LIVE</span>
                        <span v-else class='badge-offline'>OFFLINE</span>
                    </div>
                    <div class='cell-footer'>
                        <span class='cell-name'>{{ s.lease.name || s.lease.path }}</span>
                        <span v-if='s.live && s.readers !== undefined' class='cell-viewers'>
                            <IconUsersGroup :size='12' stroke='1.5' />
                            {{ s.readers }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted, defineComponent, h, nextTick } from 'vue';
import { std } from '../../std.ts';

const emit = defineEmits(['close']);

import type { VideoLease, VideoLeaseMetadata } from '../../types.ts';
import { TablerLoading } from '@tak-ps/vue-tabler';
import { IconDeviceTv, IconRefresh, IconUsersGroup, IconVideoOff, IconArrowLeft } from '@tabler/icons-vue';
import Hls from 'hls.js';

type Stream = {
    lease: VideoLease;
    live: boolean;
    readers: number;
    hlsUrl: string | null;
};

// ─── Inline HLS player ────────────────────────────────────────────────────────

const VideoWallPlayer = defineComponent({
    name: 'VideoWallPlayer',
    props: {
        hlsUrl: { type: String, required: true },
        streamId: { type: String, required: true },
    },
    setup(props) {
        const videoEl = ref<HTMLVideoElement | null>(null);
        let player: Hls | null = null;

        function destroy() {
            if (player) { player.destroy(); player = null; }
        }

        function init() {
            if (!videoEl.value || !Hls.isSupported()) return;
            destroy();
            const rawUrl = props.hlsUrl.replace(/\{\{mode\}\}/g, 'read');
            const url = new URL(rawUrl);
            const hls = new Hls({
                enableWorker: false, lowLatencyMode: false, debug: false,
                backBufferLength: 30, maxBufferLength: 10,
                xhrSetup(xhr) {
                    if (url.username && url.password)
                        xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${url.username}:${url.password}`));
                },
            });
            player = hls;
            hls.attachMedia(videoEl.value);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(url.toString()));
            hls.on(Hls.Events.MANIFEST_PARSED, () => videoEl.value?.play().catch(() => {}));
            hls.on(Hls.Events.ERROR, (_e, d) => {
                if (!d.fatal) { hls.startLoad(); return; }
                try { hls.recoverMediaError(); } catch { destroy(); }
            });
        }

        onMounted(async () => { await nextTick(); init(); });
        onUnmounted(() => destroy());

        return () => h('div', { class: 'player-wrap' },
            [h('video', { ref: videoEl, class: 'player-video', controls: true, autoplay: true, muted: true, playsinline: true })]
        );
    },
});

// ─── Page state ───────────────────────────────────────────────────────────────

const loading = ref(true);
const loadError = ref('');
const streams = ref<Stream[]>([]);
let timer: number | undefined;

const liveCount = computed(() => streams.value.filter(s => s.live).length);

const gridStyle = computed(() => {
    const n = streams.value.length;
    const cols = n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : n === 4 ? 2 : n <= 6 ? 3 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    return {
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
    };
});

onMounted(async () => { await load(); timer = window.setInterval(refresh, 30_000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

async function load() {
    loading.value = true;
    loadError.value = '';
    try {
        const wallData = await std('/api/video/wall') as {
            paths: { name: string; ready: boolean; readers: number }[];
            leases: VideoLease[];
        };

        const activePaths = (wallData.paths ?? []).filter(p => p.ready);
        const readerMap = new Map<string, number>(activePaths.map(p => [p.name, p.readers]));

        const leaseByPath = new Map<string, VideoLease>();
        for (const l of (wallData.leases ?? [])) leaseByPath.set(l.path, l);

        const result: Stream[] = [];

        // Active streams: use mediamtx paths as source of truth
        for (const p of activePaths) {
            const lease = leaseByPath.get(p.name);
            let hlsUrl: string | null = null;
            try {
                if (lease) {
                    const meta = await std(`/api/video/lease/${lease.id}/metadata`) as VideoLeaseMetadata;
                    hlsUrl = meta?.protocols?.hls?.url?.replace(/\{\{mode\}\}/g, 'read') ?? null;
                } else {
                    const r = await std(`/api/video/path/${p.name}/hls`) as { url: string };
                    hlsUrl = r.url;
                }
            } catch { /* stream metadata unavailable */ }
            result.push({
                lease: lease ?? { id: 0, path: p.name, name: p.name } as VideoLease,
                live: true,
                readers: readerMap.get(p.name) ?? 0,
                hlsUrl
            });
        }

        // Offline leases (not currently in active paths)
        const activePathNames = new Set(activePaths.map(p => p.name));
        for (const lease of (wallData.leases ?? [])) {
            if (!activePathNames.has(lease.path)) {
                result.push({ lease, live: false, readers: 0, hlsUrl: null });
            }
        }

        streams.value = result;
    } catch (err) {
        loadError.value = err instanceof Error ? err.message : String(err);
        console.error('VideoWall load error:', err);
    } finally {
        loading.value = false;
    }
}

function goBack() { emit('close'); }

async function refresh() {
    try {
        const wallData = await std('/api/video/wall') as { paths: { name: string; ready: boolean; readers: number }[]; leases: VideoLease[] };
        const readySet = new Set((wallData.paths ?? []).filter(p => p.ready).map(p => p.name));
        const readerMap = new Map<string, number>((wallData.paths ?? []).filter(p => p.ready).map(p => [p.name, p.readers]));
        streams.value = streams.value.map(s => ({
            ...s,
            live: readySet.has(s.lease.path),
            readers: readerMap.get(s.lease.path) ?? s.readers,
        }));
    } catch { /* ignore */ }
}
</script>

<style scoped>
.video-wall-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #0d0d0d;
    color: #fff;
    font-family: system-ui, sans-serif;
}

/* Back button */
.back-btn {
    display: flex; align-items: center; gap: 6px;
    background: none; border: none; color: rgba(255,255,255,0.55);
    cursor: pointer; font-size: 0.82rem; padding: 4px 8px;
    border-radius: 5px; transition: color 0.15s, background 0.15s;
    white-space: nowrap;
}
.back-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.wall-header-divider {
    width: 1px; height: 18px; background: rgba(255,255,255,0.12); flex-shrink: 0;
}

/* Header */
.wall-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    flex-shrink: 0;
}
.wall-title { font-size: 1.1rem; font-weight: 600; }
.live-badge {
    background: #25a244;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    letter-spacing: 0.05em;
}
.wall-header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.stream-count { font-size: 0.8rem; color: rgba(255,255,255,0.45); }
.refresh-btn {
    background: none; border: none; color: rgba(255,255,255,0.5);
    cursor: pointer; padding: 4px; display: flex; align-items: center;
    border-radius: 4px; transition: color 0.15s;
}
.refresh-btn:hover { color: #fff; }

/* Body */

/* Empty state */
.wall-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 12px; color: rgba(255,255,255,0.3);
}
.wall-empty-icon { opacity: 0.3; }
.wall-empty-label { font-size: 1.1rem; font-weight: 500; }
.wall-empty-sub { font-size: 0.85rem; }
.wall-empty-btn {
    margin-top: 8px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.7);
    font-size: 0.82rem;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}
.wall-empty-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }

/* Body */
.wall-body { flex: 1; overflow: hidden; padding: 12px; display: flex; flex-direction: column; }

/* Grid */
.wall-grid {
    display: grid;
    gap: 10px;
    flex: 1;
    min-height: 0;
}

/* Cell */
.wall-cell {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1a;
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.2s;
    min-height: 0;
    min-width: 0;
}
.wall-cell.cell-live { border-color: rgba(37, 162, 68, 0.4); }

/* Offline placeholder */
.cell-offline {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #141414;
}
.cell-offline-icon { opacity: 0.2; }
.cell-offline-label { font-size: 0.9rem; font-weight: 500; color: rgba(255,255,255,0.5); }
.cell-offline-sub { font-size: 0.75rem; color: rgba(255,255,255,0.25); }

/* Badges */
.cell-badges {
    position: absolute;
    top: 8px;
    left: 8px;
}
.badge-live {
    background: #e53e3e;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 3px;
    letter-spacing: 0.06em;
}
.badge-offline {
    background: rgba(0,0,0,0.5);
    color: rgba(255,255,255,0.35);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 3px;
    letter-spacing: 0.06em;
}

/* Footer */
.cell-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 5px 10px;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
    display: flex;
    align-items: center;
    gap: 6px;
}
.cell-name {
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}
.cell-viewers {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.7rem;
    color: rgba(255,255,255,0.6);
    flex-shrink: 0;
}

/* Player */
.player-wrap { position: absolute; inset: 0; }
.player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: #000; }
.player-buffering {
    position: absolute; bottom: 8px; right: 8px;
    background: rgba(0,0,0,0.55);
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 0.7rem;
    color: rgba(255,255,255,0.8);
    pointer-events: none;
}
</style>
