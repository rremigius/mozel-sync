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
	readonly Factory:typeof MozelFactory;
	readonly RootModel:typeof Mozel;
	readonly createSessionModel:(id:string)=>Mozel;
	private servers:Record<string, MozelSyncServer> = {};

	constructor(options?:{
		io?:Server|number,
		Factory?:typeof MozelFactory,
		RootModel?:typeof Mozel,
		createSessionModel?:(id:string)=>Mozel
	}) {
		const $options = options || {};

		this.Factory = $options.Factory || MozelFactory;
		this.RootModel = $options.RootModel || Mozel;
		this.createSessionModel = $options.createSessionModel || ((id:string)=>{
			const factory = new this.Factory();
			return factory.createRoot(this.RootModel, {gid: 'root'});
		});
		this.port = isNumber($options.io) ? $options.io : 3000;

		if($options.io instanceof Server) {
			this.io = $options.io;
			this.isDefaultIO = false;
		} else {
			this.io = new Server();
			this.isDefaultIO = true;
		}
	}

	getServer(session:string) {
		return this.servers[session];
	}

	createSession() {
		const id = uuid();
		log.info(`Creating session: ${id}...`);
		const namespace = this.io.of('/' + id);

		const model = this.createSessionModel(id);
		const server = new MozelSyncServer(model, {io: namespace, useClientState: true});
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

		this.onSessionCreated(model, {id});
		return {id};
	}

	onSessionCreated(model:Mozel, session:{id:string}) {
		// for override
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
