import {Namespace, Server} from "socket.io";
import {forEach, isNumber} from "./utils";
import {v4 as uuid} from "uuid";
import MozelSyncServer from "./MozelSyncServer";
import Log from "./log";
import Mozel, {MozelFactory} from "mozel";
import {Data} from "mozel/dist/Mozel";
import {alphanumeric} from "validation-kit";
import {Commit} from "./MozelWatcher";

const log = Log.instance("mozel-sync-server-hub");

export default class MozelSyncServerHub {
	readonly io:Server;
	readonly isDefaultIO;
	readonly port:number;
	readonly Factory:typeof MozelFactory;
	readonly RootModel:typeof Mozel;
	readonly useClientModel:boolean;
	readonly sessionEmptyDestroyTimeout:number;
	private servers:Record<string, MozelSyncServer> = {};

	constructor(options?:{
		io?:Server|number,
		Factory?:typeof MozelFactory,
		RootModel?:typeof Mozel,
		useClientModel?:boolean,
		sessionEmptyDestroyTimeout?:number
	}) {
		const $options = options || {};

		this.Factory = $options.Factory || MozelFactory;
		this.RootModel = $options.RootModel || Mozel;
		this.port = isNumber($options.io) ? $options.io : 3000;
		this.useClientModel = $options.useClientModel === true;
		this.sessionEmptyDestroyTimeout = isNumber($options.sessionEmptyDestroyTimeout)
			? $options.sessionEmptyDestroyTimeout
			: 10000;

		if($options.io instanceof Server) {
			this.io = $options.io;
			this.isDefaultIO = false;
		} else {
			this.io = new Server();
			this.isDefaultIO = true;
		}
	}

	createSessionModel(id:string, data?:Data):Mozel {
		const factory = new this.Factory();
		return factory.createRoot(this.RootModel, data || {gid: 'root'});
	}

	getServer(session:string) {
		return this.servers[session];
	}

	createSession(config?:{state?:Record<alphanumeric, Commit>}) {
		const id = uuid();
		log.info(`Creating session: ${id}...`);
		const namespace = this.io.of('/' + id);

		const model = this.createSessionModel(id);
		const server = this.createSyncServer(model, namespace);

		if(this.useClientModel && config && config.state) {
			log.info(`Using client state:`, config.state);
			server.sync.setFullState(config.state);
		}

		this.servers[id] = server;
		server.start();

		server.events.empty.on(()=>{
			log.info(`Server ${id} empty; closing in ${this.sessionEmptyDestroyTimeout} ms...`);
			// Start timeout to destroy session
			const timeout = setTimeout(()=>{
				this.destroySession(id, namespace)
			}, this.sessionEmptyDestroyTimeout);

			// Cancel destruction if someone joins before that time
			const handler = server.events.userConnected.on(()=>{
				log.info(`Server ${id} no longer empty; cancelled closure.`);
				clearTimeout(timeout);
				server.events.userConnected.off(handler);
			});
		});

		this.onSessionCreated(model, {id});
		return {id};
	}

	destroySession(id:string, namespace:Namespace) {
		log.info(`Closing session ${id}...`);
		namespace.removeAllListeners();
		delete (this.io._nsps as any)['/' + id];
		const server = this.servers[id];
		server.destroy();
	}

	createSyncServer(model:Mozel, io:Namespace) {
		return new MozelSyncServer(model, {io});
	}

	onSessionCreated(model:Mozel, session:{id:string}) {
		// for override
	}

	start() {
		if(this.isDefaultIO) {
			this.io.listen(this.port);
		}
		log.info("MozelSyncServerHub started.");
		this.io.on('connection', socket => {
			socket.emit('hub:connected', {useClientModel: this.useClientModel});
			socket.on('hub:session:create', (config:{state?:Record<alphanumeric, Commit>}) => {
				const session = this.createSession(config);
				socket.emit('hub:session:created', {id: session.id});
			})
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
