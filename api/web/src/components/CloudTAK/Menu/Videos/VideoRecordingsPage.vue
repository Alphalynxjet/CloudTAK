<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header'>
            <div class='d-flex align-items-center gap-2'>
                <IconHistory
                    :size='22'
                    stroke='1.5'
                />
                <span class='modal-title'>Recordings</span>
            </div>
            <div class='ms-auto d-flex align-items-center gap-3'>
                <span
                    v-if='!loading && data'
                    class='text-secondary small'
                >
                    {{ filteredSegmentCount }} segment{{ filteredSegmentCount !== 1 ? 's' : '' }}
                    &nbsp;·&nbsp;
                    {{ formatBytes(filteredTotalBytes) }} used
                </span>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchRecordings'
                />
            </div>
        </div>

        <!-- Filters & Sort -->
        <div
            v-if='!loading && data && data.items.length'
            class='px-3 pt-3 pb-2 d-flex flex-wrap gap-2 align-items-end border-bottom'
        >
            <div class='d-flex flex-column gap-1' style='min-width:160px;flex:1'>
                <label class='form-label small mb-0 text-secondary'>From</label>
                <input
                    v-model='filterFrom'
                    type='datetime-local'
                    class='form-control form-control-sm'
                />
            </div>
            <div class='d-flex flex-column gap-1' style='min-width:160px;flex:1'>
                <label class='form-label small mb-0 text-secondary'>To</label>
                <input
                    v-model='filterTo'
                    type='datetime-local'
                    class='form-control form-control-sm'
                />
            </div>
            <div class='d-flex flex-column gap-1' style='min-width:140px;'>
                <label class='form-label small mb-0 text-secondary'>Sort by</label>
                <select
                    v-model='sortBy'
                    class='form-select form-select-sm'
                >
                    <option value='date-desc'>Date (newest first)</option>
                    <option value='date-asc'>Date (oldest first)</option>
                    <option value='size-desc'>Size (largest first)</option>
                    <option value='size-asc'>Size (smallest first)</option>
                </select>
            </div>
            <button
                v-if='filterFrom || filterTo'
                class='btn btn-sm btn-ghost-secondary'
                @click='filterFrom = ""; filterTo = ""'
            >
                Clear
            </button>
        </div>

        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!data || !data.items.length'
            label='No Recordings'
            :create='false'
        />
        <TablerNone
            v-else-if='filteredItems.length === 0'
            label='No recordings in selected time range'
            :create='false'
        />
        <div
            v-else
            class='modal-body'
            style='max-height: 65vh; overflow-y: auto;'
        >
            <div
                v-for='rec in filteredItems'
                :key='rec.path'
                class='mb-4'
            >
                <div class='d-flex align-items-center gap-2 mb-2 px-1'>
                    <IconVideo
                        :size='16'
                        stroke='1'
                        class='text-secondary flex-shrink-0'
                    />
                    <span class='fw-semibold'>{{ rec.lease_name || 'Deleted Lease' }}</span>
                    <span class='text-secondary small'>{{ rec.segments.length }} segment{{ rec.segments.length !== 1 ? 's' : '' }}</span>
                    <span class='text-secondary small'>· {{ formatBytes(leaseBytes(rec)) }}</span>
                    <span
                        v-if='!rec.lease_name'
                        class='badge bg-red text-white'
                    >Orphaned</span>
                </div>

                <StandardItem
                    v-for='seg in rec.segments'
                    :key='seg.start'
                    class='d-flex flex-column gap-2 p-2 mb-1'
                >
                    <div class='d-flex align-items-center gap-3'>
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                            style='width: 2.5rem; height: 2.5rem;'
                        >
                            <IconPlayerPlay
                                :size='16'
                                stroke='1'
                            />
                        </div>
                        <div class='d-flex flex-column flex-grow-1'>
                            <div class='fw-bold small'>{{ formatDate(seg.start) }}</div>
                            <div
                                v-if='seg.size'
                                class='text-secondary small'
                            >{{ formatBytes(seg.size) }}</div>
                        </div>
                        <div class='d-flex btn-list'>
                            <TablerIconButton
                                title='Play in browser'
                                @click.stop='togglePlay(rec, seg.start)'
                            >
                                <IconPlayerPlay
                                    v-if='playingKey !== rec.path + seg.start'
                                    :size='20'
                                    stroke='1'
                                />
                                <IconPlayerStop
                                    v-else
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                title='Download'
                                :loading='downloading === rec.path + seg.start'
                                @click.stop='download(rec, seg.start)'
                            >
                                <IconDownload
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deleteSegment(rec, seg.start)'
                            />
                        </div>
                    </div>

                    <div
                        v-if='playingKey === rec.path + seg.start && rec.lease_id'
                        class='w-100'
                        style='background:#000; border-radius:4px; overflow:hidden;'
                    >
                        <video
                            ref='videoEl'
                            :src='playbackUrl(rec.lease_id, seg.start)'
                            controls
                            autoplay
                            style='width:100%; max-height:320px; display:block;'
                            @error='playError = true'
                        />
                        <div
                            v-if='playError'
                            class='text-center text-danger small py-2'
                        >
                            Playback failed — try downloading instead.
                        </div>
                    </div>
                </StandardItem>
            </div>
        </div>

        <div class='modal-footer'>
            <button
                class='btn btn-secondary ms-auto'
                @click='emit("close")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std } from '../../../../std.ts';
import StandardItem from '../../util/StandardItem.vue';
import {
    IconHistory,
    IconVideo,
    IconDownload,
    IconPlayerPlay,
    IconPlayerStop,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerLoading,
    TablerNone,
    TablerIconButton,
    TablerDelete,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

const emit = defineEmits(['close']);

type Segment = { start: string; end?: string; size?: number };
type RecordingItem = {
    path: string;
    lease_id: number | null;
    lease_name: string | null;
    segments: Segment[];
};
type RecordingsData = {
    total_segments: number;
    items: RecordingItem[];
};

const loading = ref(true);
const downloading = ref<string | null>(null);
const playingKey = ref<string | null>(null);
const playError = ref(false);
const data = ref<RecordingsData | null>(null);
const filterFrom = ref('');
const filterTo = ref('');
const sortBy = ref('date-desc');

onMounted(fetchRecordings);

async function fetchRecordings() {
    loading.value = true;
    try {
        data.value = await std('/api/video/recordings') as RecordingsData;
    } catch (err) {
        data.value = null;
        console.error('Failed to fetch recordings:', err);
    } finally {
        loading.value = false;
    }
}

const filteredItems = computed((): RecordingItem[] => {
    if (!data.value) return [];

    const from = filterFrom.value ? new Date(filterFrom.value).getTime() : null;
    const to = filterTo.value ? new Date(filterTo.value).getTime() : null;

    const items = data.value.items.map(rec => {
        const segs = rec.segments.filter(seg => {
            const t = new Date(seg.start).getTime();
            if (from && t < from) return false;
            if (to && t > to) return false;
            return true;
        });

        segs.sort((a, b) => {
            const ta = new Date(a.start).getTime();
            const tb = new Date(b.start).getTime();
            const sa = a.size ?? 0;
            const sb = b.size ?? 0;
            if (sortBy.value === 'date-desc') return tb - ta;
            if (sortBy.value === 'date-asc') return ta - tb;
            if (sortBy.value === 'size-desc') return sb - sa;
            if (sortBy.value === 'size-asc') return sa - sb;
            return 0;
        });

        return { ...rec, segments: segs };
    }).filter(rec => rec.segments.length > 0);

    return items;
});

const filteredSegmentCount = computed(() =>
    filteredItems.value.reduce((s, r) => s + r.segments.length, 0)
);

const filteredTotalBytes = computed(() =>
    filteredItems.value.reduce((s, r) =>
        s + r.segments.reduce((ss, seg) => ss + (seg.size ?? 0), 0), 0)
);

function leaseBytes(rec: RecordingItem): number {
    return rec.segments.reduce((s, seg) => s + (seg.size ?? 0), 0);
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function formatBytes(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function playbackUrl(leaseId: number, start: string): string {
    const token = (localStorage as Record<string, string>).token || '';
    return `/api/video/lease/${leaseId}/recordings/download?start=${encodeURIComponent(start)}&token=${encodeURIComponent(token)}`;
}

function togglePlay(rec: RecordingItem, start: string) {
    const key = rec.path + start;
    playError.value = false;
    playingKey.value = playingKey.value === key ? null : key;
}

async function download(rec: RecordingItem, start: string) {
    if (!rec.lease_id) {
        alert('Cannot download recordings from deleted leases.');
        return;
    }
    downloading.value = rec.path + start;
    try {
        await std(
            `/api/video/lease/${rec.lease_id}/recordings/download?start=${encodeURIComponent(start)}`,
            { download: `${rec.lease_name || rec.path}-${start}.mp4` }
        );
    } finally {
        downloading.value = null;
    }
}

async function deleteSegment(rec: RecordingItem, start: string) {
    if (!rec.lease_id) {
        alert('Cannot delete recordings from deleted leases yet.');
        return;
    }
    await std(
        `/api/video/lease/${rec.lease_id}/recordings?start=${encodeURIComponent(start)}`,
        { method: 'DELETE' }
    );
    await fetchRecordings();
}
</script>
