import {Namespace, Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";
import Log from "./log";
import {isNumber} from "./utils";
import Mozel from "mozel";
import {Commit} from "./MozelWatcher";
import {Data, MozelData} from "mozel/dist/Mozel";

const log = Log.instance("mozel-sync-server");

export default class MozelSyncServer {
	readonly io:Server|Namespace;
	readonly isDefaultIO:boolean;
	readonly sync:MozelSync;
	readonly port:number;
	readonly model:Mozel;

	readonly destroyCallbacks:Function[] = [];

	constructor(model:Mozel, options?:{io?:Server|Namespace, port?:number}) {
		const $options = options || {};

		this.model = model;
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
				}
			});
			socket.on('full-state', (data:MozelData<any>) => {
				log.log(`Received full state from client '${socket.id}.'`);
				try {
					this.sync.setFullState(data);
				} catch(e) {
					log.error(e);
				}
				log.log(`Sending full state from client '${socket.id} to all clients.'`);
				socket.broadcast.emit('full-state', data);
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
		log.log(`Client ${id} connected. Sending connection info and full state.`);
		socket.emit('connection', {id: socket.id});
		socket.emit('full-state', this.sync.createFullState());
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

	destroy() {
		this.destroyCallbacks.forEach(callback => callback());
		this.stop();
		this.sync.destroy(true);
	}
}
