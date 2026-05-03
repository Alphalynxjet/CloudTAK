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
                >{{ data.total_segments }} segment{{ data.total_segments !== 1 ? 's' : '' }}</span>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchRecordings'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!data || !data.items.length'
            label='No Recordings'
            :create='false'
        />
        <div
            v-else
            class='modal-body'
            style='max-height: 70vh; overflow-y: auto;'
        >
            <div
                v-for='rec in data.items'
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
import { ref, onMounted } from 'vue';
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

type Segment = { start: string };
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

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function playbackUrl(leaseId: number, start: string): string {
    const token = (localStorage as Record<string, string>).token || '';
    return `/api/video/lease/${leaseId}/recordings/download?start=${encodeURIComponent(start)}&token=${encodeURIComponent(token)}`;
}

function togglePlay(rec: RecordingItem, start: string) {
    const key = rec.path + start;
    playError.value = false;
    if (playingKey.value === key) {
        playingKey.value = null;
    } else {
        playingKey.value = key;
    }
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
