import { Static } from '@sinclair/typebox';
import { CloudTAKRemotePath, Path } from './types.js';

export function isHLSPath(source: string | null | undefined): boolean {
    if (!source) return false;
    return source.startsWith('http');
}

export function createPayload(path: Static<typeof CloudTAKRemotePath>): Static<typeof Path> {
    // takserver.host override: when the lease carries an SRT passphrase (Read/Write
    // Security on), enable AES encryption on the MediaMTX path for both publish and
    // read. Omitted entirely when null so unsecured streams stay unencrypted.
    const encryption = path.srt_pass
        ? { srtReadPassphrase: path.srt_pass, srtPublishPassphrase: path.srt_pass }
        : {};

    if (path.proxy) {
        return {
            name: path.path,
            record: path.recording,
            source: path.proxy,
            sourceOnDemand: true,
            ...encryption
        };
    } else {
        return {
            name: path.path,
            record: path.recording,
            ...encryption
        };
    }
}
