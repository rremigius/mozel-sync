import {isPlainObject, uniqWith, isEqual} from "lodash";

export {
	get,
	set,
	isPlainObject,
	isArray,
	isString,
	isBoolean,
	isNil,
	isFunction,
	isEmpty,
	uniqueId,
	debounce,
	has,
	includes,
	forEach,
	remove,
	mapValues,
	values,
	omit,
	isNumber,
	throttle,
	isEqual,
	find,
	map
} from "lodash";

export function interval(ms:number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function call(func:Function) {
	return func();
}

export function findDeep(object:Record<string, any>, predicate:(value:unknown, key:string) => boolean):Record<string, unknown>|undefined {
	for(let key in object) {
		const value = object[key];
		if(predicate(key, value)) {
			return {[key]: value};
		}
		if(isPlainObject(value) || Array.isArray(value)) {
			return findDeep(value, predicate);
		}
	}
}
export function findAllValuesDeep(object:Record<string, any>, predicate:(value:unknown, key:string) => boolean, out?:Set<any>) {
	if(out === undefined) {
		out = new Set<any>();
	}
	for(let key in object) {
		const value = object[key];
		if(predicate(value, key)) {
			out.add(value);
		}
		if(isPlainObject(value) || Array.isArray(value)) {
			findAllValuesDeep(value, predicate, out);
		}
	}
	return out;
}
