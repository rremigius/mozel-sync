import MozelSyncServer from "../src/MozelSyncServer";
import MozelSyncClient from "../src/MozelSyncClient";

describe("MozelSyncServer", () => {
	describe("onUserConnected", () => {
		it("is called when a MozelSyncClient connects", () => {
			const server = new MozelSyncServer();
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserConnected = (id: string) => {
					server.stop();
					resolve();
				};
			});

			const client = new MozelSyncClient();
			client.connect();
			return promise;
		});
	});
	describe("onUserDisconnected", () => {
		it("is called when a MozelSyncClient disconnects", () => {
			const server = new MozelSyncServer();
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserDisconnected = (id: string) => {
					server.stop();
					resolve();
				}
			});

			const client = new MozelSyncClient();
			client.onConnected = (id: string) => {
				client.disconnect();
			};
			client.connect();

			return promise;
		});
	});
});
