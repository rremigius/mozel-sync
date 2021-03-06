import { v4 as uuid } from "uuid";
import EventInterface from "event-interface-mixin";
import Log from "log-control";
import { isPrimitive } from "validation-kit";
import { call, findAllValuesDeep, forEach, get, isArray, isPlainObject, union, pick } from "./utils";
import Mozel, { Collection } from "mozel";
import { shallow } from "mozel/dist/Mozel";
const log = Log.instance("mozel-watcher");
export class OutdatedUpdateError extends Error {
    baseVersion;
    requiredVersion;
    constructor(baseVersion, requiredVersion) {
        super(`Received update has a base version (${baseVersion}) that is lower than any update kept in history (${requiredVersion}). Cannot apply update.`);
        this.baseVersion = baseVersion;
        this.requiredVersion = requiredVersion;
    }
}
export class MozelWatcherChangedEvent {
    changePath;
    constructor(changePath) {
        this.changePath = changePath;
    }
}
export class MozelWatcherEvents extends EventInterface {
    changed = this.$event(MozelWatcherChangedEvent);
}
export class MozelWatcher {
    model;
    active = true;
    _started = false;
    _changes = {};
    get changes() {
        return this._changes;
    }
    watchers = [];
    newModels = new Set();
    modelsInUpdates = new Set();
    stopCallbacks = [];
    priority;
    historyMaxLength;
    history = [];
    historyByUuid = {};
    _version = 0;
    get version() { return this._version; }
    get historyMinVersion() {
        return !this.history.length ? 0 : this.history[0].version;
    }
    get lastUpdate() {
        if (!this.history.length)
            return;
        return this.history[this.history.length - 1];
    }
    syncID;
    events = new MozelWatcherEvents();
    onDestroyed = () => this.destroy();
    /**
     *
     * @param mozel
     * @param options
     * 			options.asNewMozel	Function to check whether a Mozel property is new and should be included in full
     */
    constructor(mozel, options) {
        const $options = options || {};
        this.model = mozel;
        this.model.$events.destroyed.on(this.onDestroyed);
        this.syncID = $options.syncID || uuid();
        this.historyMaxLength = $options.historyLength || 20;
        this.priority = $options.priority || 0;
    }
    isNewMozel(mozel) {
        return this.newModels.has(mozel.gid);
    }
    /*
            Priority: 1										Priority: 2
            {b: 0, foo: 'a'}								{b: 0, foo: 'a'}
            {b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
            {b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
            {b: 1, foo: 'b'}								{b: 1, foo: 'b'}
     */
    /**
     * Merges the commit into the current Mozel.
     * Returns the final commit, with all overrides removed, and its own priority applied
     * @param commit
     */
    merge(commit) {
        if (commit.version < this.historyMinVersion) {
            // We cannot apply changes from before our history, as it would overwrite anything already committed.
            throw new OutdatedUpdateError(commit.version, this.historyMinVersion);
        }
        if (commit.uuid in this.historyByUuid) {
            // We already have this commit; skip
            return commit;
        }
        const overridden = this.overrideChangesFromHistory(commit);
        const gids = findAllValuesDeep(overridden, (value, key) => key === 'gid');
        gids.forEach(value => this.modelsInUpdates.add(value));
        // Update version
        const version = Math.max(overridden.version, this._version);
        this._version = version;
        // Create merge commit, add to history and clean history
        const merged = { ...overridden, changes: overridden.changes, priority: this.priority, version };
        this.history.push(merged);
        this.historyByUuid[merged.uuid] = merged;
        this.autoCleanHistory();
        // Update Mozel
        this.model.$setData(overridden.changes, true);
        return merged;
    }
    setFullState(commit) {
        this.active = false;
        this.model.$setData(commit.changes);
        this.active = true;
        this._version = commit.version;
    }
    overrideChangesFromHistory(update) {
        const override = { ...update };
        const priorityAdvantage = this.priority > update.priority ? 1 : 0;
        // Go through history and current changes (consider current changes as the last item in history
        [...this.history, { version: this._version, changes: this.changes }].forEach(history => {
            // Any update with a higher version than the received update should override the received update
            if (history.version + priorityAdvantage > update.version) {
                const common = union(Object.keys(update.changes), Object.keys(history.changes));
                if (common.length > 0) {
                    log.warn(`Merge conflicts:`, pick(override.changes, common), pick(history.changes, common));
                    override.changes = this.removeChanges(override.changes, history.changes);
                }
            }
        });
        return override;
    }
    /**
     *
     * @param {Changes} changes
     * @param {Changes} override
     */
    removeChanges(changes, override) {
        changes = { ...changes };
        forEach(override, (_, key) => {
            delete changes[key];
        });
        return changes;
    }
    clearChanges() {
        this._changes = {};
        this.newModels.clear();
        this.modelsInUpdates.clear();
    }
    getHistory() {
        return [...this.history];
    }
    autoCleanHistory() {
        if (this.history.length > this.historyMaxLength) {
            const deleteCount = this.history.length - this.historyMaxLength;
            for (let i = 0; i < deleteCount; i++) {
                delete this.historyByUuid[this.history[i].uuid];
            }
            this.history.splice(0, deleteCount);
        }
    }
    hasChanges() {
        return Object.keys(this.changes).length > 0;
    }
    createUpdateInfo() {
        return {
            uuid: uuid(),
            syncID: this.syncID,
            version: this._version,
            priority: this.priority,
            changes: {}
        };
    }
    createFullState() {
        const update = this.createUpdateInfo();
        update.changes = this.model.$export({ shallow });
        return update;
    }
    commit() {
        const update = this.createUpdateInfo();
        update.version++;
        forEach(this.changes, (change, key) => {
            if (change instanceof Mozel) {
                /*
                New mozels we include in full; existing mozels only gid
                If we don't include full export for new Mozels, data may be separated from property assignment
                and receiving MozelSync will not know what to do with the data
                */
                const options = this.isNewMozel(change) ? undefined : { keys: ['gid'] };
                update.changes[key] = change.$export(options);
                return;
            }
            if (change instanceof Collection) {
                if (change.isMozelType()) {
                    update.changes[key] = change.map(mozel => {
                        // New mozels we include in full; existing mozels only gid (see comment above)
                        const options = this.isNewMozel(mozel) ? undefined : { keys: ['gid'] };
                        return mozel.$export(options);
                    });
                    return;
                }
                update.changes[key] = change.export();
                return;
            }
            update.changes[key] = change;
        });
        if (!Object.keys(update.changes).length) {
            return;
        }
        this._version = update.version;
        this.history.push(update);
        this.historyByUuid[update.uuid] = update;
        this.clearChanges();
        return update;
    }
    isEqualChangeValue(value1, value2) {
        if (isPrimitive(value1) || isPrimitive(value2))
            return value1 === value2;
        if (isPlainObject(value1) || value1 instanceof Mozel || isPlainObject(value2) || value2 instanceof Mozel) {
            /*
            If we received a full Mozel as a property, we have initialized the Mozel on our side. As long as we
            don't change the Mozel, we don't need to include it as a change in our next update. We should not
            record it as a new Mozel, though.
             */
            return get(value1, 'gid') === get(value2, 'gid');
        }
        if (value1 instanceof Collection || value2 instanceof Collection || isArray(value1) || isArray(value2)) {
            const arr1 = value1 instanceof Collection ? value1.export({ shallow }) : value1;
            const arr2 = value2 instanceof Collection ? value2.export({ shallow }) : value2;
            if (!isArray(arr1) || !isArray(arr2)) {
                return false;
            }
            if (arr1.length !== arr2.length)
                return false;
            return !arr1.find((item, i) => !this.isEqualChangeValue(item, arr2[i]));
        }
        return false;
    }
    start(includeCurrentState = false) {
        if (this._started)
            return; // already started
        this._started = true;
        this.active = true;
        // Watch property changes
        this.watchers.push(this.model.$watch('*', change => {
            if (!this.active)
                return;
            this.onPropertyChange(change);
        }));
        // Watch collection changes
        this.model.$eachProperty(property => {
            if (!property.isCollectionType())
                return;
            this.watchers.push(this.model.$watch(`${property.name}.*`, change => {
                if (!this.active)
                    return;
                this.onCollectionChange(property, change);
            }));
        });
        // Keep track of newly created Mozels
        this.stopCallbacks.push(this.model.$registry.events.added.on(event => {
            const mozel = event.item;
            if (!(mozel instanceof Mozel) || this.modelsInUpdates.has(mozel.gid))
                return;
            /*
            We only add newly created Mozels that are not already mentioned in updates (we don't need to tell
            the receiver to create the Mozel that they created).
             */
            this.newModels.add(mozel.gid);
        }));
        if (includeCurrentState) {
            this._changes = this.model.$export({ shallow: true, nonDefault: true });
            this.events.changed.fire(new MozelWatcherChangedEvent("*"));
        }
    }
    onPropertyChange(change) {
        const lastUpdate = this.lastUpdate;
        if (lastUpdate && this.isEqualChangeValue(change.newValue, lastUpdate.changes[change.changePath])) {
            // If the change is a direct result of the last update, we don't need to include it in our changes.
            // We don't need to tell whoever sent the update to also apply the same changes of their own update.
            delete this._changes[change.changePath]; // also remove any change if already recorded
            return;
        }
        this._changes[change.changePath] = this.model.$path(change.changePath);
        this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
    }
    onCollectionChange(property, change) {
        const lastUpdate = this.lastUpdate;
        if (lastUpdate && this.isEqualChangeValue(this.model.$get(property.name), lastUpdate.changes[property.name])) {
            // If the change is a direct result of the last update, we don't need to include it in our changes.
            // We don't need to tell whoever sent the update to also apply the same changes of their own update.
            delete this._changes[property.name]; // also remove any change if already recorded
            return;
        }
        this._changes[property.name] = this.model.$get(property.name);
        this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
    }
    stop() {
        for (let watcher of this.watchers) {
            this.model.$removeWatcher(watcher);
        }
        this.stopCallbacks.forEach(call);
    }
    destroy() {
        this.stop();
        this.model.$events.destroyed.off(this.onDestroyed);
    }
}
//# sourceMappingURL=MozelWatcher.js.map