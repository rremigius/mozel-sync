import { Server } from "socket.io";
import { forEach, isNumber } from "./utils";
import { v4 as uuid } from "uuid";
import MozelSyncServer from "./MozelSyncServer";
import Log from "./log";
import Mozel, { MozelFactory } from "mozel";
const log = Log.instance("mozel-sync-server-hub");
export default class MozelSyncServerHub {
    io;
    isDefaultIO;
    port;
    Factory;
    RootModel;
    useClientModel;
    servers = {};
    constructor(options) {
        const $options = options || {};
        this.Factory = $options.Factory || MozelFactory;
        this.RootModel = $options.RootModel || Mozel;
        this.port = isNumber($options.io) ? $options.io : 3000;
        this.useClientModel = $options.useClientModel === true;
        if ($options.io instanceof Server) {
            this.io = $options.io;
            this.isDefaultIO = false;
        }
        else {
            this.io = new Server();
            this.isDefaultIO = true;
        }
    }
    createSessionModel(id, data) {
        const factory = new this.Factory();
        return factory.createRoot(this.RootModel, data || { gid: 'root' });
    }
    getServer(session) {
        return this.servers[session];
    }
    createSession(config) {
        const id = uuid();
        log.info(`Creating session: ${id}...`);
        const namespace = this.io.of('/' + id);
        const model = this.createSessionModel(id);
        const server = this.createSyncServer(model, namespace);
        if (this.useClientModel && config && config.state) {
            server.sync.setFullState(config.state);
        }
        this.servers[id] = server;
        server.start();
        namespace.on('disconnected', async () => {
            log.info(`Closing session ${id}...`);
            const sockets = await namespace.allSockets();
            if (!sockets.size) {
                server.destroy();
            }
            namespace.removeAllListeners();
        });
        this.onSessionCreated(model, { id });
        return { id };
    }
    createSyncServer(model, io) {
        return new MozelSyncServer(model, { io });
    }
    onSessionCreated(model, session) {
        // for override
    }
    start() {
        if (this.isDefaultIO) {
            this.io.listen(this.port);
        }
        log.info("MozelSyncServerHub started.");
        this.io.on('connection', socket => {
            socket.emit('connection-hub', { useClientModel: this.useClientModel });
            socket.on('create-session', (config) => {
                const session = this.createSession(config);
                socket.emit('session-created', { id: session.id });
            });
        });
    }
    stop() {
        forEach(this.servers, server => server.stop());
        if (this.isDefaultIO) {
            this.io.close();
        }
    }
    destroy() {
        this.stop();
        forEach(this.servers, server => server.destroy());
        this.servers = {};
    }
}
//# sourceMappingURL=MozelSyncServerHub.js.map