import EventInterface from "event-interface-mixin";
import Mozel from "mozel";
import Property, { PropertyValue } from "mozel/dist/Property";
export declare type Changes = Record<string, any>;
export declare class OutdatedUpdateError extends Error {
    baseVersion: number;
    requiredVersion: number;
    constructor(baseVersion: number, requiredVersion: number);
}
export declare type Commit = {
    uuid: string;
    syncID: string;
    version: number;
    priority: number;
    changes: Changes;
};
export declare class MozelWatcherChangedEvent {
    changePath: string;
    constructor(changePath: string);
}
export declare class MozelWatcherEvents extends EventInterface {
    changed: import("event-interface-mixin").EventEmitter<MozelWatcherChangedEvent>;
}
export declare class MozelWatcher {
    readonly model: Mozel;
    active: boolean;
    private _started;
    private _changes;
    get changes(): Changes;
    private watchers;
    private newModels;
    private modelsInUpdates;
    private stopCallbacks;
    private priority;
    private historyMaxLength;
    private history;
    private historyByUuid;
    private _version;
    get version(): number;
    get historyMinVersion(): number;
    get lastUpdate(): Commit | undefined;
    syncID: string;
    readonly events: MozelWatcherEvents;
    private onDestroyed;
    /**
     *
     * @param mozel
     * @param options
     * 			options.asNewMozel	Function to check whether a Mozel property is new and should be included in full
     */
    constructor(mozel: Mozel, options?: {
        syncID?: string;
        priority?: number;
        historyLength?: number;
    });
    isNewMozel(mozel: Mozel): boolean;
    /**
     * Merges the commit into the current Mozel.
     * Returns the final commit, with all overrides removed, and its own priority applied
     * @param commit
     */
    merge(commit: Commit): Commit;
    setFullState(commit: Commit): void;
    overrideChangesFromHistory(update: Commit): {
        uuid: string;
        syncID: string;
        version: number;
        priority: number;
        changes: Changes;
    };
    /**
     *
     * @param {Changes} changes
     * @param {Changes} override
     */
    removeChanges(changes: Changes, override: Changes): Changes;
    clearChanges(): void;
    getHistory(): Commit[];
    autoCleanHistory(): void;
    hasChanges(): boolean;
    createUpdateInfo(): Commit;
    createFullState(): Commit;
    commit(): Commit | undefined;
    isEqualChangeValue(value1: unknown, value2: unknown): boolean;
    start(includeCurrentState?: boolean): void;
    onPropertyChange(change: {
        newValue: PropertyValue;
        oldValue: PropertyValue;
        valuePath: string;
        changePath: string;
    }): void;
    onCollectionChange(property: Property, change: {
        newValue: PropertyValue;
        oldValue: PropertyValue;
        valuePath: string;
        changePath: string;
    }): void;
    stop(): void;
    destroy(): void;
}
