import { Socket } from "socket.io-client";
import MozelSync from "./MozelSync";
import Mozel from "mozel";
export declare enum State {
    DISCONNECTED = 0,
    CONNECTING = 1,
    CONNECTED = 2
}
export default class MozelSyncClient {
    protected _io: Socket;
    get io(): Socket<import("socket.io-client/build/typed-events").DefaultEventsMap, import("socket.io-client/build/typed-events").DefaultEventsMap>;
    readonly model: Mozel;
    readonly sync: MozelSync;
    private _connectingPromiseCallbacks;
    private _connecting;
    get connecting(): Promise<unknown>;
    private _state;
    get state(): State;
    private _isSessionOwner;
    get isSessionOwner(): boolean;
    private _session?;
    get session(): string | undefined;
    private _serverSyncID?;
    get serverSyncID(): string | undefined;
    private destroyCallbacks;
    private disconnectCallbacks;
    private server;
    private url;
    constructor(model: Mozel, server: string, session?: string);
    setupIO(socket: Socket): void;
    createSync(model: Mozel): MozelSync;
    start(): Promise<void>;
    message(payload: any): void;
    onMessageReceived(payload: unknown): void;
    sendFullState(): void;
    connect(url?: string): Promise<unknown>;
    disconnect(callOnDisconnected?: boolean): void;
    onConnected(id: string): void;
    onDisconnected(id: string): void;
    destroy(): void;
    onDestroy(): void;
}
