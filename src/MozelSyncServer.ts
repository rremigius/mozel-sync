import {Namespace, Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";
import Log from "./log";
import Mozel from "mozel";
import {Commit, OutdatedUpdateError} from "./MozelWatcher";
import {alphanumeric} from "validation-kit";

const log = Log.instance("mozel-sync-server");

export default class MozelSyncServer {
	readonly io:Server|Namespace;
	readonly isDefaultIO:boolean;
	readonly sync:MozelSync;
	readonly port:number;
	readonly model:Mozel;
	private sessionOwner?:string;

	readonly destroyCallbacks:Function[] = [];
	private clients:Record<string, { socket:Socket }> = {};

	/**
	 *
	 * @param model
	 * @param options
	 * 			options.io				Custom Socket IO Server or Namespace
	 * 			options.port			Port number for built-in SocketIO Server (if `io` is provided, port is not used)
	 */
	constructor(model:Mozel, options?:{io?:Server|Namespace, port?:number}) {
		const $options = options || {};

		this.model = model;
		this.sync = this.createSync(model);
		this.sync.syncRegistry(model.$registry);

		let io = $options.io;
		if(io instanceof Server || io instanceof Namespace) {
			this.io = io;
			this.isDefaultIO = false;
		} else {
			this.io = new Server();
			this.isDefaultIO = true;
		}
		this.port = $options.port || 3000;
	}

	start() {
		this.sync.start();

		this.io.on('connection', (socket) => {
			this.handleConnection(socket.id, socket)
			socket.on('disconnect', () => {
				this.handleDisconnect(socket);
			});
			// Listen to incoming commits
			socket.on('push', (commits:Record<string, Commit>) => {
				this.handlePush(socket, commits);
			});
			socket.on('full-state', (state:Record<string, Commit>) => {
				this.handleFullState(socket, state);
			});
			socket.on('message', (payload:any) => {
				log.log(`Passing message from client '${socket.id}' to all clients.'`);
				socket.broadcast.emit('message', payload);
			});
		});

		if(this.isDefaultIO && this.io instanceof Server) {
			this.io.listen(this.port);
		}

		this.destroyCallbacks.push(
			this.sync.events.newCommits.on(event => {
				log.log(`Pushing new commits to all clients:`, Object.keys(event.commits));
				this.io.emit('push', event.commits);
			})
		);

		log.info("MozelSyncServer started.");
	}

	stop() {
		if(this.io instanceof Server && this.isDefaultIO) this.io.close();
		if(this.isDefaultIO) {
			this.sync.stop();
		}
	}

	createSync(model:Mozel) {
		return new MozelSync(model, {priority: 1, autoCommit: 100});
	}

	handleConnection(id:string, socket:Socket) {
		log.info(`Client ${id} connected.`);

		this.clients[id] = {socket};
		if(Object.keys(this.clients).length === 1) this.sessionOwner = id;

		log.log(`Sending connection info to ${socket.id}.`);
		socket.emit('connected', {id: socket.id, serverSyncID: this.sync.id});

		log.log(`Sending full state to ${socket.id}.`);
		socket.emit('full-state', this.sync.createFullState());

		this.onUserConnected(id);
	}

	handleDisconnect(socket:Socket) {
		log.info(`Client disconnected: ${socket.id}`);
		this.onUserDisconnected(socket.id);
	}

	handlePush(socket:Socket, commits:Record<alphanumeric, Commit>) {
		log.log(`Received commits from client '${socket.id}':`, Object.keys(commits));
		try {
			const merged = this.sync.merge(commits);
			log.log(`Pushing merged commit from client '${socket.id}' to all clients:`, Object.keys(commits));
			socket.broadcast.emit('push', merged); // send merged update to others
		} catch (e) {
			log.error(e);
			if(e instanceof OutdatedUpdateError) {
				log.log(`Sending full state to client '${socket.id}' after error in merge.`);
				socket.emit('full-state', this.sync.createFullState());
			}
		}
	}

	handleFullState(socket:Socket, state:Record<alphanumeric, Commit>) {
		log.log(`Received full state from client '${socket.id}.'`);
		try {
			this.sync.setFullState(state);
			this.onFullStateUpdate(state);
			log.log(`Sending full state from client '${socket.id} to all clients.'`);
			socket.broadcast.emit('full-state', state);
		} catch(e) {
			log.error(e);
		}
	}

	onUserConnected(id:string) {
		// For overide
	}

	onUserDisconnected(id:string) {
		// For override
	}

	onFullStateUpdate(state:Record<string, Commit>) {
		// For override
	}

	destroy() {
		this.destroyCallbacks.forEach(callback => callback());
		this.stop();
		this.sync.destroy(true);
	}
}
