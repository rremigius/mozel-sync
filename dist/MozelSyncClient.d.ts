import { Socket } from "socket.io-client";
import MozelSync from "./MozelSync";
import Mozel from "mozel";
export default class MozelSyncClient {
    protected _io: Socket;
    get io(): Socket<import("socket.io-client/build/typed-events").DefaultEventsMap, import("socket.io-client/build/typed-events").DefaultEventsMap>;
    readonly model: Mozel;
    readonly sync: MozelSync;
    private connecting;
    private destroyCallbacks;
    private server;
    private sessionOwner;
    private _session?;
    get session(): string | undefined;
    constructor(model: Mozel, server: string, session?: string);
    initIO(): void;
    createSync(model: Mozel): MozelSync;
    start(): Promise<void>;
    message(payload: any): void;
    onMessageReceived(payload: unknown): void;
    sendFullState(): void;
    connect(): Promise<unknown>;
    disconnect(): void;
    onConnected(id: string): void;
    onDisconnected(id: string): void;
    destroy(): void;
    onDestroy(): void;
}
