import { Server } from "socket.io";
import MozelSyncServer from "./MozelSyncServer";
import Mozel from "mozel";
export default class MozelSyncServerHub {
    readonly io: Server;
    readonly isDefaultIO: boolean;
    readonly port: number;
    readonly RootModel: typeof Mozel;
    servers: Record<string, MozelSyncServer>;
    constructor(RootModel: typeof Mozel, io?: Server | number);
    createSession(): {
        id: string;
    };
    start(): void;
    stop(): void;
    destroy(): void;
}
