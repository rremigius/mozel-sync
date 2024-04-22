import MozelSyncServer from "../src/MozelSyncServer";
import MozelSyncClient from "../src/MozelSyncClient";
import Mozel from "mozel";

describe("MozelSyncServer", () => {
	describe("onUserConnected", () => {
		it("is called when a MozelSyncClient connects", () => {
			const server = new MozelSyncServer(Mozel.create());
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserConnected = (id: string) => {
					server.stop();
					resolve();
				};
			});

			const client = new MozelSyncClient(Mozel.create(), 'http://localhost:3000');
			client.connect();
			return promise;
		});
	});
	describe("onUserDisconnected", () => {
		it("is called when a MozelSyncClient disconnects", () => {
			const server = new MozelSyncServer(Mozel.create());
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserDisconnected = (id: string) => {
					server.stop();
					resolve();
				}
			});

			const client = new MozelSyncClient(Mozel.create(), 'http://localhost:3000');
			client.onConnected = (id: string) => {
				client.disconnect();
			};
			client.connect();

			return promise;
		});
	});
});
