import composeFrom from "./registry/compose-from.mjs";
import { warnOnce } from "./api-guard.mjs";
import { MODULE } from "./module-info.mjs";

/**
 * Tripwires on Foundry's registries (`CONFIG` and what is under it). They never block and never change a result:
 * every write goes through to the real object. They only notice when someone replaces or deletes something a different
 * writer put there, and say so once.
 *
 * Only plain objects and arrays are wrapped, as the containers of a registry. Functions, classes, class instances,
 * frozen objects and the values in a container are left alone, because a Proxy is a different identity from its target.
 */

/** How deep into a container the nested objects are wrapped. */
const DEPTH = 4;

/** The owner of what was there before the watch was installed. */
const PREEXISTING = "foundry";

/**
 * Can this be wrapped in a Proxy as the container of a registry?
 * @param {*} value
 * @returns {boolean}
 */
function isWrappable(value) {
  if ( !value || (typeof value !== "object") || Object.isFrozen(value) ) return false;
  if ( Array.isArray(value) ) return true;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype) || (prototype === null);
}

/**
 * Who is writing, from the call stack: the first frame in a module's or a system's own files. A write that goes through
 * one of Foundry's helpers (`mergeObject`) is still the caller's. When no frame is anyone's, it is Foundry's.
 * @param {string} [stack]
 * @returns {string}  A module id, `system:<id>`, or `foundry`.
 */
export function ownerFromStack(stack=new Error().stack) {
  for ( const line of String(stack).split("\n") ) {
    if ( line.includes("foundry-watch") ) continue;
    const match = /\/(modules|systems)\/([^/]+)\//.exec(line);
    if ( match ) return (match[1] === "systems") ? `system:${match[2]}` : match[2];
  }
  return PREEXISTING;
}

/**
 * A matcher for the exceptions: a string that may end in `*` for a prefix.
 * @param {string} pattern
 * @returns {(value: string) => boolean}
 */
function matcher(pattern) {
  if ( pattern === "*" ) return () => true;
  return pattern.endsWith("*") ? value => value.startsWith(pattern.slice(0, -1)) : value => value === pattern;
}

/**
 * Create a watch over a root object (`CONFIG`). Nothing is wrapped until `install()`.
 * @param {object} root
 * @param {object} [options]
 * @param {string} [options.name="CONFIG"]               The root's name in paths and messages.
 * @param {{ path: string, owner: string }[]} [options.exceptions]  Writes that stay silent.
 * @param {() => boolean} [options.enabled]              Asked at each write; false forwards without a word.
 * @param {() => boolean} [options.log]                  Asked at each write; true prints every write to the console.
 * @param {() => string} [options.ownerOf]               Who is writing (default: the call stack).
 * @param {(message: string) => void} [options.warn]     Where warnings go (default: once per message to the console).
 * @param {number} [options.depth]                       How deep nested objects are wrapped.
 * @returns {{ install: Function, register: Function, report: Function, owners: object }}
 */
export function createWatch(root, {
  name="CONFIG", exceptions=[], enabled=() => true, log=() => false, ownerOf=ownerFromStack, warn=warnOnce, depth=DEPTH
}={}) {
  const Owners = composeFrom({ identified: true, keyed: true });
  /** Who last wrote each path. */
  const owners = new Owners({ namespace: MODULE.id, name: "watch-owners" });
  /** One proxy per target, so `===` holds however a container is reached. */
  const proxies = new WeakMap();
  /** The target of each proxy, so a proxy that is written back is stored as the real object. */
  const targets = new WeakMap();
  /**
   * The real object behind a value that may be one of our proxies.
   * @param {*} value
   * @returns {*}
   */
  const unwrap = value => (value && (typeof value === "object") && targets.get(value)) || value;
  const silenced = exceptions.map(({ path, owner }) => ({ path: matcher(path), owner: matcher(owner) }));
  const events = [];
  let override = null;

  /**
   * Handle a write: record it, and warn when it replaces or deletes what another writer put there.
   * @param {"set"|"delete"|"replace"} op
   * @param {string} path
   * @param {{ had: boolean, old: any, value?: any }} change
   */
  function note(op, path, { had, old, value }) {
    if ( !enabled() ) return;
    const owner = override ?? ownerOf();
    const recorded = owners.get(path);
    const previous = recorded ? recorded.owner : (had ? PREEXISTING : null);
    const event = { op, path, owner, previous };
    if ( events.length < 500 ) events.push(event);
    if ( log() ) console.debug(`Advanced watch | ${op} ${path} by ${owner}`, { previous, old, value });
    if ( op === "delete" ) owners.register(path, { owner: null });
    else if ( op === "replace" || !had || !Object.is(old, value) ) owners.register(path, { owner });
    const changed = had && ((op === "delete") || !Object.is(old, value));
    if ( !changed || (previous === null) || (previous === owner) ) return;
    if ( silenced.some(rule => rule.path(path) && rule.owner(owner)) ) return;
    const verb = (op === "delete") ? "deleted" : "replaced";
    warn(`${path} was ${verb} by "${owner}"; it was set by "${previous}".`);
  }

  /**
   * The path of a member of a container.
   * @param {string} path
   * @param {object} target
   * @param {string|symbol} key
   * @returns {string}
   */
  const child = (path, target, key) => Array.isArray(target) ? `${path}[${String(key)}]` : `${path}.${String(key)}`;

  /**
   * Wrap a container, or return it unchanged when it cannot be wrapped.
   * @param {object} target
   * @param {string} path
   * @param {number} level
   * @returns {object}
   */
  function wrap(target, path, level) {
    if ( !isWrappable(target) || (level > depth) ) return target;
    const known = proxies.get(target);
    if ( known ) return known;
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        const value = Reflect.get(object, key, receiver);
        if ( (typeof key === "symbol") || !isWrappable(value) ) return value;
        const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
        if ( descriptor && !descriptor.configurable && !descriptor.writable ) return value;
        return wrap(value, child(path, object, key), level + 1);
      },
      set(object, key, written) {
        const value = unwrap(written);
        if ( (typeof key === "symbol") || (Array.isArray(object) && (key === "length")) ) {
          return Reflect.set(object, key, value);
        }
        const here = child(path, object, key);
        const had = Object.hasOwn(object, key);
        note("set", here, { had, old: object[key], value });
        return Reflect.set(object, key, value);
      },
      defineProperty(object, key, descriptor) {
        if ( (typeof key !== "symbol") && ("value" in descriptor) && !(Array.isArray(object) && (key === "length")) ) {
          const here = child(path, object, key);
          note("set", here, { had: Object.hasOwn(object, key), old: object[key], value: descriptor.value });
        }
        return Reflect.defineProperty(object, key, descriptor);
      },
      deleteProperty(object, key) {
        if ( typeof key !== "symbol" ) {
          note("delete", child(path, object, key), { had: Object.hasOwn(object, key), old: object[key] });
        }
        return Reflect.deleteProperty(object, key);
      }
    });
    proxies.set(target, proxy);
    targets.set(proxy, target);
    return proxy;
  }

  /**
   * Put the watch on the containers of the root. Each wrappable value becomes an accessor that hands out the proxy, and
   * that notices when the whole container is replaced.
   */
  function install() {
    for ( const key of Reflect.ownKeys(root) ) {
      if ( typeof key === "symbol" ) continue;
      const descriptor = Reflect.getOwnPropertyDescriptor(root, key);
      if ( !descriptor?.configurable ) continue;
      const path = `${name}.${key}`;
      if ( "value" in descriptor ) {
        if ( !isWrappable(descriptor.value) ) continue;
        let current = descriptor.value;
        Object.defineProperty(root, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: () => wrap(current, path, 1),
          set: written => {
            const value = unwrap(written);
            note("replace", path, { had: true, old: current, value });
            current = value;
          }
        });
      } else if ( descriptor.get ) {
        const { get, set } = descriptor;
        Object.defineProperty(root, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get() {
            return wrap(get.call(root), path, 1);
          },
          set(value) {
            note("replace", path, { had: true, old: get.call(root), value });
            set?.call(root, value);
          }
        });
      }
    }
  }

  /**
   * Write a member of a watched container as a named owner, so our own registrations never warn about themselves.
   * @param {string} path   The container, like `CONFIG.Dice.rolls` (the root's name first).
   * @param {string|number} key
   * @param {any} value
   * @param {string} [owner]  Defaults to the caller found on the stack.
   */
  function register(path, key, value, owner=ownerFromStack()) {
    const parts = path.split(".");
    if ( parts.shift() !== name ) throw new Error(`The path "${path}" does not start with ${name}.`);
    let container = root;
    for ( const part of parts ) container = container?.[part];
    if ( !container || (typeof container !== "object") ) throw new Error(`There is nothing at ${path}.`);
    override = owner;
    try {
      container[key] = value;
    } finally {
      override = null;
    }
  }

  return {
    install,
    register,
    owners,
    /**
     * The writes seen so far, newest last (the first 500).
     * @returns {{ op: string, path: string, owner: string, previous: string|null }[]}
     */
    report: () => events.slice()
  };
}
