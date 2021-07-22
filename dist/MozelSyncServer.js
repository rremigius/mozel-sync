import { Namespace, Server } from "socket.io";
import MozelSync from "./MozelSync";
import Log from "./log";
import { OutdatedUpdateError } from "./MozelWatcher";
const log = Log.instance("mozel-sync-server");
export default class MozelSyncServer {
    io;
    isDefaultIO;
    sync;
    port;
    model;
    sessionOwner;
    destroyCallbacks = [];
    clients = {};
    /**
     *
     * @param model
     * @param options
     * 			options.io				Custom Socket IO Server or Namespace
     * 			options.port			Port number for built-in SocketIO Server (if `io` is provided, port is not used)
     */
    constructor(model, options) {
        const $options = options || {};
        this.model = model;
        this.sync = this.createSync(model);
        this.sync.syncRegistry(model.$registry);
        let io = $options.io;
        if (io instanceof Server || io instanceof Namespace) {
            this.io = io;
            this.isDefaultIO = false;
        }
        else {
            this.io = new Server();
            this.isDefaultIO = true;
        }
        this.port = $options.port || 3000;
    }
    start() {
        this.sync.start();
        this.io.on('connection', (socket) => {
            this.initUser(socket.id, socket);
            socket.on('disconnect', () => {
                log.info(`Client disconnected: ${socket.id}`);
                this.removeUser(socket.id);
            });
            // Listen to incoming updates
            socket.on('push', (commits) => {
                log.log(`Received commits from client '${socket.id}':`, Object.keys(commits));
                try {
                    const merged = this.sync.merge(commits);
                    log.log(`Pushing merged commit from client '${socket.id}' to all clients:`, Object.keys(commits));
                    socket.broadcast.emit('push', merged); // send merged update to others
                }
                catch (e) {
                    log.error(e);
                    if (e instanceof OutdatedUpdateError) {
                        log.log(`Sending full state to client '${socket.id}' after error in merge.`);
                        socket.emit('full-state', this.sync.createFullState());
                    }
                }
            });
            socket.on('full-state', (state) => {
                log.log(`Received full state from client '${socket.id}.'`);
                try {
                    this.sync.setFullState(state);
                    this.onFullStateUpdate(state);
                    log.log(`Sending full state from client '${socket.id} to all clients.'`);
                    socket.broadcast.emit('full-state', state);
                }
                catch (e) {
                    log.error(e);
                }
            });
            socket.on('message', (payload) => {
                log.log(`Passing message from client '${socket.id}' to all clients.'`);
                socket.broadcast.emit('message', payload);
            });
        });
        if (this.isDefaultIO && this.io instanceof Server) {
            this.io.listen(this.port);
        }
        this.destroyCallbacks.push(this.sync.events.newCommits.on(event => {
            log.log(`Pushing new commits to all clients:`, Object.keys(event.commits));
            this.io.emit('push', event.commits);
        }));
        log.info("MozelSyncServer started.");
    }
    stop() {
        if (this.io instanceof Server)
            this.io.close();
        if (this.isDefaultIO) {
            this.sync.stop();
        }
    }
    createSync(model) {
        return new MozelSync(model, { priority: 1, autoCommit: 100 });
    }
    initUser(id, socket) {
        log.info(`Client ${id} connected.`);
        this.clients[id] = { socket };
        if (Object.keys(this.clients).length === 1)
            this.sessionOwner = id;
        log.log(`Sending connection info to ${socket.id}.`);
        socket.emit('connection', { id: socket.id, serverSyncID: this.sync.id });
        log.log(`Sending full state to ${socket.id}.`);
        socket.emit('full-state', this.sync.createFullState());
        this.onUserConnected(id);
    }
    removeUser(id) {
        this.onUserDisconnected(id);
    }
    onUserConnected(id) {
        // For overide
    }
    onUserDisconnected(id) {
        // For override
    }
    onFullStateUpdate(state) {
        // For override
    }
    destroy() {
        this.destroyCallbacks.forEach(callback => callback());
        this.stop();
        this.sync.destroy(true);
    }
}
//# sourceMappingURL=MozelSyncServer.js.map