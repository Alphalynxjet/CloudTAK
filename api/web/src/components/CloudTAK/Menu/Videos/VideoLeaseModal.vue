<template>
    <TablerModal size='xl'>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("refresh")'
        />
        <div class='modal-header'>
            <div
                v-if='wizard > 0'
                v-text='`Configuration Wizard Step #${wizard}`'
            />
            <div
                v-else-if='disabled'
                class='d-flex align-items-center'
            >
                <VideoLeaseSourceType :source-type='editLease.source_type' />
                <div class='row mx-2'>
                    <span
                        class='modal-title'
                        v-text='editLease.name'
                    />
                    <span
                        v-if='editLease.source_model'
                        class='subheader'
                        v-text='editLease.source_model'
                    />
                </div>
            </div>
            <div
                v-else
                class='modal-title'
                v-text='editLease.id ? "Edit Lease" : "New Lease"'
            />

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    v-if='disabled && editLease.id'
                    title='Refresh'
                    :loading='loading'
                    @click='fetchLease'
                />

                <TablerIconButton
                    v-if='disabled && editLease.id'
                    title='Edit'
                    @click='disabled = false'
                >
                    <IconPencil
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerDelete
                    v-if='editLease.id'
                    displaytype='icon'
                    @delete='deleteLease'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <template v-else-if='wizard > 0'>
            <div class='d-flex align-items-center w-100 justify-content-center'>
                <div class='py-2'>
                    <img
                        style='max-width: 100%; height: auto; max-height: 600px;'
                        alt='UAS Tool Wizard Image'
                        :src='`/wizard/Step${wizard}.png`'
                        class='rounded'
                    >

                    <div v-if='wizard === 8'>
                        <div class='subheader pt-4'>
                            RTSP Path
                        </div>
                        <CopyField
                            v-if='protocols.rtsp'
                            :model-value='protocols.rtsp.url.replace(/.*\//, "")'
                        />
                    </div>
                </div>
            </div>

            <div class='modal-footer'>
                <div class='d-flex align-items-center w-100'>
                    <button
                        class='btn btn-secondary'
                        @click='wizard = wizard -= 1'
                    >
                        <IconChevronLeft
                            :size='20'
                            stroke='1'
                        />
                        <span
                            v-if='wizard === 1'
                            class='mx-2'
                        >Close</span>
                        <span
                            v-else
                            class='mx-2'
                        >Back</span>
                    </button>

                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='wizard = wizard > 10 ? 0 : wizard + 1'
                        >
                            <span
                                v-if='wizard < 10'
                                class='mx-2'
                            >Next</span>
                            <span
                                v-else
                                class='mx-2'
                            >Done</span>
                            <IconChevronRight
                                :size='20'
                                stroke='1'
                            />
                        </button>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if='disabled'>
            <div class='modal-body row'>
                <template v-if='Object.keys(protocols).length'>
                    <div class='col-12 d-flex align-items-center'>
                        <div class='subheader user-select-none'>
                            Video Streaming Protocols
                        </div>

                        <div class='ms-auto'>
                            <div
                                v-if='editLease.proxy'
                                class='d-flex align-items-center user-select-none'
                            >
                                <IconServer
                                    :size='24'
                                    stroke='1'
                                />
                                <span class='ms-2'>External Stream URL</span>
                            </div>
                            <div
                                v-else-if='!secure'
                                class='d-flex align-items-center user-select-none'
                            >
                                <IconArrowsLeftRight
                                    v-tooltip='"Read/Write User"'
                                    :size='24'
                                    stroke='1'
                                />
                                <span class='ms-2'>Read-Write User</span>
                            </div>
                            <div
                                v-else
                                class='col-12'
                            >
                                <TablerPillGroup
                                    v-model='mode'
                                    :options='[
                                        { value: "read", label: "Viewing User" },
                                        { value: "publish", label: "Streaming User" }
                                    ]'
                                    padding='p-1'
                                >
                                    <template #option='{ option }'>
                                        <IconBook2
                                            v-if='option.value === "read"'
                                            v-tooltip='"Viewing User"'
                                            :size='24'
                                            stroke='1'
                                        />
                                        <IconPencil
                                            v-else
                                            v-tooltip='"Streaming User"'
                                            :size='24'
                                            stroke='1'
                                        />
                                        <span class='mx-2'>{{ option.label }}</span>
                                    </template>
                                </TablerPillGroup>
                            </div>
                        </div>
                    </div>
                    <template v-if='expired(editLease.expiration)'>
                        <TablerAlert
                            title='Expired Lease'
                            :err='new Error("Renew the lease to continue using the video stream")'
                            :advanced='false'
                        />

                        <div class='col-12 d-flex justify-content-center pb-3'>
                            <div
                                class='d-flex gap-2'
                                style='width: 300px;'
                            >
                                <TablerEnum
                                    v-model='durationUnit'
                                    :options='durationUnits'
                                    style='flex: 1;'
                                />
                                <TablerInput
                                    v-if='durationUnit !== "Permanent"'
                                    v-model='durationValue'
                                    type='integer'
                                    min='1'
                                    style='width: 90px;'
                                    @keydown='digitsOnly'
                                />
                            </div>
                        </div>
                        <div class='col-12 d-flex justify-content-center'>
                            <button
                                class='btn btn-primary'
                                style='width: 280px'
                                @click='saveLease'
                            >
                                Renew Lease
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <template v-if='secure && mode === "publish"'>
                            <div class='col-md-6 pt-2'>
                                <CopyField
                                    label='Streaming Username'
                                    :model-value='editLease.stream_user || ""'
                                />
                            </div>
                            <div class='col-md-6 pt-2'>
                                <CopyField
                                    label='Streaming Password'
                                    :model-value='editLease.stream_pass || ""'
                                />
                            </div>
                        </template>
                        <template v-else-if='secure && mode === "read"'>
                            <div class='col-12 col-md-6 pt-2'>
                                <CopyField
                                    label='Viewing Username'
                                    :model-value='editLease.read_user || ""'
                                />
                            </div>
                            <div class='col-12 col-md-6 pt-2'>
                                <CopyField
                                    label='Viewing Password'
                                    :model-value='editLease.read_pass || ""'
                                />
                            </div>
                        </template>
                        <div
                            v-if='secure && editLease.srt_pass'
                            class='col-12 pt-2'
                        >
                            <CopyField
                                label='SRT Encryption Passphrase'
                                :model-value='editLease.srt_pass'
                            />
                        </div>
                        <div
                            v-for='(protocol, key) in protocols'
                            class='pt-2'
                        >
                            <template v-if='protocol'>
                                <CopyField
                                    v-if='secure && mode === "read"'
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode).replace("{{username}}", editLease.read_user || "").replace("{{password}}", editLease.read_pass || "")'
                                />
                                <CopyField
                                    v-else-if='secure && mode === "publish"'
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode).replace("{{username}}", editLease.stream_user || "").replace("{{password}}", editLease.stream_pass || "")'
                                />
                                <!-- Unsecured SRT: split into explicit Streaming (publish) and
                                     Viewing (read) URLs so the publish URL is discoverable. -->
                                <template v-else-if='!secure && key === "srt"'>
                                    <div class='mx-1'>
                                        <strong>{{ protocol.name }} &mdash; Streaming</strong>
                                    </div>
                                    <CopyField :model-value='protocol.url.replace("{{mode}}", "publish")' />
                                    <div class='mx-1 mt-2'>
                                        <strong>{{ protocol.name }} &mdash; Viewing</strong>
                                    </div>
                                    <CopyField :model-value='protocol.url.replace("{{mode}}", "read")' />
                                </template>
                                <CopyField
                                    v-else
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode)'
                                />
                            </template>
                        </div>
                    </template>

                    <div
                        v-if='disabled'
                        class='col-12 pt-2'
                    >
                        <div class='col-12 d-flex align-items-center mb-1'>
                            <label>Expiration</label>

                            <div class='ms-auto'>
                                <span
                                    v-if='expired(editLease.expiration)'
                                    class='badge bg-red text-white mt-2'
                                >Expired</span>
                                <span
                                    v-else-if='editLease.expiration === null'
                                    class='badge bg-blue text-white mt-2'
                                >Permanent</span>
                            </div>
                        </div>

                        <div class='col-12'>
                            <CopyField
                                v-if='editLease.expiration'
                                :model-value='editLease.expiration'
                            />
                        </div>
                    </div>
                </template>

                <div
                    v-if='editLease.proxy'
                    class='col-12 pt-4'
                >
                    <div class='subheader user-select-none'>
                        External Stream Config
                    </div>
                    <div class='pt-2'>
                        <CopyField
                            label='External Stream URL'
                            :model-value='editLease.proxy'
                        />
                    </div>
                </div>
            </div>
            <div class='modal-footer btn-list'>
                <button
                    v-if='protocols.rtsp && !expired(editLease.expiration)'
                    class='btn btn-secondary'
                    @click='wizard = 1'
                >
                    <IconWand
                        :size='20'
                        stroke='1'
                    />
                    <span class='mx-2'>UAS Tool Guide</span>
                </button>
                <button
                    v-if='Object.keys(protocols).length'
                    class='btn btn-secondary'
                    @click='showProtocolInfo = true'
                >
                    <IconInfoCircle
                        :size='20'
                        stroke='1'
                    />
                    <span class='mx-2'>Video Protocol Info</span>
                </button>
            </div>
        </template>
        <template v-else>
            <div
                class='modal-body row g-2'
            >
                <div class='col-12'>
                    <TablerPillGroup
                        :model-value='typeof editLease.proxy === "string" ? "proxy" : "host"'
                        :options='[
                            { value: "host", label: "Hosted Stream URL" },
                            { value: "proxy", label: "External Stream URL" }
                        ]'
                        padding='p-1'
                        @update:model-value='(v: string) => editLease.proxy = v === "proxy" ? "" : null'
                    >
                        <template #option='{ option }'>
                            <IconDrone
                                v-if='option.value === "host"'
                                v-tooltip='"Provide a stream URL to push data to"'
                                :size='24'
                                stroke='1'
                            />
                            <IconServer
                                v-else
                                v-tooltip='"Pull from existing external Stream URL"'
                                :size='24'
                                stroke='1'
                            />
                            <span class='ms-2'>{{ option.label }}</span>
                        </template>
                    </TablerPillGroup>
                </div>
                <div class='col-12 col-md-8'>
                    <TablerInput
                        v-model='editLease.name'
                        description='The human readable name of the Lease'
                        :disabled='disabled'
                        :required='true'
                        label='Name'
                    />
                </div>
                <div class='col-12 col-md-4'>
                    <div class='row g-2'>
                        <div :class='durationUnit === "Permanent" ? "col-12" : "col-7"'>
                            <TablerEnum
                                v-model='durationUnit'
                                :options='durationUnits'
                                :disabled='disabled'
                                label='Duration'
                                description='Leases remain active on the server for the duration specified. Once the lease expires the lease can be renewed without the Lease URL changing'
                            />
                        </div>
                        <div
                            v-if='durationUnit !== "Permanent"'
                            class='col-5'
                        >
                            <TablerInput
                                v-model='durationValue'
                                type='integer'
                                min='1'
                                :disabled='disabled'
                                label='Value'
                                @keydown='digitsOnly'
                            />
                        </div>
                    </div>
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='editLease.source_type'
                        default='unknown'
                        :options='[
                            "unknown",
                            "fixed",
                            "vehicle",
                            "screenshare",
                            "personal",
                            "rotor",
                            "fixedwing",
                            "uas-rotor",
                            "uas-fixedwing"
                        ]'
                        :disabled='disabled'
                        label='Source Type'
                        description='The type of sensor that is broadcasting'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='editLease.source_model'
                        :disabled='disabled'
                        label='Source Model'
                        description='Model Information about the sensor or source'
                    />
                </div>
                <div
                    v-if='typeof editLease.proxy === "string"'
                    class='col-12'
                >
                    <TablerInput
                        v-model='editLease.proxy'
                        :disabled='disabled'
                        label='Media URL'
                        :required='true'
                        :error='validateURL(editLease.proxy, { protocols: ["http", "https", "rtsp", "rtsps", "rtmp", "rtmps", "srt"] })'
                        description='Pull media into the Video Manager from an existing URL.'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerToggle
                        v-model='editLease.publish'
                        label='Publish to TAK Server'
                        :disabled='disabled'
                        description='Publish the non-geolocated Video Stream to the Video Manager'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerToggle
                        v-model='editLease.recording'
                        label='Record Stream'
                        :disabled='disabled'
                        description='Record stream when it is broadcasting'
                    />
                </div>
                <div
                    v-if='typeof editLease.proxy !== "string"'
                    class='col-12 col-md-6'
                >
                    <TablerToggle
                        v-model='secure'
                        label='Read/Write Security'
                        :disabled='disabled'
                        description='Create a seperate Read/Write user to ensure unauthorized users cannot publish to a stream'
                    />
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='editLease.share'
                        description='By default only the user that created a Lease can manage it. If you are operating as part of an agency, turn on Lease Sharing to allow all users in your Channel to manage the lease'
                        :disabled='disabled'
                        label='Shared Lease'
                    />
                </div>
                <div
                    v-if='editLease.share || editLease.publish'
                    class='col-12'
                >
                    <div
                        v-if='!disabled'
                        style='height: 20vh; min-height: 200px; overflow-y: auto;'
                    >
                        <GroupSelect
                            v-model='channels'
                            :limit='1'
                        />
                    </div>
                    <div
                        v-else
                        class='border border-white rounded px-2 py-2'
                    >
                        <IconAffiliate
                            :size='32'
                            stroke='1'
                        /> <span v-text='editLease.channel' />
                    </div>
                </div>
            </div>
            <div class='modal-footer d-flex'>
                <button
                    v-if='!disabled'
                    class='btn btn-secondary'
                    @click='emit("close")'
                >
                    Cancel
                </button>

                <div class='ms-auto btn-list'>
                    <button
                        v-if='Object.keys(protocols).length'
                        class='btn btn-secondary'
                        @click='showProtocolInfo = true'
                    >
                        <IconInfoCircle
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Video Protocol Info</span>
                    </button>
                    <button
                        v-if='protocols.rtsp && !expired(editLease.expiration)'
                        class='btn btn-secondary'
                        @click='wizard = 1'
                    >
                        <IconWand
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>UAS Tool Guide</span>
                    </button>
                    <button
                        v-if='!disabled'
                        class='btn btn-primary'
                        @click='saveLease'
                    >
                        Save
                    </button>
                    <button
                        v-if='disabled'
                        class='btn btn-primary'
                        @click='emit("close")'
                    >
                        Done
                    </button>
                </div>
            </div>
        </template>

        <!-- Recording not included in plan — upsell overlay -->
        <div
            v-if='showRecordingUpsell'
            class='d-flex align-items-center justify-content-center'
            style='position: fixed; inset: 0; z-index: 10500; background: rgba(0, 0, 0, 0.6);'
            @click.self='showRecordingUpsell = false'
        >
            <div
                class='card mx-3'
                style='max-width: 420px;'
            >
                <div class='card-body text-center py-4'>
                    <IconVideoOff
                        :size='48'
                        stroke='1'
                        class='text-secondary'
                    />
                    <h3 class='mt-3'>
                        Recording Not Available
                    </h3>
                    <div
                        class='text-secondary'
                        v-text='recordingMessage'
                    />
                </div>
                <div class='card-footer d-flex justify-content-center'>
                    <button
                        class='btn btn-primary'
                        style='width: 120px;'
                        @click='showRecordingUpsell = false'
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>

        <!-- Video protocol reference guide -->
        <div
            v-if='showProtocolInfo'
            class='d-flex align-items-center justify-content-center'
            style='position: fixed; inset: 0; z-index: 10500; background: rgba(0, 0, 0, 0.6);'
            @click.self='showProtocolInfo = false'
        >
            <div
                class='card mx-3'
                style='max-width: 640px; max-height: 85vh; display: flex; flex-direction: column;'
            >
                <div class='card-header'>
                    <IconInfoCircle
                        :size='24'
                        stroke='1'
                    />
                    <h3 class='card-title ms-2 mb-0'>
                        Video Protocol Guide
                    </h3>
                </div>
                <div
                    class='card-body'
                    style='overflow-y: auto;'
                >
                    <div
                        v-for='(info, key) in protocolInfo'
                        :key='key'
                        class='mb-3'
                    >
                        <div class='mb-1'>
                            <strong>{{ info.name }}</strong>
                            <span class='text-secondary'>&mdash; {{ info.full }}</span>
                        </div>
                        <div class='text-secondary'>
                            {{ info.body }}
                        </div>
                    </div>
                    <hr class='my-2'>
                    <div class='small'>
                        <strong>Encryption:</strong>
                        Only <strong>SRT</strong> can encrypt the media itself &mdash; enable
                        <strong>Read/Write Security</strong> to generate a passphrase. For
                        confidentiality on the other protocols, stream over the
                        <strong>VPN</strong>.
                    </div>
                </div>
                <div class='card-footer d-flex justify-content-center'>
                    <button
                        class='btn btn-primary'
                        style='width: 120px;'
                        @click='showProtocolInfo = false'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { server, std } from '../../../../std.ts';
import { validateURL } from '../../../../base/validators.ts';
import CopyField from '../../util/CopyField.vue';
import { ref, watch, computed, nextTick, onMounted } from 'vue';
import type { paths } from '@cloudtak/api-types';
import type { VideoLease, VideoLeaseProtocols } from '../../../../types.ts';
import VideoLeaseSourceType from '../../util/VideoLeaseSourceType.vue'
import GroupSelect from '../../../util/GroupSelect.vue';
import {
    IconDrone,
    IconServer,
    IconPencil,
    IconVideoOff,
    IconWand,
    IconArrowsLeftRight,
    IconBook2,
    IconAffiliate,
    IconChevronRight,
    IconChevronLeft,
    IconInfoCircle,
} from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerIconButton,
    TablerLoading,
    TablerToggle,
    TablerAlert,
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete,
    TablerPillGroup
} from '@tak-ps/vue-tabler'

const props = withDefaults(defineProps<{
    lease: VideoLease,
    isSystemAdmin?: boolean
}>(), {
    isSystemAdmin: false
});

const emit = defineEmits([ 'close', 'refresh' ])

const mode = ref('read');
const loading = ref(true);
const secure = ref(false);
const disabled = ref(true);
const wizard = ref(0);
const showProtocolInfo = ref(false);
const protocols = ref<VideoLeaseProtocols>({});

// Per-protocol guidance shown in the Video Protocol Info modal.
const protocolInfo: Record<string, { name: string; full: string; body: string }> = {
    rtsp: {
        name: 'RTSP',
        full: 'Real-Time Streaming Protocol',
        body: 'Low latency (~0.5–2s) and the native language of most IP cameras and ATAK. Transported over TCP here. Not encrypted on its own — enable Read/Write Security for auth and run it inside the VPN for confidentiality.',
    },
    rtmp: {
        name: 'RTMP',
        full: 'Real-Time Messaging Protocol',
        body: 'The most compatible option for publishing from OBS and phone streaming apps. Higher latency (~2–5s). Always cleartext — credentials and video are unencrypted, so use the VPN for sensitive feeds.',
    },
    srt: {
        name: 'SRT',
        full: 'Secure Reliable Transport',
        body: 'Best for unreliable / cellular uplinks: UDP with retransmission and jitter buffering. The only protocol here that can AES-encrypt the media itself — turn on Read/Write Security to generate a passphrase and encrypt end-to-end.',
    },
    hls: {
        name: 'HLS',
        full: 'HTTP Live Streaming',
        body: 'Plays in any browser and the Video Wall, and passes through firewalls (just HTTPS). Viewing only — you cannot publish to it — and latency is high (~6–30s). Encrypted in transit via HTTPS.',
    },
};

const channels = ref<string[]>([]);

// Plan entitlement — instances managed by an external entitlement API may not
// allow recording. Defaults to allowed (self-hosted / fetch failure). The
// toggle stays visible; flipping it without entitlement reverts the value and
// shows an upsell overlay with the API-supplied message.
const allowRecording = ref(true);
const recordingMessage = ref('Your current plan does not include video recording.');
const showRecordingUpsell = ref(false);

// Duration = unit + numeric value (e.g. 12 Hours, 7 Days). Permanent is
// restricted server-side to system admins, so it's only offered to them.
const durationUnit = ref<string>('Hours');
const durationValue = ref<number | string>(16);
const durationUnits = computed(() => props.isSystemAdmin ? ['Hours', 'Days', 'Permanent'] : ['Hours', 'Days']);

type VideoLeaseCreateBody = paths['/api/video/lease']['post']['requestBody']['content']['application/json'];
type VideoLeaseUpdateBody = paths['/api/video/lease/{:lease}']['patch']['requestBody']['content']['application/json'];
type VideoLeaseSourceTypeValue = NonNullable<VideoLeaseCreateBody['source_type']>;

const editLease = ref<{
    id?: number
    name: string
    recording: boolean
    publish: boolean
    share: boolean
    channel: string | null
    source_type: VideoLeaseSourceTypeValue
    source_model: string
    proxy?: string | null
    expiration?: string | null
    stream_user: string | null
    stream_pass: string | null
    read_user: string | null
    read_pass: string | null
    srt_pass: string | null
}>({
    name: '',
    channel: null,
    recording: false,
    publish: false,
    share: true,
    source_type: 'unknown',
    source_model: '',
    stream_user: '',
    stream_pass: '',
    read_user: '',
    read_pass: '',
    srt_pass: ''
});

// Must be registered AFTER editLease is declared — watch() reads the source
// getter synchronously at setup, and a forward reference to editLease throws
// a TDZ ReferenceError that crashes the whole modal.
//
// The revert must wait for the "true" state to render first: reverting
// synchronously means the value ends the tick unchanged, Vue skips the patch,
// and the DOM checkbox (already flipped by the click) stays visually on.
watch(() => editLease.value.recording, async (recording) => {
    if (recording && !allowRecording.value) {
        showRecordingUpsell.value = true;
        await nextTick();
        editLease.value.recording = false;
    }
});

onMounted(async () => {
    try {
        const ent = await std('/api/video/entitlement') as { managed: boolean; recording: boolean; recording_message: string | null };
        if (ent.managed && !ent.recording) {
            allowRecording.value = false;
            if (ent.recording_message) recordingMessage.value = ent.recording_message;
        }
    } catch (err) {
        console.error('Failed to fetch video entitlement', err);
    }

    if (props.lease.id) {
        editLease.value = { ...props.lease };

        await fetchLease();
    } else {
        disabled.value = false;
    }

    loading.value = false
});

function expired(expiration?: string | null) {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

// Duration value accepts digits only — number inputs still allow e/+/-/.
function digitsOnly(event: KeyboardEvent) {
    if (event.key.length === 1 && !/[0-9]/.test(event.key) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
    }
}

function leaseDurationSeconds(): number {
    if (durationUnit.value === 'Permanent') return 0;

    const value = Math.max(1, Math.floor(Number(durationValue.value) || 1));
    return durationUnit.value === 'Days'
        ? value * 24 * 60 * 60
        : value * 60 * 60;
}

function leaseProxy(): string | undefined {
    if (typeof editLease.value.proxy !== 'string') return undefined;

    return editLease.value.proxy;
}

async function fetchLease() {
    loading.value = true;

    disabled.value = true;

    const res = await server.GET('/api/video/lease/{:lease}', {
        params: {
            path: {
                ':lease': editLease.value.id as number
            }
        }
    });
    if (res.error) throw new Error(res.error.message);

    editLease.value = { ...res.data };

    if (!res.data.expiration) {
        durationUnit.value = 'Permanent';
    } else if (durationUnit.value === 'Permanent') {
        durationUnit.value = 'Hours';
        durationValue.value = 16;
    }

    if (editLease.value.stream_user && editLease.value.read_user) {
        secure.value = true;
    } else {
        secure.value = false;
    }

    if (editLease.value.channel) {
        channels.value = [ editLease.value.channel ];
    } else {
        channels.value = [];
    }

    const resMetadata = await server.GET('/api/video/lease/{:lease}/metadata', {
        params: {
            path: {
                ':lease': editLease.value.id as number
            }
        }
    });
    if (resMetadata.error) throw new Error(resMetadata.error.message);

    protocols.value = resMetadata.data.protocols;

    disabled.value = true;
    loading.value = false;
}

async function deleteLease() {
    try {
        loading.value = true;

        const res = await server.DELETE('/api/video/lease/{:lease}', {
            params: {
                path: {
                    ':lease': editLease.value.id as number
                }
            }
        });
        if (res.error) throw new Error(res.error.message);

        loading.value = false;

         emit('refresh');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveLease() {
    try {
        loading.value = true;

        if (editLease.value.id) {
            const body: VideoLeaseUpdateBody = {
                name: editLease.value.name,
                secure: secure.value,
                proxy: leaseProxy(),
                channel: channels.value.length ? channels.value[0] : null,
                duration: leaseDurationSeconds(),
                permanent: durationUnit.value === 'Permanent',
                recording: editLease.value.recording,
                publish: editLease.value.publish,
                share: editLease.value.share,
                source_type: editLease.value.source_type,
                source_model: editLease.value.source_model,
            };

            const res = await server.PATCH('/api/video/lease/{:lease}', {
                params: {
                    path: {
                        ':lease': editLease.value.id
                    }
                },
                body
            });
            if (res.error) throw new Error(res.error.message);
        } else {
            const body: VideoLeaseCreateBody = {
                name: editLease.value.name,
                ephemeral: false,
                secure: secure.value,
                channel: channels.value.length ? channels.value[0] : null,
                proxy: leaseProxy(),
                duration: leaseDurationSeconds(),
                permanent: durationUnit.value === 'Permanent',
                recording: editLease.value.recording,
                publish: editLease.value.publish,
                share: editLease.value.share,
                source_type: editLease.value.source_type,
                source_model: editLease.value.source_model,
            };

            const res = await server.POST('/api/video/lease', {
                body
            });
            if (res.error) throw new Error(res.error.message);
            editLease.value.id = res.data.id;
        }

        await fetchLease();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
