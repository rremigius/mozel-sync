import {Server} from "socket.io";
import {forEach, isNumber} from "./utils";
import {v4 as uuid} from "uuid";
import MozelSyncServer from "./MozelSyncServer";
import Log from "./log";
import Mozel, {MozelFactory} from "mozel";

const log = Log.instance("mozel-sync-server-hub");

export default class MozelSyncServerHub {
	readonly io:Server;
	readonly isDefaultIO;
	readonly port:number;
	readonly RootModel:typeof Mozel;
	servers:Record<string, MozelSyncServer> = {};

	constructor(RootModel:typeof Mozel, io?:Server|number) {
		this.RootModel = RootModel;
		this.port = isNumber(io) ? io : 3000;

		if(io instanceof Server) {
			this.io = io;
			this.isDefaultIO = false;
		} else {
			this.io = new Server();
			this.isDefaultIO = true;
		}
	}

	createSession() {
		const id = uuid();
		const namespace = this.io.of('/' + id);
		const model = this.RootModel.create({gid: 'root'});
		const server = new MozelSyncServer(model, {io: namespace});
		this.servers[id] = server;
		server.start();

		namespace.on('disconnected', async () => {
			log.info(`Closing session ${id}...`);
			const sockets = await namespace.allSockets();
			if(!sockets.size) {
				server.destroy();
			}
			namespace.removeAllListeners();
		});

		return {id};
	}

	start() {
		if(this.isDefaultIO) {
			this.io.listen(this.port);
		}
		this.io.on('connection', socket => {
			const session = this.createSession();
			socket.emit('session-created', {id: session.id});
		});
	}

	stop() {
		forEach(this.servers, server => server.stop());
		if(this.isDefaultIO) {
			this.io.close();
		}
	}

	destroy() {
		this.stop();
		forEach(this.servers, server => server.destroy());
		this.servers = {};
	}
}
