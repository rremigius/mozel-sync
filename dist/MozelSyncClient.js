import { io } from "socket.io-client";
import MozelSync from "./MozelSync";
import Log from "log-control";
import { call } from "./utils";
const log = Log.instance("mozel-sync-client");
export default class MozelSyncClient {
    _io;
    get io() { return this._io; }
    ;
    model;
    sync;
    _connectingPromiseCallbacks = { resolve: (id) => { }, reject: (err) => { } };
    _connecting;
    get connecting() {
        return this._connecting;
    }
    destroyCallbacks;
    disconnectCallbacks;
    server;
    url;
    sessionOwner = false;
    _session;
    get session() { return this._session; }
    _serverSyncID;
    get serverSyncID() { return this._serverSyncID; }
    constructor(model, server, session) {
        this.model = model;
        this._session = session;
        this.sync = this.createSync(model);
        this.sync.syncRegistry(model.$registry);
        this.server = server;
        this.url = session ? `${server}/${session}` : server;
        this.destroyCallbacks = [];
        this.disconnectCallbacks = [];
    }
    setupIO(socket) {
        socket.on('session-created', session => {
            this._session = session.id;
            this.sessionOwner = true;
            this.disconnect(false);
            this.url = this.server + '/' + session.id;
            this.connect().catch(log.error);
        });
        socket.on('connection', event => {
            log.info(`MozelSyncClient connected to server: ${event.serverSyncID}`);
            this.sync.id = event.id;
            this._serverSyncID = event.serverSyncID;
            if (this.sessionOwner) {
                this.sendFullState();
            }
            this._connectingPromiseCallbacks.resolve(event.id);
            this.onConnected(event.id);
        });
        socket.on('error', error => {
            log.error("Could not connect:", error);
            this._connectingPromiseCallbacks.reject(error);
        });
        socket.on('push', commits => {
            for (let gid of Object.keys(commits)) {
                // Exclude own commits
                if (commits[gid].syncID === this.sync.id) {
                    delete commits[gid];
                }
            }
            if (!Object.keys(commits).length)
                return;
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
        this.disconnectCallbacks.push(this.sync.events.newCommits.on(event => {
            log.info(`Pushing new commits:`, Object.keys(event.commits));
            socket.emit('push', event.commits);
        }));
    }
    createSync(model) {
        return new MozelSync(model, { autoCommit: 100 });
    }
    async start() {
        this.sync.start();
        await this.connect();
        log.info("MozelSyncClient started.");
    }
    message(payload) {
        this.io.emit('message', payload);
    }
    onMessageReceived(payload) {
        // for override
    }
    sendFullState() {
        const state = this.sync.createFullState();
        log.log(`Sending full state to server:`, state);
        this.io.emit('full-state', state);
    }
    connect() {
        if (!this._io) {
            this._io = io(this.url);
        }
        this.setupIO(this._io);
        this._connecting = new Promise((resolve, reject) => {
            this._connectingPromiseCallbacks.resolve = resolve;
            this._connectingPromiseCallbacks.reject = reject;
        });
        return this._connecting;
    }
    disconnect(callOnDisconnected = true) {
        this.io.disconnect();
        this.disconnectCallbacks.forEach(call);
        if (callOnDisconnected) {
            this.onDisconnected(this.sync.id);
        }
    }
    onConnected(id) {
        // For override
    }
    onDisconnected(id) {
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
//# sourceMappingURL=MozelSyncClient.js.map