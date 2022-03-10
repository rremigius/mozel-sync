import {assert} from "chai";
import MozelSyncServerHub from "../src/MozelSyncServerHub";
import MozelSyncClient from "../src/MozelSyncClient";
import Mozel, {Collection, collection, MozelFactory, property} from "mozel";
import {string} from "mozel/dist/Mozel";
import {interval} from "mozel/dist/utils";
import MozelSyncServer from "../src/MozelSyncServer";
import {Namespace} from "socket.io";

describe("MozelSyncServerHub", () => {
	describe("createSession", () => {
		it("creates and returns a namespace to which the MozelSyncClient connects automatically", async () => {
			class Foo extends Mozel {}

			const hub = new MozelSyncServerHub({RootModel: Foo});
			hub.start();

			const init = {gid: 'root'};

			const client1Model = Foo.create<Foo>(init);
			const client1 = new MozelSyncClient(client1Model,  'http://localhost:3000');

			await client1.start();

			const client2Model = Foo.create<Foo>(init);
			const client2 = new MozelSyncClient(client2Model, 'http://localhost:3000', client1.session);

			const client3Model = Foo.create<Foo>(init);
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
		it("with useClientModel:true creates a Mozel from the provided Factory, based on the first client's state", async () => {
			class Foo extends Mozel {
				@string()
				declare foo?:string;
			}

			const hub = new MozelSyncServerHub({RootModel: Foo, useClientModel: true});
			const sessionCreated = new Promise<void>((resolve, reject) => {
				hub.onSessionCreated = () => {
					resolve();
				}
			});

			hub.start();

			const model = Foo.create<Foo>({gid: 'root', foo: 'abc'});
			const client = new MozelSyncClient(model, 'http://localhost:3000');
			await client.start();

			assert.isString(client.session);
			const server = hub.getServer(client.session as string);

			await sessionCreated;
			assert.equal(server.model.$get('foo'), 'abc', `Server has initial client's state`);
			assert.equal(model.$get('foo'), 'abc', 'Client state is unchanged');

			hub.destroy();
		});
		it("with useClientModel:true, if initial model if provided by client, client can start changing it immediately", async () => {
			class Foo extends Mozel {
				@string()
				declare foo?:string;
			}

			const hub = new MozelSyncServerHub({RootModel: Foo, useClientModel: true});
			const sessionCreated = new Promise<void>((resolve, reject) => {
				hub.onSessionCreated = () => {
					resolve();
				}
			});

			hub.start();

			const model = Foo.create<Foo>({gid: 'root', foo: 'abc'});
			const client = new MozelSyncClient(model, 'http://localhost:3000');
			const connection = client.start();

			await interval(100);
			model.foo = 'xyz'; // start changing model before properly connected

			await connection;
			assert.isString(client.session);
			const server = hub.getServer(client.session as string);

			await sessionCreated;
			assert.equal(server.model.$get('foo'), 'abc', `Server has initial client's state`);
			assert.equal(model.$get('foo'), 'abc', 'Client state is unchanged');

			await interval(100);
			assert.equal(server.model.$get('foo'), 'xyz', `Server has updated client's state`);
			assert.equal(model.$get('foo'), 'xyz', `Client's changes are not reverted`);

			hub.destroy();
		});
	});
});
