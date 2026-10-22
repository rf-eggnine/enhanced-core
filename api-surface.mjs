import { MODULE } from "./module-info.mjs";
import { guard, warnOnce } from "./api-guard.mjs";
import composeFrom from "./registry/compose-from.mjs";

/**
 * The shape of the API: a registry of members whose namespaces are registries of their own, behind a Proxy that keeps
 * the property syntax (`api.data.fields.X`, `api.capabilities.y = 1`). Reading goes to `get`, writing to `register`,
 * and each level decides what a second registration of a key does (see the `unique` mixin): the top level refuses it,
 * a closed namespace such as `capabilities` replaces and warns, and an open namespace such as `data` merges. A
 * registry is still the preferred way to reach any of it: `api.capabilities.register("x", 1)`. A module adds to an
 * open namespace, or creates one, with `moduleProvides`; the system supplies its parts with `systemProvides`.
 */

const Members = composeFrom({ identified: true, unique: true, keyed: true });

/** What a namespace answers to besides its members: the registry's own way in. A member of that name wins. */
const REGISTRY_METHODS = new Set(["register", "get", "has", "keys", "values", "entries"]);

/**
 * Is this a plain object, one that may become a namespace of the API?
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if ( !value || (typeof value !== "object") ) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype) || (prototype === null);
}

/**
 * Create the surface of an API.
 * @param {object} [options]
 * @param {string} [options.name="advancedApi"]  How the API is named in messages.
 * @returns {{ api: object, coreRegister: Function, coreRegisterSystemValue: Function, createCoreNamespace: Function,
 *   coreProvides: Function, integrateCoreParts: Function }}
 */
export function createSurface({ name="advancedApi" }={}) {
  /** The top level: refuses a member that is registered twice. */
  const members = new Members({ namespace: MODULE.id, name: "api", onDuplicate: "throw" });
  /** Members that are values the host sets once, such as `systemId`; undefined until then. */
  const values = new Map();
  /** The namespaces a module or the host may add to. */
  const open = new Set();
  /** The namespaces: name to registry. */
  const spaces = new Map();
  /** Accessors defined on the API (`deprecateMoved`): they are consulted before the registry. */
  const accessors = new Map();
  /** One view per namespace, so `api.data === api.data`. */
  const views = new WeakMap();

  /**
   * The view of a namespace registry: property syntax over `get`, `register` and `keys`.
   * @param {object} registry
   * @returns {object}
   */
  function view(registry) {
    const known = views.get(registry);
    if ( known ) return known;
    const proxy = new Proxy({}, {
      get: (_, key) => {
        if ( registry.has(key) ) return registry.get(key);
        if ( REGISTRY_METHODS.has(key) ) return registry[key].bind(registry);
        return (key === "size") ? registry.size : undefined;
      },
      set: (_, key, value) => {
        registry.register(key, value);
        return true;
      },
      has: (_, key) => registry.has(key),
      ownKeys: () => Array.from(registry.keys()),
      getOwnPropertyDescriptor: (_, key) => registry.has(key)
        ? { value: registry.get(key), writable: true, enumerable: true, configurable: true } : undefined,
      deleteProperty: (_, key) => {
        throw new Error(`"${String(key)}" cannot be removed from the API.`);
      },
      defineProperty: () => {
        throw new Error("Define a member of the API with register.");
      }
    });
    views.set(registry, proxy);
    return proxy;
  }

  /**
   * Add a namespace: a registry the API exposes as a property.
   * @param {string} key
   * @param {object} [options]
   * @param {boolean} [options.open=false]   Whether `moduleProvides` and the system may add to it.
   * @param {string} [options.onDuplicate]   What a second registration of a key does: `merge` when open, else `warn`.
   * @returns {object}  The registry.
   */
  function namespace(key, { open: isOpen=false, onDuplicate=isOpen ? "merge" : "warn" }={}) {
    const registry = new Members({ namespace: MODULE.id, name: key, onDuplicate });
    spaces.set(key, registry);
    if ( isOpen ) open.add(key);
    members.register(key, view(registry));
    return registry;
  }

  /**
   * Is this member one that the host and modules may not replace or add to?
   * @param {string} key
   * @returns {boolean}
   */
  const isClosed = key => values.has(key) || accessors.has(key) || (members.has(key) && !open.has(key));

  /**
   * Add parts to an open namespace, creating it when the API has none by that name. Published as `moduleProvides`.
   * @param {string} key
   * @param {object} parts
   */
  function contribute(key, parts) {
    if ( (typeof key !== "string") || !key ) throw new Error("moduleProvides needs the name of a namespace.");
    if ( isClosed(key) ) throw new Error(`moduleProvides cannot add to the API member ${key}.`);
    if ( !isPlainObject(parts) ) throw new Error(`moduleProvides("${key}") needs an object of parts.`);
    const registry = spaces.get(key) ?? namespace(key, { open: true });
    for ( const [part, value] of Object.entries(parts) ) registry.register(part, value);
  }

  /**
   * What the system supplies besides its own values: plain objects are merged into namespaces, other values are
   * registered as members. Used by `systemProvides`.
   * @param {object} parts
   * @throws {Error}  When it names a member that is closed.
   */
  function addParts(parts) {
    const closed = Object.keys(parts).filter(isClosed);
    if ( closed.length ) throw new Error(`The system cannot replace Advanced API members: ${closed.join(", ")}.`);
    for ( const [key, value] of Object.entries(parts) ) {
      if ( isPlainObject(value) ) contribute(key, value);
      else members.register(key, value);
    }
  }

  /** The API as callers see it. */
  const surface = new Proxy({}, {
    get(_, key) {
      if ( values.has(key) ) return values.get(key);
      if ( accessors.has(key) ) return accessors.get(key).get?.call(surface);
      return members.get(key);
    },
    set(_, key, value) {
      if ( values.has(key) ) {
        if ( values.get(key) !== undefined ) throw new Error(`The API member ${String(key)} is already set.`);
        values.set(key, value);
      } else if ( accessors.has(key) ) {
        const { set } = accessors.get(key);
        if ( !set ) throw new Error(`The API member ${String(key)} cannot be set.`);
        set.call(surface, value);
      } else {
        if ( isPlainObject(value) && !members.has(key) ) {
          warnOnce(`${name} | "${String(key)}" was registered as a plain object, not a namespace. To add a namespace, `
            + `use moduleProvides("${String(key)}", { ... }).`);
        }
        members.register(key, value);
      }
      return true;
    },
    has: (_, key) => values.has(key) || accessors.has(key) || members.has(key),
    ownKeys: () => [...members.keys(), ...values.keys(), ...accessors.keys()].filter(key => typeof key === "string"),
    getOwnPropertyDescriptor(_, key) {
      if ( !(values.has(key) || accessors.has(key) || members.has(key)) ) return undefined;
      return { value: surface[key], writable: true, enumerable: true, configurable: true };
    },
    deleteProperty: (_, key) => {
      throw new Error(`"${String(key)}" cannot be removed from the API.`);
    },
    defineProperty(_, key, descriptor) {
      if ( members.has(key) || values.has(key) ) throw new Error(`The API member ${String(key)} cannot be redefined.`);
      if ( "value" in descriptor ) members.register(key, descriptor.value);
      else accessors.set(key, descriptor);
      return true;
    }
  });

  return {
    api: guard(name, surface),
    /**
     * Add a member at creation.
     * @param {string} key
     * @param {*} value
     * @returns {object}
     */
    coreRegister: (key, value) => members.register(key, value),
    /**
     * Add a member that is a value the host sets once; reads as undefined until then.
     * @param {string} key
     * @returns {Map}
     */
    coreRegisterSystemValue: key => values.set(key, undefined),
    createCoreNamespace: namespace,
    coreProvides: contribute,
    integrateCoreParts: addParts,
  };
}
