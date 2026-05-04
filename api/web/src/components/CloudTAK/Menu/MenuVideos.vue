<template>
    <MenuTemplate
        name='Videos'
        :loading='loading.main'
    >
        <template #buttons>
            <TablerIconButton
                title='Publish Video Stream'
                @click='router.push(`/menu/videos/remote/new`)'
            >
                <IconVideoPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Get Lease'
                @click='lease={}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='All Recordings'
                @click='showRecordingsPage = true'
            >
                <IconHistory
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Video Wall'
                @click='router.push("/video")'
            >
                <IconDeviceTv
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <template v-if='mode === "lease"'>
                <TablerRefreshButton
                    :loading='loading.main'
                    @click='fetchLeases'
                />
            </template>
            <template v-else>
                <TablerRefreshButton
                    :loading='loading.main'
                    @click='fetchConnections'
                />
            </template>
        </template>
        <template #default>
            <TablerPillGroup
                v-model='mode'
                :options='[
                    { value: "connections", label: "Streams" },
                    { value: "lease", label: "Leases" }
                ]'
            >
                <template #option='{ option }'>
                    <IconVideo
                        v-if='option.value === "connections"'
                        v-tooltip='"Video Connections"'
                        :size='32'
                        stroke='1'
                    />
                    <IconServer2
                        v-else
                        v-tooltip='"Video Leases"'
                        :size='32'
                        stroke='1'
                    />
                    <span class='ms-2'>{{ option.label }}</span>
                </template>
            </TablerPillGroup>

            <template v-if='mode === "connections"'>
                <div class='col-12'>
                    <TablerInput
                        v-model='connectionFilter'
                        icon='search'
                        placeholder='Stream Search'
                    />
                </div>

                <EmptyInfo v-if='mapStore.hasNoChannels' />

                <TablerLoading
                    v-if='loading.connections'
                />
                <TablerNone
                    v-else-if='!filteredVideos.size && !filteredConnections.length && !filteredActiveLeases.length'
                    label='No Video Connections'
                    :create='false'
                />
                <TablerAlert
                    v-else-if='error'
                    :err='error'
                />
                <div
                    v-else
                    class='col-12 d-flex flex-column gap-2 py-3'
                >
                    <StandardItem
                        v-for='connection in filteredConnections'
                        :key='connection.uuid'
                        class='d-flex align-items-center gap-3 p-2'
                        @click='floatStore.addConnection(connection)'
                    >
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                            style='width: 3rem; height: 3rem; min-width: 3rem; position: relative;'
                        >
                            <IconVideo
                                :size='24'
                                stroke='1'
                            />
                            <span
                                v-if='activePaths.has(connection.uuid)'
                                style='position:absolute; bottom:2px; right:2px; width:10px; height:10px; border-radius:50%; background:#2fb344; border:2px solid #1a1a1a;'
                            />
                        </div>

                        <div class='d-flex flex-column'>
                            <div class='fw-bold'>
                                <span v-if='connection.alias'>{{ connection.alias }}</span>
                                <span
                                    v-else
                                    class='fst-italic text-secondary'
                                >Unnamed</span>
                            </div>
                            <div
                                v-if='activePaths.has(connection.uuid)'
                                class='text-success small'
                            >Live</div>
                        </div>

                        <div class='d-flex btn-list ms-auto'>
                            <TablerIconButton
                                title='Edit Lease'
                                @click.stop='router.push(`/menu/videos/remote/${connection.uuid}`)'
                            >
                                <IconPencil
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </StandardItem>

                    <StandardItem
                        v-for='activeLease in filteredActiveLeases'
                        :key='activeLease.id'
                        class='d-flex align-items-center gap-3 p-2 cursor-pointer'
                        @click='lease = activeLease'
                    >
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                            style='width: 3rem; height: 3rem; min-width: 3rem; position: relative;'
                        >
                            <component
                                :is='getLeaseIcon(activeLease.source_type)'
                                :size='24'
                                stroke='1'
                            />
                            <span
                                style='position:absolute; bottom:2px; right:2px; width:10px; height:10px; border-radius:50%; background:#2fb344; border:2px solid #1a1a1a;'
                            />
                        </div>

                        <div class='d-flex flex-column'>
                            <div class='fw-bold'>
                                <span v-if='activeLease.name'>{{ activeLease.name }}</span>
                                <span
                                    v-else
                                    class='fst-italic text-secondary'
                                >Unnamed</span>
                            </div>
                            <div class='text-success small'>Live</div>
                        </div>
                    </StandardItem>
                    <StandardItem
                        v-for='video in filteredVideos'
                        :key='video.id'
                        class='d-flex align-items-center gap-3 p-2 cursor-pointer'
                        @click='router.push(`/cot/${video.id}`)'
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
                                <span v-if='video.properties.callsign || video.properties.name'>{{ video.properties.callsign || video.properties.name }}</span>
                                <span
                                    v-else
                                    class='fst-italic text-secondary'
                                >Unnamed</span>
                            </div>
                        </div>
                    </StandardItem>
                </div>
            </template>
            <template v-else-if='mode === "lease"'>
                <div class='col-12'>
                    <TablerInput
                        v-model='leasePaging.filter'
                        icon='search'
                        placeholder='Lease Search'
                    />
                </div>
                <TablerLoading
                    v-if='loading.leases'
                />
                <TablerNone
                    v-else-if='leases.total === 0'
                    label='No Video Leases'
                    :create='false'
                />
                <TablerAlert
                    v-else-if='error'
                    :err='error'
                />
                <div
                    v-else
                    class='col-12 d-flex flex-column gap-2 py-3'
                >
                    <StandardItem
                        v-for='l in leases.items'
                        :key='l.id'
                        class='d-flex align-items-center gap-3 p-2 cursor-pointer'
                        @click='lease = l'
                    >
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                            style='width: 3rem; height: 3rem; min-width: 3rem;'
                        >
                            <component
                                :is='getLeaseIcon(l.source_type)'
                                :size='24'
                                stroke='1'
                            />
                        </div>

                        <div class='d-flex flex-column'>
                            <div class='fw-bold'>
                                <span v-if='l.name'>{{ l.name }}</span>
                                <span
                                    v-else
                                    class='fst-italic text-secondary'
                                >Unnamed</span>
                            </div>
                            <div
                                v-if='getLeaseDescription(l)'
                                class='text-secondary small'
                                :class='getLeaseDescriptionClass(l)'
                            >
                                {{ getLeaseDescription(l) }}
                            </div>
                        </div>

                        <div class='d-flex btn-list ms-auto'>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deleteLease(l)'
                            />
                        </div>
                    </StandardItem>
                </div>
                <div class='col-12 d-flex justify-content-center pt-3'>
                    <TablerPager
                        v-if='leases.total > leasePaging.limit'
                        :page='leasePaging.page'
                        :total='leases.total'
                        :limit='leasePaging.limit'
                        @page='leasePaging.page = $event'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>

    <VideoLeaseModal
        v-if='lease'
        :lease='lease'
        :is-system-admin='isSystemAdmin'
        @close='lease = false'
        @refresh='fetchLeases'
    />

    <VideoRecordingsPage
        v-if='showRecordingsPage'
        :is-system-admin='isSystemAdmin'
        @close='showRecordingsPage = false'
    />
</template>

<script setup lang='ts'>
import MenuTemplate from '../util/MenuTemplate.vue';
import VideoLeaseModal from './Videos/VideoLeaseModal.vue';
import VideoRecordingsPage from './Videos/VideoRecordingsPage.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import StandardItem from '../util/StandardItem.vue';
import { server, std } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import ProfileConfig from '../../../base/profile.ts';
import type { VideoLease, VideoConnectionList } from '../../../types.ts';

import { useMapStore } from '../../../stores/map.ts';
import { useFloatStore } from '../../../stores/float.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerPager,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconPencil,
    IconServer2,
    IconVideoPlus,
    IconHistory,
    IconDeviceTv,
    IconCar,
    IconWalk,
    IconDrone,
    IconHelicopter,
    IconPlane,
    IconDeviceDesktop,
} from '@tabler/icons-vue';

import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router';

const router = useRouter();
const mapStore = useMapStore();
const floatStore = useFloatStore();

const connectionFilter = ref('');
const leasePaging = ref({
    page: 0,
    filter: '',
    limit: 20
})

const mode = ref('connections');
const error = ref<Error | undefined>();
const loading = ref({
    main: true,
    connections: true,
    leases: true
});
const lease = ref();
const showRecordingsPage = ref(false);
const isSystemAdmin = ref(false);
const leases = ref<{ total: number, items: VideoLease[] }>({ total: 0, items: [] });
const connections = ref<VideoConnectionList>({ videoConnections: [] });
const activePaths = ref<Set<string>>(new Set());
const videos = ref<Set<COT>>(new Set())

const publishedUuids = computed(() => new Set(connections.value.videoConnections.map(c => c.uuid)));

const filteredConnections = computed(() => {
    const sorted = [...connections.value.videoConnections].sort((a, b) => {
        const aLive = activePaths.value.has(a.uuid) ? 1 : 0;
        const bLive = activePaths.value.has(b.uuid) ? 1 : 0;
        return bLive - aLive;
    });
    if (!connectionFilter.value) return sorted;
    return sorted.filter((c) => (c.alias || 'Unnamed').toLowerCase().includes(connectionFilter.value.toLowerCase()));
});

const filteredActiveLeases = computed(() => {
    return leases.value.items.filter((l) => {
        if (publishedUuids.value.has(l.path)) return false;
        if (!activePaths.value.has(l.path)) return false;
        if (connectionFilter.value && !(l.name || 'Unnamed').toLowerCase().includes(connectionFilter.value.toLowerCase())) return false;
        return true;
    });
});

const filteredVideos = computed(() => {
    if (!connectionFilter.value) return videos.value;

    const filtered = new Set<COT>();
    for (const v of videos.value) {
        const name = v.properties.callsign || v.properties.name || 'Unnamed';
        if (typeof name === 'string' && name.toLowerCase().includes(connectionFilter.value.toLowerCase())) {
            filtered.add(v);
        }
    }
    return filtered;
});

watch(leasePaging.value, async () => {
    await fetchLeases();
});

watch(mode, async () => {
    if (mode.value === 'connections') {
        await fetchConnections();
    } else if (mode.value === 'lease') {
        await fetchLeases();
    }
});

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    if (isSysAdmin && isSysAdmin.value) {
        isSystemAdmin.value = true;
    }

    await fetchConnections();
    await fetchLeases();

    videos.value = await mapStore.worker.db.filter('properties.video', {
        mission: true
    })

    loading.value.main = false;
});

function expired(expiration: string | null): boolean {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

async function fetchLeases(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value.leases = true;
        error.value = undefined;

        const res = await server.GET('/api/video/lease', {
            params: {
                query: {
                    filter: leasePaging.value.filter,
                    expired: 'all',
                    order: 'desc',
                    sort: 'created',
                    ephemeral: 'false',
                    limit: leasePaging.value.limit,
                    page: leasePaging.value.page
                }
            }
        })

        if (res.error) throw new Error(res.error.message);

        leases.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.leases = false;
}

async function fetchConnections(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value.connections = true;
        error.value = undefined;

        const [connectionsRes, pathsData, leasesRes] = await Promise.all([
            server.GET('/api/marti/video'),
            std('/api/video/paths').catch(() => ({ items: [] })) as Promise<{ items: { name: string, ready: boolean }[] }>,
            server.GET('/api/video/lease', { params: { query: { limit: 200, page: 0, order: 'desc', sort: 'created', expired: 'false', ephemeral: 'false', filter: '' } } })
        ]);

        if (connectionsRes.error) throw new Error(connectionsRes.error.message);
        connections.value = connectionsRes.data;

        activePaths.value = new Set(
            (pathsData.items || []).filter(p => p.ready).map(p => p.name)
        );

        if (!leasesRes.error) {
            leases.value = leasesRes.data;
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.connections = false;
}

async function deleteLease(lease: VideoLease): Promise<void> {
    loading.value.main = true;

    try {
        const res = await server.DELETE('/api/video/lease/{:lease}', {
            params: { path: { ':lease': lease.id } }
        });
        if (res.error) throw new Error(res.error.message);

        await fetchLeases();

        loading.value.main = false;
    } catch (err) {
        loading.value.main = false;
        throw err;
    }
}

function getLeaseIcon(sourceType: string) {
    switch (sourceType) {
        case 'vehicle': return IconCar;
        case 'personal': return IconWalk;
        case 'uas-rotor': return IconDrone;
        case 'rotor': return IconHelicopter;
        case 'fixedwing': return IconPlane;
        case 'uas-fixedwing': return IconPlane;
        case 'screenshare': return IconDeviceDesktop;
        default: return IconVideo;
    }
}

function getLeaseDescription(lease: VideoLease): string {
    if (expired(lease.expiration)) return 'Expired Lease';
    if (lease.expiration === null) return 'Permanent';
    return lease.expiration;
}

function getLeaseDescriptionClass(lease: VideoLease): string {
    if (expired(lease.expiration)) return 'text-red';
    if (lease.expiration === null) return 'text-blue';
    return '';
}

</script>
