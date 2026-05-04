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
                <IconHistory :size='22' stroke='1.5' />
                <span class='modal-title'>Recordings</span>
            </div>
            <div class='ms-auto d-flex align-items-center gap-3'>
                <span
                    v-if='!loading && data'
                    class='text-secondary small'
                >
                    {{ filteredSegmentCount }} segment{{ filteredSegmentCount !== 1 ? 's' : '' }}
                    &nbsp;·&nbsp;
                    {{ formatBytes(filteredTotalBytes) }} total
                </span>
                <TablerRefreshButton :loading='loading' @click='fetchRecordings' />
            </div>
        </div>

        <!-- Filter bar -->
        <div
            v-if='!loading && data && data.items.length'
            class='px-3 py-2 border-bottom d-flex align-items-end gap-3 flex-wrap'
        >
            <!-- From -->
            <div class='d-flex flex-column gap-1'>
                <span class='text-secondary small'>From</span>
                <div class='d-flex gap-1 align-items-center'>
                    <input
                        v-model='filterFromDate'
                        type='date'
                        class='form-control form-control-sm'
                        style='width:140px'
                    />
                    <div class='d-flex align-items-center gap-1'>
                        <select v-model='filterFromHH' class='form-select form-select-sm' style='width:66px; color:inherit; background-color:var(--tblr-body-bg, #1a1a2e)'>
                            <option value=''>HH</option>
                            <option v-for='h in hours' :key='h' :value='h'>{{ h }}</option>
                        </select>
                        <span class='text-secondary'>:</span>
                        <select v-model='filterFromMM' class='form-select form-select-sm' style='width:66px; color:inherit; background-color:var(--tblr-body-bg, #1a1a2e)'>
                            <option value=''>MM</option>
                            <option v-for='m in minutes' :key='m' :value='m'>{{ m }}</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- To -->
            <div class='d-flex flex-column gap-1'>
                <span class='text-secondary small'>To</span>
                <div class='d-flex gap-1 align-items-center'>
                    <input
                        v-model='filterToDate'
                        type='date'
                        class='form-control form-control-sm'
                        style='width:140px'
                    />
                    <div class='d-flex align-items-center gap-1'>
                        <select v-model='filterToHH' class='form-select form-select-sm' style='width:66px; color:inherit; background-color:var(--tblr-body-bg, #1a1a2e)'>
                            <option value=''>HH</option>
                            <option v-for='h in hours' :key='h' :value='h'>{{ h }}</option>
                        </select>
                        <span class='text-secondary'>:</span>
                        <select v-model='filterToMM' class='form-select form-select-sm' style='width:66px; color:inherit; background-color:var(--tblr-body-bg, #1a1a2e)'>
                            <option value=''>MM</option>
                            <option v-for='m in minutes' :key='m' :value='m'>{{ m }}</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Sort -->
            <div class='d-flex flex-column gap-1'>
                <span class='text-secondary small'>Sort</span>
                <select v-model='sortBy' class='form-select form-select-sm' style='width:160px'>
                    <option value='date-desc'>Newest first</option>
                    <option value='date-asc'>Oldest first</option>
                    <option value='size-desc'>Largest first</option>
                    <option value='size-asc'>Smallest first</option>
                </select>
            </div>

            <button
                v-if='filterFromDate || filterToDate'
                class='btn btn-sm btn-ghost-secondary mb-1'
                @click='clearFilters'
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
            label='No recordings in selected range'
            :create='false'
        />
        <div
            v-else
            class='modal-body'
            style='max-height:60vh; overflow-y:auto;'
        >
            <div
                v-for='rec in filteredItems'
                :key='rec.path'
                class='mb-2'
            >
                <!-- Lease header (clickable to collapse) -->
                <div
                    class='d-flex align-items-center gap-2 px-2 py-2 rounded cursor-pointer'
                    style='user-select:none; background:rgba(255,255,255,0.04)'
                    @click='toggleCollapse(rec.path)'
                >
                    <IconChevronDown v-if='!isCollapsed(rec.path)' :size='14' stroke='2' class='text-secondary' />
                    <IconChevronRight v-else :size='14' stroke='2' class='text-secondary' />
                    <IconVideo :size='16' stroke='1' class='text-secondary' />
                    <span class='fw-semibold'>{{ rec.lease_name || 'Deleted Lease' }}</span>
                    <span class='text-secondary small'>{{ rec.segments.length }} segment{{ rec.segments.length !== 1 ? 's' : '' }}</span>
                    <span class='text-secondary small'>· {{ formatBytes(leaseBytes(rec)) }}</span>
                    <span v-if='!rec.lease_name' class='badge bg-red text-white ms-1'>Orphaned</span>
                </div>

                <!-- Segments -->
                <template v-if='!isCollapsed(rec.path)'>
                    <StandardItem
                        v-for='seg in rec.segments'
                        :key='seg.start'
                        class='d-flex flex-column gap-2 p-2 mb-1 ms-3'
                    >
                        <div class='d-flex align-items-center gap-3'>
                            <div class='d-flex flex-column flex-grow-1'>
                                <div class='fw-bold small'>{{ formatDate(seg.start) }}</div>
                                <div class='text-secondary small'>{{ seg.size ? formatBytes(seg.size) : '—' }}</div>
                            </div>
                            <div class='d-flex btn-list'>
                                <TablerIconButton title='Play' @click.stop='togglePlay(rec, seg.start)'>
                                    <IconPlayerPlay v-if='playingKey !== rec.path + seg.start' :size='20' stroke='1' />
                                    <IconPlayerStop v-else :size='20' stroke='1' />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Download'
                                    :loading='downloading === rec.path + seg.start'
                                    @click.stop='download(rec, seg.start)'
                                >
                                    <IconDownload :size='20' stroke='1' />
                                </TablerIconButton>
                                <TablerDelete displaytype='icon' @delete='deleteSegment(rec, seg.start)' />
                            </div>
                        </div>
                        <div
                            v-if='playingKey === rec.path + seg.start && rec.lease_id'
                            class='w-100'
                            style='background:#000; border-radius:4px; overflow:hidden;'
                        >
                            <video
                                :src='playbackUrl(rec.lease_id, seg.start)'
                                controls
                                autoplay
                                style='width:100%; max-height:320px; display:block;'
                                @error='playError = true'
                            />
                            <div v-if='playError' class='text-center text-danger small py-2'>
                                Playback failed — try downloading instead.
                            </div>
                        </div>
                    </StandardItem>
                </template>
            </div>
        </div>

        <div class='modal-footer'>
            <button class='btn btn-secondary ms-auto' @click='emit("close")'>Close</button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std } from '../../../../std.ts';
import StandardItem from '../../util/StandardItem.vue';
import {
    IconHistory, IconVideo, IconDownload,
    IconPlayerPlay, IconPlayerStop,
    IconChevronDown, IconChevronRight,
} from '@tabler/icons-vue';
import {
    TablerModal, TablerLoading, TablerNone,
    TablerIconButton, TablerDelete, TablerRefreshButton,
} from '@tak-ps/vue-tabler';

const emit = defineEmits(['close']);

type Segment = { start: string; size: number };
type RecordingItem = { path: string; lease_id: number | null; lease_name: string | null; segments: Segment[] };
type RecordingsData = { total_segments: number; items: RecordingItem[] };

const loading     = ref(true);
const downloading = ref<string | null>(null);
const playingKey  = ref<string | null>(null);
const playError   = ref(false);
const data        = ref<RecordingsData | null>(null);
const collapsedPaths = ref<string[]>([]);

const filterFromDate = ref('');
const filterFromHH   = ref('');
const filterFromMM   = ref('');
const filterToDate   = ref('');
const filterToHH     = ref('');
const filterToMM     = ref('');
const sortBy         = ref('date-desc');

const hours   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

onMounted(fetchRecordings);

function isCollapsed(path: string): boolean {
    return collapsedPaths.value.includes(path);
}

function toggleCollapse(path: string) {
    const idx = collapsedPaths.value.indexOf(path);
    if (idx === -1) collapsedPaths.value = [...collapsedPaths.value, path];
    else collapsedPaths.value = collapsedPaths.value.filter(p => p !== path);
}

function clearFilters() {
    filterFromDate.value = '';
    filterFromHH.value   = '';
    filterFromMM.value   = '';
    filterToDate.value   = '';
    filterToHH.value     = '';
    filterToMM.value     = '';
}

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

function makeTimestamp(date: string, hh: string, mm: string, endOfMinute = false): number | null {
    if (!date) return null;
    const h = hh || (endOfMinute ? '23' : '00');
    const m = mm || (endOfMinute ? '59' : '00');
    return new Date(`${date}T${h}:${m}:${endOfMinute ? '59' : '00'}`).getTime();
}

const filteredItems = computed((): RecordingItem[] => {
    if (!data.value) return [];
    const from = makeTimestamp(filterFromDate.value, filterFromHH.value, filterFromMM.value);
    const to   = makeTimestamp(filterToDate.value,   filterToHH.value,   filterToMM.value, true);

    return data.value.items.map(rec => {
        const segs = [...rec.segments].filter(seg => {
            const t = new Date(seg.start).getTime();
            if (from && t < from) return false;
            if (to   && t > to)   return false;
            return true;
        }).sort((a, b) => {
            const ta = new Date(a.start).getTime(), tb = new Date(b.start).getTime();
            const sa = a.size, sb = b.size;
            switch (sortBy.value) {
                case 'date-asc':  return ta - tb;
                case 'size-desc': return sb - sa;
                case 'size-asc':  return sa - sb;
                default:          return tb - ta;
            }
        });
        return { ...rec, segments: segs };
    }).filter(r => r.segments.length > 0);
});

const filteredSegmentCount = computed(() => filteredItems.value.reduce((s, r) => s + r.segments.length, 0));
const filteredTotalBytes   = computed(() => filteredItems.value.reduce((s, r) => s + leaseBytes(r), 0));

function leaseBytes(rec: RecordingItem): number {
    return rec.segments.reduce((s, seg) => s + (seg.size ?? 0), 0);
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} `
         + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function formatBytes(b: number): string {
    if (!b) return '—';
    if (b < 1024)             return `${b} B`;
    if (b < 1024 ** 2)        return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 ** 3)        return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function playbackUrl(leaseId: number, start: string): string {
    const token = (localStorage as Record<string, string>).token || '';
    return `/api/video/lease/${leaseId}/recordings/download?start=${encodeURIComponent(start)}&token=${encodeURIComponent(token)}`;
}

function togglePlay(rec: RecordingItem, start: string) {
    playError.value = false;
    const key = rec.path + start;
    playingKey.value = playingKey.value === key ? null : key;
}

async function download(rec: RecordingItem, start: string) {
    if (!rec.lease_id) { alert('Cannot download recordings from deleted leases.'); return; }
    downloading.value = rec.path + start;
    try {
        await std(
            `/api/video/lease/${rec.lease_id}/recordings/download?start=${encodeURIComponent(start)}`,
            { download: `${rec.lease_name || rec.path}-${start}.mp4` }
        );
    } finally { downloading.value = null; }
}

async function deleteSegment(rec: RecordingItem, start: string) {
    if (!rec.lease_id) { alert('Cannot delete recordings from deleted leases yet.'); return; }
    await std(`/api/video/lease/${rec.lease_id}/recordings?start=${encodeURIComponent(start)}`, { method: 'DELETE' });
    await fetchRecordings();
}
</script>
