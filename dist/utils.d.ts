export { get, set, isPlainObject, isArray, isString, isBoolean, isNil, isFunction, isEmpty, uniqueId, debounce, has, includes, forEach, remove, mapValues, values, omit, isNumber, throttle, isEqual, find, map } from "lodash";
export declare function interval(ms: number): Promise<unknown>;
export declare function call(func: Function): any;
export declare function findDeep(object: Record<string, any>, predicate: (value: unknown, key: string) => boolean): Record<string, unknown> | undefined;
export declare function findAllValuesDeep(object: Record<string, any>, predicate: (value: unknown, key: string) => boolean, out?: Set<any>): Set<any>;
