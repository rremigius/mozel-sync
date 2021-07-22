import {io, Socket} from "socket.io-client"
import MozelSync from "./MozelSync";
import Log from "log-control";
import {call} from "./utils";
import Mozel from "mozel";

const log = Log.instance("mozel-sync-client");

export default class MozelSyncClient {
	protected _io:Socket;
	get io() { return this._io };

	readonly model:Mozel;
	readonly sync:MozelSync;

	private connecting = {resolve:(id:string)=>{}, reject:(err:Error)=>{}};
	private destroyCallbacks:Function[];
	private server:string;
	private sessionOwner:boolean = false;
	private _session?:string;
	get session() { return this._session; }
	private _serverSyncId?:string;
	get serverSyncId() { return this._serverSyncId }

	constructor(model:Mozel, server:string, session?:string) {
		this.model = model;
		this._session = session;
		this.sync = this.createSync(model);
		this.sync.syncRegistry(model.$registry);

		this.server = server;
		const url = session ? `${server}/${session}` : server;
		this._io = io(url);

		this.destroyCallbacks = [];

		this.initIO();
	}

	initIO() {
		this.io.on('session-created', session => {
			this._session = session.id;
			this.sessionOwner = true;
			this.disconnect();

			// Redirect to namespace
			this._io = io(this.server + '/' + session.id);
			this.initIO();
			this._io.connect();
		});
		this.io.on('connection', event => {
			log.info(`MozelSyncClient connected to server: ${event.serverSyncId}`);
			this.sync.id = event.id;
			this._serverSyncId = event.serverSyncId;
			if(this.sessionOwner) {
				this.sendFullState();
			}
			this.connecting.resolve(event.id);
			this.onConnected(event.id);
		});
		this.io.on('error', error => {
			log.error("Could not connect:", error);
			this.connecting.reject(error);
		})
		this.io.on('push', commits => {
			for(let gid of Object.keys(commits)) {
				// Exclude own commits
				if(commits[gid].syncID === this.sync.id) {
					delete commits[gid];
				}
			}
			if(!Object.keys(commits).length) return;

			log.info(`Received new commits:`, Object.keys(commits));
			this.sync.merge(commits);
			log.log(`Changes merged. New model:`, this.sync.model);
		});
		this.io.on('full-state', state => {
			log.info(`Received full state from server.`, state);
			this.sync.setFullState(state);
			log.log(`New state:`, this.sync.model);
		});
		this.io.on('message', message => {
			log.info("Received message:", message);
			this.onMessageReceived(message);
		});
		this.destroyCallbacks.push(
			this.sync.events.newCommits.on(event => {
				log.info(`Pushing new commits:`, Object.keys(event.commits));
				this.io.emit('push', event.commits);
			})
		);
	}

	createSync(model:Mozel) {
		return new MozelSync(model, {autoCommit: 100});
	}

	async start() {
		this.sync.start();
		await this.connect();
		log.info("MozelSyncClient started.");
	}

	message(payload:any) {
		this.io.emit('message', payload);
	}

	onMessageReceived(payload:unknown) {
		// for override
	}

	sendFullState() {
		const state = this.sync.createFullState();
		log.log(`Sending full state to server:`, state);
		this.io.emit('full-state', state);
	}

	connect() {
		this.io.connect();
		return new Promise((resolve, reject) => {
			this.connecting.resolve = resolve;
			this.connecting.reject = reject;
		});
	}

	disconnect() {
		this.io.disconnect();
		this.onDisconnected(this.sync.id);
	}

	onConnected(id:string) {
		// For override
	}

	onDisconnected(id:string) {
		// For override
	}

	destroy() {
		this.destroyCallbacks.forEach(call);
		this.onDestroy();
	}

	onDestroy() {
		// For override
	}
}
