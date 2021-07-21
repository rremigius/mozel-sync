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
    private newMozels;
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
    createFullState(): {
        [x: string]: Commit;
        [x: number]: Commit;
    };
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
     */
    merge(commits: Record<alphanumeric, Commit>): Record<alphanumeric, Commit>;
    setFullState(commits: Record<alphanumeric, Commit>): void;
    getWatcher(gid: alphanumeric): MozelWatcher;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(destroyMozels?: boolean): void;
}
