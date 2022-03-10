import { Namespace, Server, Socket } from "socket.io";
import MozelSync from "./MozelSync";
import Mozel from "mozel";
import { Commit } from "./MozelWatcher";
import { alphanumeric } from "validation-kit";
import EventInterface from "event-interface-mixin";
export declare class ServerDestroyedEvent {
}
export declare class ServerEmptyEvent {
}
export declare class UserConnectedEvent {
}
export declare class MozelSyncServerEvents extends EventInterface {
    userConnected: import("event-interface-mixin").EventEmitter<UserConnectedEvent>;
    destroyed: import("event-interface-mixin").EventEmitter<ServerDestroyedEvent>;
    empty: import("event-interface-mixin").EventEmitter<ServerEmptyEvent>;
}
export default class MozelSyncServer {
    readonly io: Server | Namespace;
    readonly isDefaultIO: boolean;
    readonly sync: MozelSync;
    readonly port: number;
    readonly model: Mozel;
    private sessionOwner?;
    readonly destroyCallbacks: Function[];
    private clients;
    readonly events: MozelSyncServerEvents;
    /**
     *
     * @param model
     * @param options
     * 			options.io				Custom Socket IO Server or Namespace
     * 			options.port			Port number for built-in SocketIO Server (if `io` is provided, port is not used)
     */
    constructor(model: Mozel, options?: {
        io?: Server | Namespace;
        port?: number;
    });
    start(): void;
    stop(): void;
    logCommits(commits: Record<string, Commit>): string[] | Record<string, Commit>;
    createSync(model: Mozel): MozelSync;
    handleConnection(id: string, socket: Socket): void;
    handleDisconnect(socket: Socket): void;
    handlePush(socket: Socket, commits: Record<alphanumeric, Commit>): void;
    handleFullState(socket: Socket, state: Record<alphanumeric, Commit>): void;
    onUserConnected(id: string): void;
    onUserDisconnected(id: string): void;
    onFullStateUpdate(state: Record<string, Commit>, socket: Socket): void;
    onPush(commits: Record<alphanumeric, Commit>, socket: Socket): void;
    destroy(): void;
}
