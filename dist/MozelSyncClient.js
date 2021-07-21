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
    connecting = { resolve: (id) => { }, reject: (err) => { } };
    destroyCallbacks;
    server;
    sessionOwner = false;
    _session;
    get session() { return this._session; }
    constructor(model, server, session) {
        this.model = model;
        this._session = session;
        this.sync = new MozelSync(model, { autoCommit: 100 });
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
            log.info("MozelSyncClient connected.");
            this.sync.id = event.id;
            if (this.sessionOwner) {
                this.sendFullState();
            }
            this.connecting.resolve(event.id);
            this.onConnected(event.id);
        });
        this.io.on('error', error => {
            log.error("Could not connect:", error);
            this.connecting.reject(error);
        });
        this.io.on('push', commits => {
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
        this.destroyCallbacks.push(this.sync.events.newCommits.on(event => {
            log.info(`Pushing new commits:`, Object.keys(event.commits));
            this.io.emit('push', event.commits);
        }));
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