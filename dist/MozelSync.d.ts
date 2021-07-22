import { alphanumeric } from "validation-kit";
import EventInterface from "event-interface-mixin";
import { Commit, MozelWatcher } from "./MozelWatcher";
import Mozel, { Registry } from "mozel";
export declare class MozelSyncNewCommitsEvent {
    commits: Record<string, Commit>;
    constructor(commits: Record<string, Commit>);
}
export declare class MozelSyncEvents extends EventInterface {
    newCommits: import("event-interface-mixin").EventEmitter<MozelSyncNewCommitsEvent>;
}
export default class MozelSync {
    private _id;
    get id(): string;
    set id(value: string);
    private _autoCommit?;
    get autoCommit(): number | undefined;
    set autoCommit(value: number | undefined);
    private _commitThrottled;
    get commitThrottled(): () => void;
    private mozels;
    private watchers;
    private unRegisterCallbacks;
    private destroyCallbacks;
    private registry?;
    readonly model: Mozel;
    readonly historyLength: number;
    private active;
    priority: number;
    readonly events: MozelSyncEvents;
    constructor(model: Mozel, options?: {
        syncRegistry?: boolean;
        priority?: number;
        historyLength?: number;
        autoCommit?: number;
    });
    /**
     * Determines whether or not a Mozel should be registered and watched by this MozelSync.
     * Can be overridden for application-specific control. Defaults to always-true.
     * @param mozel
     */
    shouldRegister(mozel: Mozel): boolean;
    /**
     * Determines whether or not a Mozel should be synced (both up and down) by this MozelSync.
     * Can be overridden for application-specific control. Defaults to always-true.
     * @param mozel
     * @param syncID
     */
    shouldSync(mozel: Mozel, syncID: string): boolean;
    createFullState(): Record<alphanumeric, Commit>;
    hasChanges(): boolean;
    commit(): Record<alphanumeric, Commit>;
    /**
     * Executes the given callback in an order that should allow watchers to be created and available by the time
     * the commit can be handled. Works only for callbacks that will somehow initialize watchers based on commits (e.g. merge)
     * @param commits
     * @param callback
     */
    commitsOrderedForWatchers(commits: Record<alphanumeric, Commit>, callback: (watcher: MozelWatcher, commit: Commit) => void): void;
    /**
     * Merges the given commits for each MozelWatcher
     * @param commits
     * @param force		If `true`, will sync all commits without calling `shouldSync`.
     */
    merge(commits: Record<alphanumeric, Commit>, force?: boolean): Record<alphanumeric, Commit>;
    /**
     * Set the full state of the given commits (does not merge).
     * @param commits
     * @param force		If `true`, will set state regardless of `shouldSync`.
     */
    setFullState(commits: Record<alphanumeric, Commit>, force?: boolean): void;
    getWatcher(gid: alphanumeric): MozelWatcher;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(destroyMozels?: boolean): void;
}
