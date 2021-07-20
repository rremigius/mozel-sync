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
    onSessionCreated(model: Mozel, session: {
        id: string;
    }): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
