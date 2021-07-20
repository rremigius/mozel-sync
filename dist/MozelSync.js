import EventInterface from "event-interface-mixin";
import { v4 as uuid } from "uuid";
import Log from "./log";
import { MozelWatcher } from "./MozelWatcher";
import { call, find, forEach, isNumber, throttle, values } from "./utils";
const log = Log.instance("mozel-sync");
export class MozelSyncNewCommitsEvent {
    commits;
    constructor(commits) {
        this.commits = commits;
    }
}
export class MozelSyncEvents extends EventInterface {
    newCommits = this.$event(MozelSyncNewCommitsEvent);
}
export default class MozelSync {
    _id = uuid();
    get id() { return this._id; }
    set id(value) {
        this._id = value;
        forEach(this.watchers, watcher => watcher.syncID = this._id);
    }
    _autoCommit;
    get autoCommit() { return this._autoCommit; }
    set autoCommit(value) {
        this._autoCommit = value;
        this._commitThrottled = throttle(() => this.commit(), this._autoCommit, { leading: false });
    }
    _commitThrottled = () => { };
    get commitThrottled() {
        return this._commitThrottled;
    }
    ;
    mozels = {};
    newPropertyMozels = new Set();
    watchers = {};
    unRegisterCallbacks = {};
    destroyCallbacks = [];
    registry;
    model;
    historyLength;
    active = false;
    priority;
    events = new MozelSyncEvents();
    constructor(model, options) {
        const $options = options || {};
        this.priority = $options.priority || 0;
        this.historyLength = isNumber($options.historyLength) ? $options.historyLength : 20;
        this.autoCommit = $options.autoCommit;
        this.model = model;
        this.register(model);
        if ($options.syncRegistry) {
            this.syncRegistry(model.$registry);
        }
    }
    createFullState() {
        return this.model.$export();
    }
    hasChanges() {
        return !!find(this.watchers, watcher => watcher.hasChanges());
    }
    setFullState(state) {
        return this.model.$setData(state);
    }
    commit() {
        const updates = {};
        forEach(this.watchers, watcher => {
            const update = watcher.commit();
            if (!update)
                return;
            updates[watcher.mozel.gid] = update;
        });
        this.newPropertyMozels.clear();
        this.events.newCommits.fire(new MozelSyncNewCommitsEvent(updates));
        log.log("Committing changes to:", Object.keys(updates));
        return updates;
    }
    /**
     * Merges the given updates for each MozelWatcher
     * @param updates
     */
    merge(updates) {
        log.log("Merging changes to:", Object.keys(updates));
        /*
        We are not sure in which order updates should be applied: the Mozel may not have been created yet before
        we want to set its data. So we delay setting data and try again next loop, until we finish the queue or it will
        not get smaller.
         */
        let queue = [];
        forEach(updates, (update, gid) => {
            queue.push({ gid, ...update });
        });
        const merges = {};
        while (Object.keys(queue).length) {
            let newQueue = [];
            for (let update of queue) {
                const watcher = this.watchers[update.gid];
                if (!watcher) {
                    newQueue.push(update);
                    continue;
                }
                merges[update.gid] = watcher.merge(update);
            }
            if (newQueue.length === queue.length)
                break; // no more progress
            queue = newQueue;
        }
        return merges; // return updates with adapted priority
    }
    getWatcher(gid) {
        return this.watchers[gid];
    }
    register(mozel) {
        if (this.mozels[mozel.gid])
            return; // already registered
        const watcher = new MozelWatcher(mozel, {
            syncID: this.id,
            priority: this.priority,
            historyLength: this.historyLength
        });
        this.mozels[mozel.gid] = mozel;
        if (!mozel.$root)
            this.newPropertyMozels.add(mozel.gid);
        this.watchers[mozel.gid] = watcher;
        this.unRegisterCallbacks[mozel.gid] = [
            mozel.$events.destroyed.on(() => this.unregister(mozel)),
            watcher.events.changed.on(() => {
                if (isNumber(this.autoCommit))
                    this.commitThrottled();
            })
        ];
        if (this.active)
            watcher.start();
    }
    unregister(mozel) {
        if (!(mozel.gid in this.watchers))
            return;
        this.watchers[mozel.gid].destroy();
        delete this.watchers[mozel.gid];
        delete this.mozels[mozel.gid];
        this.newPropertyMozels.delete(mozel.gid);
        this.unRegisterCallbacks[mozel.gid].forEach(call);
    }
    has(mozel) {
        return !!this.mozels[mozel.gid];
    }
    syncRegistry(registry) {
        if (this.registry)
            throw new Error("Cannot switch Registry for MozelSync.");
        this.registry = registry;
        this.destroyCallbacks = [
            ...this.destroyCallbacks,
            registry.events.added.on(event => this.register(event.item)),
            registry.events.removed.on(event => this.unregister(event.item))
        ];
        // Also register current Mozels
        registry.all().forEach(mozel => this.register(mozel));
    }
    start() {
        this.active = true;
        forEach(this.watchers, watcher => watcher.start());
    }
    stop() {
        this.active = false;
        forEach(this.watchers, watcher => watcher.stop());
    }
    destroy(destroyMozels = false) {
        this.destroyCallbacks.forEach(call);
        values(this.watchers).forEach(watcher => {
            this.unregister(watcher.mozel);
            if (destroyMozels)
                watcher.mozel.$destroy();
        });
    }
}
//# sourceMappingURL=MozelSync.js.map