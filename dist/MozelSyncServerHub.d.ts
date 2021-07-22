import { Namespace, Server } from "socket.io";
import MozelSyncServer from "./MozelSyncServer";
import Mozel, { MozelFactory } from "mozel";
export default class MozelSyncServerHub {
    readonly io: Server;
    readonly isDefaultIO: boolean;
    readonly port: number;
    readonly Factory: typeof MozelFactory;
    readonly RootModel: typeof Mozel;
    readonly useClientModel: boolean;
    private servers;
    constructor(options?: {
        io?: Server | number;
        Factory?: typeof MozelFactory;
        RootModel?: typeof Mozel;
        useClientModel?: boolean;
    });
    createSessionModel(id: string): Mozel;
    getServer(session: string): MozelSyncServer;
    createSession(): {
        id: string;
    };
    createSyncServer(model: Mozel, io: Namespace): MozelSyncServer;
    onSessionCreated(model: Mozel, session: {
        id: string;
    }): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
