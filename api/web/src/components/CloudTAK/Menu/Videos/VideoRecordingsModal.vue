<template>
    <TablerModal>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header'>
            <div class='modal-title'>
                Recordings — {{ props.lease.name }}
            </div>
            <div class='ms-auto'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchRecordings'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!segments.length'
            label='No Recordings'
            :create='false'
        />
        <div
            v-else
            class='modal-body'
        >
            <div class='col-12 d-flex flex-column gap-2'>
                <StandardItem
                    v-for='seg in segments'
                    :key='seg.start'
                    class='d-flex align-items-center gap-3 p-2'
                >
                    <div
                        class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                        style='width: 3rem; height: 3rem; min-width: 3rem;'
                    >
                        <IconVideo
                            :size='24'
                            stroke='1'
                        />
                    </div>

                    <div class='d-flex flex-column'>
                        <div class='fw-bold'>
                            {{ formatDate(seg.start) }}
                        </div>
                        <div class='text-secondary small'>
                            {{ seg.start }}
                        </div>
                    </div>

                    <div class='d-flex btn-list ms-auto'>
                        <TablerIconButton
                            title='Download'
                            :loading='downloading === seg.start'
                            @click.stop='downloadSegment(seg.start)'
                        >
                            <IconDownload
                                :size='24'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerDelete
                            displaytype='icon'
                            @delete='deleteSegment(seg.start)'
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
import type { VideoLease } from '../../../../types.ts';
import {
    IconVideo,
    IconDownload,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerLoading,
    TablerNone,
    TablerIconButton,
    TablerDelete,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    lease: VideoLease
}>();

const emit = defineEmits(['close']);

type Segment = { start: string };

const loading = ref(true);
const downloading = ref<string | null>(null);
const segments = ref<Segment[]>([]);

onMounted(fetchRecordings);

async function fetchRecordings() {
    loading.value = true;
    try {
        const data = await std(`/api/video/lease/${props.lease.id}/recordings`) as {
            name: string;
            segments: Segment[];
        };
        segments.value = data.segments ?? [];
    } catch (err) {
        segments.value = [];
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

async function downloadSegment(start: string) {
    downloading.value = start;
    try {
        await std(`/api/video/lease/${props.lease.id}/recordings/download?start=${encodeURIComponent(start)}`, {
            download: `${props.lease.name}-${start}.mp4`
        });
    } finally {
        downloading.value = null;
    }
}

async function deleteSegment(start: string) {
    await std(`/api/video/lease/${props.lease.id}/recordings?start=${encodeURIComponent(start)}`, {
        method: 'DELETE'
    });
    await fetchRecordings();
}
</script>
