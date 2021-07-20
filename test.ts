import Mozel, {property} from "mozel";

class Foo extends Mozel {
	@property(String)
	declare foo?:string;

	constructor(...args:any[]) {
		super(...args);
	}
}

class Base {
	foo?:string;
	constructor() {
		this.foo = '123';
	}
}

class Test extends Base {
	declare foo?:string;
}

const test = new Test();
console.log(test.foo);

const foo = Foo.create<Foo>();
// TODO: for some fucking reason, `foo` is set to `undefined` AFTER the Mozel constructor
(foo.foo as any) = 'xyz';

console.log(foo.foo);
