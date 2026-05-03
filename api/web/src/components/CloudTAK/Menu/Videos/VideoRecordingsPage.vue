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
            <div class='modal-title'>All Recordings</div>
            <div class='ms-auto d-flex align-items-center gap-3'>
                <span
                    v-if='!loading && data'
                    class='text-secondary small'
                >{{ data.total_segments }} segment{{ data.total_segments !== 1 ? "s" : "" }}</span>
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
                class='mb-3'
            >
                <div class='d-flex align-items-center gap-2 mb-1 px-1'>
                    <IconVideo
                        :size='18'
                        stroke='1'
                        class='text-secondary'
                    />
                    <span class='fw-bold'>{{ rec.lease_name || 'Deleted Lease' }}</span>
                    <span class='text-secondary small ms-1'>{{ rec.segments.length }} segment{{ rec.segments.length !== 1 ? 's' : '' }}</span>
                    <span
                        v-if='!rec.lease_name'
                        class='badge bg-red text-white ms-1'
                    >Orphaned</span>
                    <code class='text-secondary small ms-auto'>{{ rec.path }}</code>
                </div>

                <StandardItem
                    v-for='seg in rec.segments'
                    :key='seg.start'
                    class='d-flex align-items-center gap-3 p-2 mb-1'
                >
                    <div
                        class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                        style='width: 2.5rem; height: 2.5rem; min-width: 2.5rem;'
                    >
                        <IconPlayerPlay
                            :size='18'
                            stroke='1'
                        />
                    </div>
                    <div class='d-flex flex-column'>
                        <div class='fw-bold small'>{{ formatDate(seg.start) }}</div>
                        <div class='text-secondary' style='font-size:0.72rem;'>{{ seg.start }}</div>
                    </div>
                    <div class='d-flex btn-list ms-auto'>
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
    IconVideo,
    IconDownload,
    IconPlayerPlay,
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

async function download(rec: RecordingItem, start: string) {
    downloading.value = rec.path + start;
    try {
        const name = `${rec.lease_name || rec.path}-${start}.mp4`;
        if (rec.lease_id) {
            await std(`/api/video/lease/${rec.lease_id}/recordings/download?start=${encodeURIComponent(start)}`, {
                download: name
            });
        } else {
            alert('Cannot download recordings from deleted leases yet.');
        }
    } finally {
        downloading.value = null;
    }
}

async function deleteSegment(rec: RecordingItem, start: string) {
    if (rec.lease_id) {
        await std(`/api/video/lease/${rec.lease_id}/recordings?start=${encodeURIComponent(start)}`, {
            method: 'DELETE'
        });
    } else {
        await std(`/api/video/orphan-recording?path=${encodeURIComponent(rec.path)}&start=${encodeURIComponent(start)}`, {
            method: 'DELETE'
        });
    }
    await fetchRecordings();
}
</script>
