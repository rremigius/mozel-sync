import {io, Socket} from "socket.io-client"
import MozelSync from "./MozelSync";
import Log from "log-control";
import {call} from "./utils";
import Mozel from "mozel";

const log = Log.instance("mozel-sync-client");

export enum State {
	DISCONNECTED, CONNECTING, CONNECTED
}
export default class MozelSyncClient {
	protected _io!:Socket;
	get io() { return this._io };

	readonly model:Mozel;
	readonly sync:MozelSync;

	private _connectingPromiseCallbacks = {resolve:(id:string)=>{}, reject:(err:Error)=>{}};
	private _connecting = new Promise((resolve, reject) => {
		this._connectingPromiseCallbacks.resolve = resolve;
		this._connectingPromiseCallbacks.reject = reject;
	});
	get connecting() {
		return this._connecting;
	}

	private _state:State = State.DISCONNECTED;
	get state() { return this._state };

	private destroyCallbacks:Function[];
	private disconnectCallbacks:Function[];
	private server:string;
	private url:string;
	private sessionOwner:boolean = false;
	private _session?:string;
	get session() { return this._session; }
	private _serverSyncID?:string;
	get serverSyncID() { return this._serverSyncID }

	constructor(model:Mozel, server:string, session?:string) {
		this.model = model;
		this._session = session;
		this.sync = this.createSync(model);
		this.sync.syncRegistry(model.$registry);

		this.server = server;
		this.url = session ? `${server}/${session}` : server;

		this.destroyCallbacks = [];
		this.disconnectCallbacks = [];
	}

	setupIO(socket:Socket) {
		socket.on('connection-hub', (hubInfo) => {
			log.info("Connected to hub");
			const config:Record<string, any> = {};
			if(hubInfo.useClientModel) {
				config.state = this.sync.createFullState();
			}
			socket.emit('create-session', config);
		});
		socket.on('session-created', session => {
			log.info("Session created.");
			this._session = session.id;
			this.sessionOwner = true;
			this.disconnect(false);
			this.connect(this.server + '/' + session.id).catch(log.error);
		});
		socket.on('connection', event => {
			log.info(`MozelSyncClient connected to server: ${event.serverSyncID}`);
			this.sync.id = event.id;
			this._serverSyncID = event.serverSyncID;
			this._connectingPromiseCallbacks.resolve(event.id);
			this._state = State.CONNECTED;
			this.onConnected(event.id);
		});
		socket.on('error', error => {
			log.error("Could not connect:", error);
			this._connectingPromiseCallbacks.reject(error);
			this._state = State.DISCONNECTED;
		})
		socket.on('push', commits => {
			for(let gid of Object.keys(commits)) {
				// Exclude own commits
				if(commits[gid].syncID === this.sync.id) {
					delete commits[gid];
				}
			}
			if(!Object.keys(commits).length) return;

			log.info(`Received new commits:`, Object.keys(commits));
			this.sync.merge(commits);
			// log.log(`Changes merged. New model:`, this.sync.model);
		});
		socket.on('full-state', state => {
			log.info(`Received full state from server.`, state);
			this.sync.setFullState(state);
			// log.log(`New state:`, this.sync.model);
		});
		socket.on('message', message => {
			log.info("Received message:", message);
			this.onMessageReceived(message);
		});
		this.disconnectCallbacks.push(
			this.sync.events.newCommits.on(event => {
				log.info(`Pushing new commits:`, Object.keys(event.commits));
				socket.emit('push', event.commits);
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

	connect(url?:string) {
		this._io = io(url || this.url);

		this.setupIO(this._io);

		if(this._state === State.CONNECTED) { // start over
			this._connecting = new Promise((resolve, reject) => {
				this._connectingPromiseCallbacks.resolve = resolve;
				this._connectingPromiseCallbacks.reject = reject;
			});
		}
		this._state = State.CONNECTING;
		return this._connecting;
	}

	disconnect(callOnDisconnected = true) {
		this.io.disconnect();
		this.disconnectCallbacks.forEach(call);
		if(callOnDisconnected) {
			this.onDisconnected(this.sync.id);
		}
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
