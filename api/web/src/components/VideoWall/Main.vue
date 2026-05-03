<template>
    <div class='h-full w-full cloudtak-bg text-white d-flex flex-column'>
        <!-- Header bar -->
        <div class='d-flex align-items-center gap-3 px-4 py-3 border-bottom border-secondary border-opacity-25'>
            <IconVideo
                :size='28'
                stroke='1'
            />
            <span class='fs-5 fw-semibold'>Video Wall</span>

            <div class='ms-auto d-flex align-items-center gap-3'>
                <span
                    v-if='!loading && liveStreams.length'
                    class='badge text-bg-success'
                >
                    {{ liveStreams.length }} Live
                </span>
                <TablerIconButton
                    title='Refresh Streams'
                    @click='refresh'
                >
                    <IconRefresh
                        :size='22'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <!-- Body -->
        <div class='flex-grow-1 overflow-auto p-3'>
            <TablerLoading
                v-if='loading'
                label='Loading Streams'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!liveStreams.length'
                label='No Live Streams'
                :create='false'
            />
            <div
                v-else
                class='video-wall-grid'
                :class='gridClass'
            >
                <div
                    v-for='stream in liveStreams'
                    :key='stream.lease.id'
                    class='video-cell d-flex flex-column rounded overflow-hidden bg-black bg-opacity-50'
                    style='min-height: 0;'
                >
                    <!-- Player area -->
                    <div class='position-relative flex-grow-1' style='min-height: 0;'>
                        <template v-if='stream.loadingMeta'>
                            <div class='d-flex align-items-center justify-content-center h-100'>
                                <TablerLoading label='Loading' />
                            </div>
                        </template>
                        <template v-else-if='stream.metaError'>
                            <div class='d-flex align-items-center justify-content-center h-100 text-center p-2'>
                                <TablerAlert
                                    :compact='true'
                                    title='Stream Error'
                                    :err='stream.metaError'
                                />
                            </div>
                        </template>
                        <template v-else-if='stream.hlsUrl'>
                            <VideoWallPlayer
                                :key='stream.lease.id'
                                :hls-url='stream.hlsUrl'
                                :stream-id='String(stream.lease.id)'
                            />
                        </template>
                        <template v-else>
                            <div class='d-flex align-items-center justify-content-center h-100 text-secondary small'>
                                No HLS protocol available
                            </div>
                        </template>

                        <!-- Live badge overlay -->
                        <span
                            class='position-absolute top-0 start-0 m-2 badge text-bg-danger'
                            style='font-size: 0.65rem; letter-spacing: 0.05em;'
                        >LIVE</span>

                        <!-- Viewer count overlay -->
                        <span
                            v-if='stream.readers !== undefined'
                            class='position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1 badge bg-black bg-opacity-75'
                            style='font-size: 0.65rem;'
                        >
                            <IconUsersGroup
                                :size='14'
                                stroke='1.5'
                            />
                            {{ stream.readers }}
                        </span>
                    </div>

                    <!-- Stream name footer -->
                    <div
                        class='px-2 py-1 d-flex align-items-center gap-2 border-top border-secondary border-opacity-25'
                        style='background: rgba(0,0,0,0.4); min-height: 2rem;'
                    >
                        <IconVideo
                            :size='14'
                            stroke='1.5'
                            class='text-success flex-shrink-0'
                        />
                        <span
                            class='small text-truncate'
                            v-text='stream.lease.name || stream.lease.path'
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted, defineComponent, h, nextTick } from 'vue';
import { std } from '../../std.ts';
import type { VideoLease, VideoLeaseMetadata } from '../../types.ts';
import {
    TablerNone,
    TablerLoading,
    TablerAlert,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconVideo,
    IconRefresh,
    IconUsersGroup,
} from '@tabler/icons-vue';
import Hls from 'hls.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type PathItem = {
    name: string;
    ready: boolean;
    readers: unknown[];
};

type LiveStream = {
    lease: VideoLease;
    readers: number;
    hlsUrl: string | null;
    loadingMeta: boolean;
    metaError: Error | null;
};

// ─── VideoWallPlayer inline component ────────────────────────────────────────
// Isolated HLS player for a single cell; each instance manages its own Hls
// instance independently so one failing stream doesn't affect others.

const VideoWallPlayer = defineComponent({
    name: 'VideoWallPlayer',
    props: {
        hlsUrl: { type: String, required: true },
        streamId: { type: String, required: true },
    },
    setup(props) {
        const videoEl = ref<HTMLVideoElement | null>(null);
        const player = ref<Hls | null>(null);
        const isBuffering = ref(false);

        let retryCount = 0;
        const maxRetries = 3;
        let bufferInterval: number | undefined;
        let recoveryTimeout: number | undefined;

        function clearBufferMonitoring() {
            if (bufferInterval) { clearInterval(bufferInterval); bufferInterval = undefined; }
            if (recoveryTimeout) { clearTimeout(recoveryTimeout); recoveryTimeout = undefined; }
            isBuffering.value = false;
        }

        function monitorBuffer() {
            const v = videoEl.value;
            if (!v || v.buffered.length === 0 || v.ended) return;
            const ahead = v.buffered.end(v.buffered.length - 1) - v.currentTime;
            if (ahead < 2 && !isBuffering.value) {
                isBuffering.value = true;
                recoveryTimeout = window.setTimeout(() => {
                    restartStream();
                }, 10000);
            } else if (ahead > 5 && isBuffering.value) {
                isBuffering.value = false;
                if (recoveryTimeout) { clearTimeout(recoveryTimeout); recoveryTimeout = undefined; }
                if (v.paused && !v.ended) v.play().catch(() => {/* noop */});
            }
        }

        function attachVideoHandlers() {
            const v = videoEl.value;
            if (!v) return;
            v.onwaiting = () => { if (!v.ended) isBuffering.value = true; };
            v.onstalled = () => { if (!v.ended) isBuffering.value = true; };
            v.onplaying = () => { isBuffering.value = false; };
            v.oncanplay = () => { if (isBuffering.value) isBuffering.value = false; };
        }

        function destroyPlayer() {
            clearBufferMonitoring();
            if (player.value) { player.value.destroy(); player.value = null; }
        }

        function restartStream() {
            const hls = player.value;
            if (!hls) return;
            clearBufferMonitoring();
            try {
                hls.recoverMediaError();
                hls.stopLoad();
                hls.loadSource(hls.url!);
                isBuffering.value = true;
                hls.once(Hls.Events.LEVEL_LOADED, () => {
                    const v = hls.media;
                    if (v) {
                        if (Number.isFinite(v.duration) && v.duration > 0) {
                            v.currentTime = v.duration;
                        }
                        hls.startLoad();
                        v.play().catch(() => {/* noop */});
                    }
                    bufferInterval = window.setInterval(monitorBuffer, 500);
                    isBuffering.value = false;
                });
            } catch {
                handleError(new Error('Stream restart failed'));
            }
        }

        function handleError(err: Error) {
            destroyPlayer();
            if (retryCount < maxRetries) {
                const delay = 1000 * Math.pow(2, retryCount);
                retryCount++;
                setTimeout(() => initPlayer(), delay);
            } else {
                console.error(`VideoWall: stream ${props.streamId} exceeded max retries`, err);
            }
        }

        function initPlayer() {
            if (!videoEl.value || !Hls.isSupported()) return;
            destroyPlayer();

            const rawUrl = props.hlsUrl.replace(/\{\{mode\}\}/g, 'read');
            const url = new URL(rawUrl);

            attachVideoHandlers();

            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                debug: false,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10,
                xhrSetup(xhr) {
                    if (url.username && url.password) {
                        xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${url.username}:${url.password}`));
                    }
                },
            });

            player.value = hls;
            hls.attachMedia(videoEl.value);

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(url.toString());
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl.value?.play().catch(() => {/* autoplay blocked */});
                bufferInterval = window.setInterval(monitorBuffer, 500);
            });

            hls.on(Hls.Events.ERROR, (_evt, data) => {
                if (!data.fatal) {
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        hls.startLoad();
                    }
                    return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    try { hls.recoverMediaError(); } catch { handleError(data.error ?? new Error('media error')); }
                } else {
                    handleError(data.error ?? new Error('fatal hls error'));
                }
            });
        }

        onMounted(() => nextTick(() => initPlayer()));
        onUnmounted(() => destroyPlayer());

        return () =>
            h('div', { class: 'position-relative w-100 h-100' }, [
                h('video', {
                    ref: videoEl,
                    class: 'w-100 h-100',
                    style: 'display:block; object-fit:contain;',
                    controls: true,
                    autoplay: true,
                    muted: true,
                    playsinline: true,
                }),
                isBuffering.value
                    ? h('div', {
                        class: 'position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center',
                        style: 'background:rgba(0,0,0,0.6); pointer-events:none;',
                    }, [
                        h('span', { class: 'text-white small' }, 'Buffering…'),
                    ])
                    : null,
            ]);
    },
});

// ─── VideoWall page state ─────────────────────────────────────────────────────

const loading = ref(true);
const error = ref<Error | undefined>();
const liveStreams = ref<LiveStream[]>([]);
let refreshTimer: number | undefined;

const gridClass = computed(() => {
    const n = liveStreams.value.length;
    if (n <= 1) return 'grid-cols-1';
    if (n <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
});

onMounted(async () => {
    await load();
    refreshTimer = window.setInterval(refreshPaths, 30_000);
});

onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer);
});

async function load() {
    loading.value = true;
    error.value = undefined;
    try {
        const [pathsData, leasesData] = await Promise.all([
            std('/api/video/paths') as Promise<{ pageCount: number; itemCount: number; items: PathItem[] }>,
            std('/api/video/lease?limit=200&page=0&order=desc&sort=created&expired=false&ephemeral=false&filter=') as Promise<{ total: number; items: VideoLease[] }>,
        ]);

        const readyPaths = new Set(
            (pathsData.items ?? []).filter(p => p.ready).map(p => p.name)
        );

        // Build a map of path-name -> reader count from the paths response
        const readerCounts = new Map<string, number>(
            (pathsData.items ?? []).filter(p => p.ready).map(p => [p.name, Array.isArray(p.readers) ? p.readers.length : 0])
        );

        const liveLeases = (leasesData.items ?? []).filter(l => l.path && readyPaths.has(l.path));

        // Initialise stream entries so the grid shows immediately
        liveStreams.value = liveLeases.map(lease => ({
            lease,
            readers: readerCounts.get(lease.path) ?? 0,
            hlsUrl: null,
            loadingMeta: true,
            metaError: null,
        }));

        loading.value = false;

        // Fetch HLS metadata for each live stream in parallel
        await Promise.all(
            liveStreams.value.map((stream, idx) => fetchMeta(idx))
        );
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}

async function fetchMeta(idx: number) {
    const stream = liveStreams.value[idx];
    if (!stream) return;

    try {
        const meta = await std(`/api/video/lease/${stream.lease.id}/metadata`) as VideoLeaseMetadata;
        const rawUrl = meta?.protocols?.hls?.url;
        liveStreams.value[idx] = {
            ...stream,
            loadingMeta: false,
            hlsUrl: rawUrl ? rawUrl.replace(/\{\{mode\}\}/g, 'read') : null,
        };
    } catch (err) {
        liveStreams.value[idx] = {
            ...stream,
            loadingMeta: false,
            metaError: err instanceof Error ? err : new Error(String(err)),
        };
    }
}

// Called by the auto-refresh timer — only adds/removes streams, doesn't reload metadata for existing ones
async function refreshPaths() {
    try {
        const [pathsData, leasesData] = await Promise.all([
            std('/api/video/paths') as Promise<{ pageCount: number; itemCount: number; items: PathItem[] }>,
            std('/api/video/lease?limit=200&page=0&order=desc&sort=created&expired=false&ephemeral=false&filter=') as Promise<{ total: number; items: VideoLease[] }>,
        ]);

        const readyPaths = new Set(
            (pathsData.items ?? []).filter(p => p.ready).map(p => p.name)
        );
        const readerCounts = new Map<string, number>(
            (pathsData.items ?? []).filter(p => p.ready).map(p => [p.name, Array.isArray(p.readers) ? p.readers.length : 0])
        );

        const liveLeases = (leasesData.items ?? []).filter(l => l.path && readyPaths.has(l.path));
        const existingIds = new Set(liveStreams.value.map(s => s.lease.id));
        const incomingIds = new Set(liveLeases.map(l => l.id));

        // Update reader counts on existing streams
        liveStreams.value = liveStreams.value
            .filter(s => incomingIds.has(s.lease.id))
            .map(s => ({ ...s, readers: readerCounts.get(s.lease.path) ?? s.readers }));

        // Add newly live streams
        const newLeases = liveLeases.filter(l => !existingIds.has(l.id));
        const newStreams: LiveStream[] = newLeases.map(lease => ({
            lease,
            readers: readerCounts.get(lease.path) ?? 0,
            hlsUrl: null,
            loadingMeta: true,
            metaError: null,
        }));

        if (newStreams.length) {
            const startIdx = liveStreams.value.length;
            liveStreams.value = [...liveStreams.value, ...newStreams];
            await Promise.all(newStreams.map((_, i) => fetchMeta(startIdx + i)));
        }
    } catch {
        // Silently ignore refresh errors — the existing streams remain visible
    }
}

async function refresh() {
    await load();
}
</script>

<style scoped>
.video-wall-grid {
    display: grid;
    gap: 0.75rem;
    height: 100%;
    grid-auto-rows: 1fr;
}

.grid-cols-1 {
    grid-template-columns: 1fr;
}

.grid-cols-2 {
    grid-template-columns: repeat(2, 1fr);
}

.grid-cols-3 {
    grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
    .grid-cols-2,
    .grid-cols-3 {
        grid-template-columns: 1fr;
    }
}

@media (min-width: 769px) and (max-width: 1200px) {
    .grid-cols-3 {
        grid-template-columns: repeat(2, 1fr);
    }
}

.video-cell {
    aspect-ratio: 16 / 9;
}

.video-wall-grid.grid-cols-1 .video-cell {
    aspect-ratio: unset;
    min-height: 60vh;
}
</style>
