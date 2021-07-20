import { Server } from "socket.io";
import MozelSyncServer from "./MozelSyncServer";
import Mozel, { MozelFactory } from "mozel";
export default class MozelSyncServerHub {
    readonly io: Server;
    readonly isDefaultIO: boolean;
    readonly port: number;
    readonly factory: MozelFactory;
    readonly RootModel: typeof Mozel;
    private servers;
    constructor(factory: MozelFactory, RootModel: typeof Mozel, options?: {
        io?: Server | number;
    });
    getServer(session: string): MozelSyncServer;
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
