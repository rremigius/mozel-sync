import {Namespace, Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";
import Log from "./log";
import {isNumber} from "./utils";
import Mozel from "mozel";
import {Commit, OutdatedUpdateError} from "./MozelWatcher";
import {Data, MozelData} from "mozel/dist/Mozel";

const log = Log.instance("mozel-sync-server");

export default class MozelSyncServer {
	readonly io:Server|Namespace;
	readonly isDefaultIO:boolean;
	readonly sync:MozelSync;
	readonly port:number;
	readonly model:Mozel;
	readonly userState:boolean;
	private sessionOwner?:string;

	readonly destroyCallbacks:Function[] = [];
	private clients:Record<string, { socket:Socket }> = {};

	/**
	 *
	 * @param model
	 * @param options
	 * 			options.io				Custom Socket IO Server or Namespace
	 * 			options.port			Port number for built-in SocketIO Server (if `io` is provided, port is not used)
	 * 			options.firstUserState	If `true`, will not send the server state to the first client, but will accept their state instead.
	 */
	constructor(model:Mozel, options?:{io?:Server|Namespace, port?:number, userClientState?:boolean}) {
		const $options = options || {};

		this.model = model;
		this.userState = $options.userClientState === true;
		this.sync = new MozelSync(model, {priority: 1, autoCommit: 100});
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
			this.initUser(socket.id, socket)
			socket.on('disconnect', () => {
				log.info(`Client disconnected: ${socket.id}`);
				this.removeUser(socket.id);
			});
			// Listen to incoming updates
			socket.on('push', (commits:Record<string, Commit>) => {
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
			});
			socket.on('full-state', (state:Record<string, Commit>) => {
				log.log(`Received full state from client '${socket.id}.'`);
				try {
					this.sync.setFullState(state);
					this.onFullStateUpdate(state);
					log.log(`Sending full state from client '${socket.id} to all clients.'`);
					socket.broadcast.emit('full-state', state);
				} catch(e) {
					log.error(e);
				}
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
		if(this.io instanceof Server) this.io.close();
		if(this.isDefaultIO) {
			this.sync.stop();
		}
	}

	initUser(id:string, socket:Socket) {
		log.info(`Client ${id} connected.`);

		this.clients[id] = {socket};
		if(Object.keys(this.clients).length === 1) this.sessionOwner = id;

		log.log(`Sending connection info to ${socket.id}.`);
		socket.emit('connection', {id: socket.id});

		if(!this.userState || this.sessionOwner !== id) {
			log.log(`Sending full state to ${socket.id}.`);
			socket.emit('full-state', this.sync.createFullState());
		}
		this.onUserConnected(id);
	}

	removeUser(id:string) {
		this.onUserDisconnected(id);
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
