import Err from '@openaddresses/batch-error';
import { sql } from 'drizzle-orm';
import type Config from './config.js';

/**
 * Optional external entitlement service for video leases.
 *
 * Managed deployments can set ENTITLEMENT_API_URL + ENTITLEMENT_API_TOKEN in
 * the environment to have lease creation (count limits) and stream recording
 * gated by an external policy API. Self-hosted installs leave these unset and
 * are completely unaffected.
 *
 * The API contract is a single endpoint:
 *
 *   GET {ENTITLEMENT_API_URL}/api/cloudtak/entitlement?username=<username>
 *   Authorization: Bearer {ENTITLEMENT_API_TOKEN}
 *
 *   => { plan: string, shared: boolean, max_leases: number | null,
 *        recording: boolean, usernames: string[] | null }
 */

export interface VideoEntitlement {
    plan: string;
    /** True when this instance is multi-tenant (limits are per account, not per instance). */
    shared: boolean;
    max_leases: number | null;
    recording: boolean;
    /** API-supplied text shown to users whose plan does not include recording. */
    recording_message?: string | null;
    /** All usernames belonging to the same account (shared instances only) — leases are counted across them. */
    usernames: string[] | null;
}

const FRESH_MS = 60 * 1000; // serve from cache without refetching
const STALE_OK_MS = 15 * 60 * 1000; // serve stale cache if the API is unreachable
const FETCH_TIMEOUT_MS = 5 * 1000;

const cache = new Map<string, { ent: VideoEntitlement; at: number }>();

export default class Entitlement {
    static configured(): boolean {
        return !!(process.env.ENTITLEMENT_API_URL && process.env.ENTITLEMENT_API_TOKEN);
    }

    /**
     * Entitlement for a CloudTAK username. Returns null when no entitlement
     * API is configured (no enforcement). Throws 503 if the API cannot be
     * reached and no recent cached answer exists.
     */
    static async entitlement(username: string): Promise<VideoEntitlement | null> {
        if (!this.configured()) return null;

        const now = Date.now();
        const cached = cache.get(username);
        if (cached && now - cached.at < FRESH_MS) return cached.ent;

        try {
            const url = new URL('/api/cloudtak/entitlement', process.env.ENTITLEMENT_API_URL);
            if (username) url.searchParams.set('username', username);

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${process.env.ENTITLEMENT_API_TOKEN}` },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!res.ok) throw new Error(`Entitlement request failed: ${res.status}`);

            const ent = await res.json() as VideoEntitlement;
            cache.set(username, { ent, at: now });
            return ent;
        } catch (err) {
            if (cached && now - cached.at < STALE_OK_MS) return cached.ent;
            console.error('[entitlement] fetch failed:', err);
            throw new Err(503, new Error(String(err)), 'Could not verify your plan\'s video entitlements — please try again shortly');
        }
    }

    /**
     * Active (non-expired) non-ephemeral leases counted against the entitlement.
     * Shared instances count across every username in the account; dedicated
     * instances count instance-wide (single tenant).
     */
    static async countLeases(config: Config, ent: VideoEntitlement, username: string): Promise<number> {
        if (ent.shared) {
            const owners = (ent.usernames && ent.usernames.length) ? ent.usernames : [username];
            return await config.models.VideoLease.count({
                where: sql`
                    ephemeral = False
                    AND (expiration IS NULL OR expiration > Now())
                    AND username IN ${owners}
                `,
            });
        } else {
            return await config.models.VideoLease.count({
                where: sql`
                    ephemeral = False
                    AND (expiration IS NULL OR expiration > Now())
                `,
            });
        }
    }

    /**
     * Gate for lease create/update. No-op when no entitlement API is
     * configured or the caller is a system admin.
     *
     * `username` is null for machine-token (connection) callers — those can
     * only exist via admin-managed connections, so on shared instances they
     * are not attributable to an account and pass through; on dedicated
     * instances the plan limits still apply instance-wide.
     */
    static async enforce(config: Config, opts: {
        username: string | null;
        isSystemAdmin: boolean;
        creating: boolean;
        ephemeral?: boolean;
        recording?: boolean;
    }): Promise<void> {
        if (!this.configured() || opts.isSystemAdmin) return;

        const ent = await this.entitlement(opts.username ?? '');
        if (!ent) return;
        if (ent.shared && !opts.username) return;

        if (opts.recording && !ent.recording) {
            throw new Err(403, null, ent.recording_message ?? `The ${ent.plan} plan does not include video recording — upgrade your plan to record streams`);
        }

        // Ephemeral "view" leases (created when watching a stream) never count
        // against the plan limit.
        if (opts.creating && !opts.ephemeral && ent.max_leases !== null) {
            if (ent.max_leases <= 0) {
                throw new Err(403, null, 'Your account does not include video leases');
            }

            const used = await this.countLeases(config, ent, opts.username ?? '');
            if (used >= ent.max_leases) {
                throw new Err(403, null, `The ${ent.plan} plan allows ${ent.max_leases} video lease${ent.max_leases === 1 ? '' : 's'} — delete an existing lease to create a new one`);
            }
        }
    }
}
