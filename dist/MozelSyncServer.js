import { Server } from "socket.io";
import MozelSync from "./MozelSync";
import Log from "./log";
import { isNumber } from "./utils";
const log = Log.instance("mozel-sync-server");
export default class MozelSyncServer {
    io;
    isDefaultIO;
    sync;
    port;
    destroyCallbacks = [];
    constructor(options) {
        const $options = options || {};
        let sync = $options.sync;
        if (!sync) {
            sync = new MozelSync({ priority: 1, autoCommit: 100 });
            if ($options.model) {
                sync.syncRegistry($options.model.$registry);
            }
        }
        this.sync = sync;
        let io = $options.io;
        if (io instanceof Server) {
            this.io = io;
            this.isDefaultIO = false;
        }
        else {
            this.io = new Server();
            this.isDefaultIO = true;
        }
        this.port = isNumber($options.io) ? $options.io : 3000;
    }
    start() {
        this.sync.start();
        this.io.on('connection', (socket) => {
            this.initUser(socket.id, socket);
            socket.on('disconnect', () => {
                this.removeUser(socket.id);
            });
            // Listen to incoming updates
            socket.on('push', (commits) => {
                log.log(`Received commits from client '${socket.id}':`, Object.keys(commits));
                const merged = this.sync.merge(commits);
                log.log(`Pushing merged commit from client '${socket.id}' to all clients:`, Object.keys(commits));
                this.io.emit('push', merged); // send merged update to others
            });
        });
        if (this.isDefaultIO) {
            this.io.listen(this.port);
        }
        this.destroyCallbacks.push(this.sync.events.newCommits.on(event => {
            log.log(`Pushing new commits to all clients:`, Object.keys(event.commits));
            this.io.emit('push', event.commits);
        }));
        log.info("MozelSyncServer started.");
    }
    stop() {
        this.io.close();
        this.sync.stop();
    }
    initUser(id, socket) {
        log.log(`Client ${id} connected. Sending connection info and full state.`);
        socket.emit('connection', { id: socket.id });
        socket.emit('full-state', this.sync.createFullStates());
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
    destroy() {
        this.destroyCallbacks.forEach(callback => callback());
    }
}
//# sourceMappingURL=MozelSyncServer.js.map