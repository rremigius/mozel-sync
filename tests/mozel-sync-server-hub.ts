import {assert} from "chai";
import MozelSyncServerHub from "../src/MozelSyncServerHub";
import MozelSyncClient from "../src/MozelSyncClient";
import Mozel from "mozel";
import {string} from "mozel/dist/Mozel";
import {interval} from "mozel/dist/utils";

describe("MozelSyncServerHub", () => {
	describe("event 'create-session'", () => {
		it("creates and returns a namespace to which the MozelSyncClient connects automatically", async () => {
			class Foo extends Mozel {
				@string()
				foo?:string;
			}

			const hub = new MozelSyncServerHub(Foo);
			hub.start();

			const client1Model = Foo.create<Foo>();
			const client1 = new MozelSyncClient(client1Model,  'http://localhost:3000');

			await client1.start();

			const client2Model = Foo.create<Foo>();
			const client2 = new MozelSyncClient(client2Model, 'http://localhost:3000', client1.session);

			const client3Model = Foo.create<Foo>();
			const client3 = new MozelSyncClient(client3Model, 'http://localhost:3000');
			client3.onMessageReceived = () => {
				throw new Error("Message should not be received by client3");
			};

			let messageReceived = false;
			client2.onMessageReceived = () => {
				messageReceived = true;
			}

			await client2.start();
			await client3.start();

			client1.message('foo');

			await interval(100);
			assert.ok(messageReceived, "Message received by client2");

			hub.destroy();
		});
	});
});
