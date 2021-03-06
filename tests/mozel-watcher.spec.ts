import {MozelWatcher} from "../src/MozelWatcher";
import {assert} from "chai";
import {number, string} from "mozel/dist/Mozel";
import Mozel, {collection, Collection, property} from "mozel";
import {interval} from "mozel/dist/utils";

describe("MozelWatcher", () => {
	it("tracks all changes in the given Mozel's properties", () => {
		class Foo extends Mozel {
			@property(String)
			declare name?:string;
			@property(Foo)
			declare foo?:Foo;
		}
		const root = Foo.create<Foo>({
			gid: 'root',
			name: 'root'
		});
		const watcher = new MozelWatcher(root);
		watcher.start();

		root.foo = root.$create(Foo, {gid: 'root.foo.foo2'});
		root.foo!.name = 'root.foo2'; // should not be recorded
		root.name = 'root2';
		root.name = 'root3'

		assert.deepEqual(watcher.changes, {
			'foo': root!.foo,
			'name': 'root3'
		});
	});
	it("tracks changes to a Mozel's collection", async () => {
		class Foo extends Mozel {
			@property(String)
			declare name?:string;
			@collection(Foo)
			declare foos:Collection<Foo>
		}
		const foo = Foo.create<Foo>({
			gid: 'root',
			foos: [{gid: 'rootFoo', name: 'rootFoo'}]
		});
		const watcher = new MozelWatcher(foo);
		watcher.start();

		foo.foos.get(0)!.name = 'rootFoo2';
		assert.isEmpty(watcher.changes, "change to collection item is not recorded");

		foo.foos.set(0, {gid: 'replaced'}, true);

		await interval(0);

		assert.deepEqual(watcher.changes, {
			foos: foo.foos
		});
	});
	it("for Mozel properties or Collections, only gid is included, unless it is a new Mozel", async () => {
		class Foo extends Mozel {
			@string()
			declare name?:string;
			@property(Foo)
			declare foo?:Foo;
			@collection(Foo)
			declare foos:Collection<Foo>
		}
		const root = Foo.create<Foo>({
			gid: 'root',
			name: 'RootFoo',
			foo:{gid: 'root.foo'},
			foos:[{gid: 'root.foos.0'}]
		});
		const watcher = new MozelWatcher(root);
		watcher.start();

		root.$set('foo', {gid: 'root.foo-2', name: 'RootFoo-2'}, true);
		root.foos.get(0)!.name = 'RootFoos0'
		root.foos.set(1, {gid: 'root.foos.1', foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo'}});

		await interval(0);
		const update = watcher.commit();
		assert.deepEqual(update!.changes, {
			'foo': { gid: 'root.foo-2', name: 'RootFoo-2', foo: undefined, foos: [] },
			'foos': [
				{gid: 'root.foos.0'},
				{gid: 'root.foos.1', name: undefined, foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo', foo: undefined, foos: []}, foos: []}
			]
		});
	});
	it("does not include updates identical to the ones already received", async () => {
		class Foo extends Mozel {
			@string()
			declare name?:string;
			@number()
			declare number?:number;
			@property(Foo)
			declare foo?:Foo;
			@collection(Foo)
			declare foos:Collection<Foo>;
		}
		const model1 = Foo.create<Foo>({gid: 'root'});
		const model2 = Foo.create<Foo>({gid: 'root'});
		const watcher1 = new MozelWatcher(model1, {priority: 1});
		const watcher2 = new MozelWatcher(model2);
		watcher1.start();
		watcher2.start();

		model1.name = 'Root-1';
		model1.$set('foo', {gid: 'root.foo', name: 'RootFoo-2'});
		model1.foos.set(0, {gid: 'root.foos.0'});

		await interval(0);

		const update1 = watcher1.commit();
		watcher2.merge(update1!);

		assert.equal(model2.name, 'Root-1');
		assert.equal(model2.foos.get(0)!.gid, 'root.foos.0');

		model2.number = 2;
		model2.foo!.name = 'RootFoo-2';
		model2.foos.get(0)!.name = 'RootFoos0';

		const update2 = watcher2.commit();

		assert.deepEqual(update2!.changes, {
			number: 2 // only the 'number' property is this MozelWatcher's responsibility
		});
	});
	describe("commit", () => {
		it("returns an update with the merge results (without overridden changes)", () => {
			class Foo extends Mozel {
				@string()
				declare foo?:string;
				@string()
				declare bar?:string;
			}
			const model1 = Foo.create<Foo>();
			const model2 = Foo.create<Foo>();
			const watcher1 = new MozelWatcher(model1, {priority: 1});
			const watcher2 = new MozelWatcher(model2);
			watcher1.start();
			watcher2.start();

			model1.foo = 'foo1';
			model2.foo = 'foo2';
			model2.bar = 'bar2';

			watcher1.commit();
			const update2 = watcher2.commit();

			assert.deepEqual(watcher1.changes, {}, "Watcher changes empty after created update.");

			const merged = watcher1.merge(update2!);
			assert.deepEqual(merged.changes, {
				'bar': 'bar2'
			}, "Merge result only includes applied change");
		});
	})
	describe("setFullState", () => {
		it("does not generate changes", () => {
			class Foo extends Mozel {
				@string()
				foo?:string;
			}
			const model1 = Foo.create<Foo>();
			const model2 = Foo.create<Foo>();

			const watcher1 = new MozelWatcher(model1);
			const watcher2 = new MozelWatcher(model2);

			model1.foo = 'abc';
			watcher2.setFullState(watcher1.createFullState());

			assert.notOk(watcher2.hasChanges(), "Watcher has no changes after setting full state.");
		});
	});
});
