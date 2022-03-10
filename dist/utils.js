import { isPlainObject } from "lodash";
export { get, set, isPlainObject, isArray, isString, isBoolean, isNil, isFunction, isEmpty, uniqueId, debounce, has, includes, forEach, remove, mapValues, values, omit, isNumber, throttle, isEqual, find, map, union } from "lodash";
export function interval(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
export function call(func) {
    return func();
}
export function findDeep(object, predicate) {
    for (let key in object) {
        const value = object[key];
        if (predicate(key, value)) {
            return { [key]: value };
        }
        if (isPlainObject(value) || Array.isArray(value)) {
            return findDeep(value, predicate);
        }
    }
}
export function findAllValuesDeep(object, predicate, out) {
    if (out === undefined) {
        out = new Set();
    }
    for (let key in object) {
        const value = object[key];
        if (predicate(value, key)) {
            out.add(value);
        }
        if (isPlainObject(value) || Array.isArray(value)) {
            findAllValuesDeep(value, predicate, out);
        }
    }
    return out;
}
//# sourceMappingURL=utils.js.map