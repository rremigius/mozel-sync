import {assert} from "chai";
import MozelSyncServer from "../src/MozelSyncServer";
import MozelSyncClient from "../src/MozelSyncClient";
import {interval} from "../src/utils";
import {string} from "mozel/dist/Mozel";
import Mozel, {collection, Collection, property} from "mozel";

describe("MozelSyncServer/Client", () => {
	describe("updates", () => {
		it("when server model is changed, updates are emitted to client", async () => {
			class Foo extends Mozel {
				@property(String)
				declare foo?:string;
			}
			const init = {gid: 'root'}
			const model = Foo.create<Foo>(init);
			const server = new MozelSyncServer({model});
			server.start();

			const clientModel = Foo.create<Foo>(init);
			const client = new MozelSyncClient({model: clientModel});
			await client.connect();

			assert.notEqual(clientModel.foo, 'foo');

			model.foo = 'foo';

			return new Promise((resolve, reject) => {
				setTimeout(()=>{
					assert.equal(clientModel.foo, 'foo');
					server.stop();
					resolve();
				}, server.sync.autoCommit! + 100);
			});
		});
		it("when client model is changed, updates are emitted to the server", async () => {
			class Foo extends Mozel {
				@property(String)
				declare foo?:string;
			}
			const init = {gid: 'root'}
			const model = Foo.create<Foo>(init);
			const server = new MozelSyncServer({model});
			server.start();

			const clientModel = Foo.create<Foo>(init);
			const client = new MozelSyncClient({model: clientModel});
			await client.start();

			assert.notEqual(clientModel.foo, 'foo');

			clientModel.foo = 'foo';

			return new Promise((resolve, reject) => {
				setTimeout(()=>{
					assert.equal(model.foo, 'foo');
					server.stop();
					resolve();
				}, client.sync.autoCommit! + 100);
			});
		});
	});
	describe("connection", () => {
		it("full updates are sent to client on connection", async () => {
			class Foo extends Mozel {
				@string()
				declare name?:string;
				@property(Foo)
				declare foo?:Foo;
			}
			const serverModel = Foo.create<Foo>({
				gid: 'root',
				name: 'Root',
				foo: {gid: 'root.foo', name: 'RootFoo'}
			});
			const server = new MozelSyncServer({model: serverModel});
			server.start();

			const clientModel = Foo.create<Foo>({gid: 'root'});
			const client = new MozelSyncClient({model: clientModel});
			await client.connect();

			assert.deepEqual(serverModel.$export(), clientModel.$export(), "Client model synced with server model");
			server.stop();
		});
	});
	describe("(Integration) multiple clients", () => {
		it("models are synced between all clients and server", async () => {
			class Foo extends Mozel {
				@string()
				declare name?:string;
				@property(Foo)
				declare foo?:Foo;
				@collection(Foo)
				declare foos:Collection<Foo>
			}
			const serverModel = Foo.create<Foo>({
				gid: 'root',
				name: 'Root',
				foo: {gid: 'root.foo', name: 'RootFoo'},
				foos: [
					{gid: 'root.foos.0', name: 'RootFoos0'},
					{gid: 'root.foos.1', name: 'RootFoos1', foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo'}}]
			});
			const client1Model = Foo.create<Foo>({gid: 'root'})
			const client2Model = Foo.create<Foo>({gid: 'root'})

			const server = new MozelSyncServer({model: serverModel});
			const client1 = new MozelSyncClient({model: client1Model});
			const client2 = new MozelSyncClient({model: client2Model});

			server.start();
			await client1.start();
			await client2.start();

			assert.exists(client1Model.foo, "RootFoo synced to client1");
			assert.exists(client2Model.foos.get(1)!.foo, "RootFoos2Foo synced to client 2");

			client1Model.foo!.name = 'RootFoo-client1';
			client2Model.foo!.name = 'RootFoo-client2';
			serverModel.foo!.name = 'Root-server';

			client1Model.foos.get(0)!.name = 'RootFoos0-client1';
			client2Model.foos.removeIndex(0);

			await interval(server.sync.autoCommit! * 3);
			console.log("\n\n-------------------------------------------------------\n\n")

			assert.deepEqual(client1Model.$export(), serverModel.$export(), "Server and client1 in sync");
			assert.deepEqual(client2Model.$export(), serverModel.$export(), "Server and client2 in sync");
			assert.equal(serverModel.foo!.name, 'Root-server');

			client1Model.foos.get(0)!.$set('foo', {name: 'RootFoos1Foo-client1'});
			client2Model.foo!.name = 'Root-client2';

			await interval(server.sync.autoCommit! * 3);
			console.log("\n\n-------------------------------------------------------\n\n")

			assert.deepEqual(client1Model.$export(), serverModel.$export(), "Server and client1 in sync");
			assert.deepEqual(client2Model.$export(), serverModel.$export(), "Server and client2 in sync");
			assert.equal(serverModel.foos.get(0)!.foo!.name, 'RootFoos1Foo-client1');
			assert.equal(serverModel.foo!.name, 'Root-client2');
		});
	});
});
