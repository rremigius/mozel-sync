import { Namespace, Server, Socket } from "socket.io";
import MozelSync from "./MozelSync";
import Mozel from "mozel";
import { Commit } from "./MozelWatcher";
import { alphanumeric } from "validation-kit";
export default class MozelSyncServer {
    readonly io: Server | Namespace;
    readonly isDefaultIO: boolean;
    readonly sync: MozelSync;
    readonly port: number;
    readonly model: Mozel;
    private sessionOwner?;
    readonly destroyCallbacks: Function[];
    private clients;
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
    createSync(model: Mozel): MozelSync;
    handleConnection(id: string, socket: Socket): void;
    handleDisconnect(socket: Socket): void;
    handlePush(socket: Socket, commits: Record<alphanumeric, Commit>): void;
    handleFullState(socket: Socket, state: Record<alphanumeric, Commit>): void;
    onUserConnected(id: string): void;
    onUserDisconnected(id: string): void;
    onFullStateUpdate(state: Record<string, Commit>): void;
    destroy(): void;
}
