import { Namespace, Server, Socket } from "socket.io";
import MozelSync from "./MozelSync";
import Mozel from "mozel";
export default class MozelSyncServer {
    readonly io: Server | Namespace;
    readonly isDefaultIO: boolean;
    readonly sync: MozelSync;
    readonly port: number;
    readonly model: Mozel;
    readonly destroyCallbacks: Function[];
    constructor(model: Mozel, options?: {
        io?: Server | Namespace;
        port?: number;
    });
    start(): void;
    stop(): void;
    initUser(id: string, socket: Socket): void;
    removeUser(id: string): void;
    onUserConnected(id: string): void;
    onUserDisconnected(id: string): void;
    destroy(): void;
}
