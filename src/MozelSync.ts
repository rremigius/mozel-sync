import {alphanumeric} from "validation-kit";
import EventInterface from "event-interface-mixin";
import {v4 as uuid} from "uuid";
import Log from "./log";
import {Commit, MozelWatcher} from "./MozelWatcher";
import {call, find, forEach, isNumber, map, mapValues, throttle, values} from "./utils";
import Mozel, {MozelFactory, Registry} from "mozel";
import {MozelData} from "mozel/dist/Mozel";

const log = Log.instance("mozel-sync");

export class MozelSyncNewCommitsEvent {
	constructor(public commits:Record<string, Commit>) {}
}
export class MozelSyncEvents extends EventInterface {
	newCommits = this.$event(MozelSyncNewCommitsEvent);
}

export default class MozelSync {
	private _id = uuid();
	get id() { return this._id; }
	set id(value) {
		this._id = value;
		forEach(this.watchers, watcher => watcher.syncID = this._id)
	}

	private _autoCommit?:number;
	public get autoCommit() { return this._autoCommit }
	public set autoCommit(value) {
		this._autoCommit = value;
		this._commitThrottled = throttle(()=>this.commit(), this._autoCommit, {leading: false});
	}
	private _commitThrottled = ()=>{};
	public get commitThrottled() {
		return this._commitThrottled;
	};

	private mozels:Record<alphanumeric, Mozel> = {};
	private newMozels:Set<alphanumeric> = new Set<alphanumeric>();
	private watchers:Record<alphanumeric, MozelWatcher> = {};
	private unRegisterCallbacks:Record<alphanumeric, Function[]> = {};
	private destroyCallbacks:Function[] = [];
	private registry?:Registry<Mozel>;
	public readonly model:Mozel;
	public readonly historyLength:number;

	private active:boolean = false;
	priority:number;

	public readonly events = new MozelSyncEvents();

	// TODO: create a cheap check to know if models are out of sync

	constructor(model:Mozel, options?:{
		syncRegistry?:boolean,
		priority?:number,
		historyLength?:number,
		autoCommit?:number
	}) {
		const $options = options || {};
		this.priority = $options.priority || 0;
		this.historyLength = isNumber($options.historyLength) ? $options.historyLength : 20;

		this.autoCommit = $options.autoCommit;

		this.model = model;
		this.register(model);
		if($options.syncRegistry) {
			this.syncRegistry(model.$registry);
		}
	}

	/**
	 * Determines whether or not a Mozel should be registered and watched by this MozelSync.
	 * Can be overridden for application-specific control. Defaults to always-true.
	 * @param mozel
	 */
	shouldRegister(mozel:Mozel) {
		return true;
	}

	/**
	 * Determines whether or not a Mozel should be synced (both up and down) by this MozelSync.
	 * Can be overridden for application-specific control. Defaults to always-true.
	 * @param mozel
	 * @param syncID
	 */
	shouldSync(mozel:Mozel, syncID:string) {
		return true;
	}

	createFullState() {
		const state:Record<alphanumeric, Commit> = {};
		forEach(this.watchers, (watcher, gid) => {
			if(!this.shouldSync(watcher.model, this.id)) return;
			state[gid] = watcher.createFullState();
		});
		return state;
	}

	hasChanges() {
		return !!find(this.watchers, watcher => this.shouldSync(watcher.model, this.id) && watcher.hasChanges());
	}

	commit() {
		const updates:Record<alphanumeric, Commit> = {};
		forEach(this.watchers, watcher => {
			if(!this.shouldSync(watcher.model, this.id)) return;

			const update = watcher.commit();
			if(!update) return;

			updates[watcher.model.gid] = update;
		});
		this.newMozels.clear();
		this.events.newCommits.fire(new MozelSyncNewCommitsEvent(updates));
		log.log("Committing changes to:", Object.keys(updates));
		return updates;
	}

	/**
	 * Executes the given callback in an order that should allow watchers to be created and available by the time
	 * the commit can be handled. Works only for callbacks that will somehow initialize watchers based on commits (e.g. merge)
	 * @param commits
	 * @param callback
	 */
	commitsOrderedForWatchers(commits:Record<alphanumeric, Commit>, callback:(watcher:MozelWatcher, commit:Commit)=>void) {
		/*
		We are not sure in which order updates should be applied: the Mozel may not have been created yet before
		we want to set its data. So we delay setting data and try again next loop, until we finish the queue or it will
		not get smaller.
		 */
		let queue:(Commit & {gid:alphanumeric})[] = [];
		forEach(commits, (update, gid) => {
			queue.push({gid, ...update});
		});

		while(Object.keys(queue).length) {
			let newQueue:(Commit & {gid:alphanumeric})[] = [];
			for(let commit of queue) {
				const watcher = this.watchers[commit.gid];
				if(!watcher) {
					newQueue.push(commit);
					continue;
				}
				callback(watcher, commit);
			}
			if(newQueue.length === queue.length) {
				log.log(`Skipped ${queue.length} commits their GIDs are not registered in this MozelSync:`, Object.keys(queue));
				break;
			} // no more progress
			queue = newQueue;
		}
	}

	/**
	 * Merges the given commits for each MozelWatcher
	 * @param commits
	 */
	merge(commits:Record<alphanumeric, Commit>) {
		log.log("Merging commits:", Object.keys(commits));
		const merges:Record<alphanumeric, Commit> = {}
		this.commitsOrderedForWatchers(commits, (watcher, commit) => {
			if(!this.shouldSync(watcher.model, commit.syncID)) return;

			merges[watcher.model.gid] = {...watcher.merge(commit), priority: this.priority};
		});
		return merges;
	}

	setFullState(commits:Record<alphanumeric, Commit>) {
		log.log("Setting full state:", Object.keys(commits));
		this.commitsOrderedForWatchers(commits, (watcher, commit) => {
			if(!this.shouldSync(watcher.model, commit.syncID)) return;

			watcher.setFullState(commit);
		});
	}

	getWatcher(gid:alphanumeric) {
		return this.watchers[gid];
	}

	register(mozel:Mozel) {
		if(this.mozels[mozel.gid]) return; // already registered

		const watcher = new MozelWatcher(mozel, {
			syncID: this.id,
			priority: this.priority,
			historyLength: this.historyLength
		});
		this.mozels[mozel.gid] = mozel;
		if(!mozel.$root) this.newMozels.add(mozel.gid);

		this.watchers[mozel.gid] = watcher;
		this.unRegisterCallbacks[mozel.gid] = [
			mozel.$events.destroyed.on(()=>this.unregister(mozel)),
			watcher.events.changed.on(()=>{
				if(isNumber(this.autoCommit)) this.commitThrottled();
			})
		];
		if(this.active) watcher.start();
	}

	unregister(mozel:Mozel) {
		if(!(mozel.gid in this.watchers)) return;

		this.watchers[mozel.gid].destroy();
		delete this.watchers[mozel.gid];
		delete this.mozels[mozel.gid];
		this.newMozels.delete(mozel.gid);
		this.unRegisterCallbacks[mozel.gid].forEach(call);
	}

	has(mozel:Mozel) {
		return !!this.mozels[mozel.gid];
	}

	syncRegistry(registry:Registry<Mozel>) {
		if(this.registry) throw new Error("Cannot switch Registry for MozelSync.");

		this.registry = registry;
		this.destroyCallbacks = [
			...this.destroyCallbacks,
			registry.events.added.on(event => {
				const model = event.item as Mozel;
				if(this.shouldRegister(model)) this.register(model);
			}),
			registry.events.removed.on(event => this.unregister(event.item as Mozel))
		]
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
			this.unregister(watcher.model);
			if(destroyMozels) watcher.model.$destroy();
		});
	}
}
