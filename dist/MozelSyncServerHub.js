import { Server } from "socket.io";
import { forEach, isNumber } from "./utils";
import { v4 as uuid } from "uuid";
import MozelSyncServer from "./MozelSyncServer";
import Log from "./log";
const log = Log.instance("mozel-sync-server-hub");
export default class MozelSyncServerHub {
    io;
    isDefaultIO;
    port;
    factory;
    RootModel;
    servers = {};
    constructor(factory, RootModel, options) {
        const $options = options || {};
        this.factory = factory;
        this.RootModel = RootModel;
        this.port = isNumber($options.io) ? $options.io : 3000;
        if ($options.io instanceof Server) {
            this.io = $options.io;
            this.isDefaultIO = false;
        }
        else {
            this.io = new Server();
            this.isDefaultIO = true;
        }
    }
    getServer(session) {
        return this.servers[session];
    }
    createSession() {
        const id = uuid();
        log.info(`Creating session: ${id}...`);
        const namespace = this.io.of('/' + id);
        const model = this.factory.create(this.RootModel, { gid: 'root' });
        const server = new MozelSyncServer(model, { io: namespace, userClientState: true });
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
    onSessionCreated(model, session) {
        // for override
    }
    start() {
        if (this.isDefaultIO) {
            this.io.listen(this.port);
        }
        this.io.on('connection', socket => {
            const session = this.createSession();
            socket.emit('session-created', { id: session.id });
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