import { alphanumeric } from "validation-kit";
import EventInterface from "event-interface-mixin";
import { Commit, MozelWatcher } from "./MozelWatcher";
import Mozel, { Registry } from "mozel";
import { MozelData } from "mozel/dist/Mozel";
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
    private newPropertyMozels;
    private watchers;
    private unRegisterCallbacks;
    private destroyCallbacks;
    private registry?;
    private model;
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
    createFullState(): import("mozel/dist/Mozel").Data;
    hasChanges(): boolean;
    setFullState(state: MozelData<any>): void;
    commit(): Record<alphanumeric, Commit>;
    /**
     * Merges the given updates for each MozelWatcher
     * @param updates
     */
    merge(updates: Record<alphanumeric, Commit>): Record<alphanumeric, Commit>;
    getWatcher(gid: alphanumeric): MozelWatcher;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(destroyMozels?: boolean): void;
}
