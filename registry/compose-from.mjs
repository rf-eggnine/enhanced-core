import LimitedMap from "./limited-map.mjs";
import Registry from "./registry.mjs";
import awaitableMixin from "./awaitable-registry-mixin.mjs";
import choicesMixin from "./choices-registry-mixin.mjs";
import identifiedMixin from "./identified-registry-mixin.mjs";
import keyedMixin from "./keyed-registry-mixin.mjs";
import lockableMixin from "./lockable-registry-mixin.mjs";
import uniqueMixin from "./unique-registry-mixin.mjs";
import validatedMixin from "./validated-registry-mixin.mjs";

/**
 * @import { ComposeFromOptions } from "./_types.mjs"
 */

/**
 * Apply registry mixins to a base, in order: `compose(Base, a, b)` is `b(a(Base))`, so the last mixin is outermost
 * and its overrides run first. Each mixin is a function from a class to a class and reads its own keys of the
 * options object given to the constructor.
 * @param {Function} Base         `Registry` or `LimitedMap`.
 * @param {...Function} mixins
 * @returns {Function}
 */
function compose(Base, ...mixins) {
  return mixins.filter(m => m !== null).reduce((Class, mixin) => mixin(Class), Base);
}

/**
 * Compose from options
 * @param {ComposeFromOptions} options
 * @returns {LimitedMap|Registry}
 */
export default function(options = {}) {
  const iterable = options.iterable ?? true;
  const removable = options.removable;
  const identified = options.identified;
  const awaitable = options.awaitable;
  const lockable = options.lockable;
  const unique = options.unique;
  const validated = options.validated;
  const keyed = options.keyed;
  const choices = options.choices;
  if ( !iterable ) throw new Error("You keep using this tool. I do not think you know what it is.");
  const Base = removable ? LimitedMap : Registry;
  return compose(
    Base,
    identified ? identifiedMixin : null,
    awaitable || lockable ? awaitableMixin : null,
    unique ? uniqueMixin : null,
    validated ? validatedMixin : null,
    awaitable || lockable ? lockableMixin : null,
    keyed ? keyedMixin : null,
    choices ? choicesMixin : null
  );
}

/**
 * Compose a Limited Map
 * @param {ComposeFromOptions} options 
 * @returns {LimitedMap}
 */
export function composeLimitedMapFrom(options = { 
    iterable: true,
    removable: true
  }) {
  if ( !options.iterable ) throw new Error("Limited map must be iterable. Did you mean `Weak limited map`?");
  if ( !options.removable ) throw new Error("Limited map must be removable. Did you mean `Registry`?");
  return composeFrom(options);
}

/**
 * Compose a Registry
 * @param {ComposeFromOptions} options 
 * @returns {Registry}
 */
export function composeRegistryFrom(options = { 
    iterable: true,
    removable: false
  }) {
  if ( !options.iterable ) throw new Error("Registry must be iterable. Did you mean `WeakRegistry`?");
  if ( options.removable ) throw new Error("Registry may not be removable. Did you mean `LimitedMap`?");
  return composeFrom(options);
}

/**
 * Compose a Limited Weak Map
 * @param {ComposeFromOptions} options 
 * @returns {LimitedWeakMap}
 */
export function composeLimitedWeakMapFrom(options = { 
    iterable: false,
    removable: true
  }) {
  if ( !options.iterable ) throw new Error("Limited weak map must not be iterable. Did you mean `Weak registry`?");
  if ( options.removable ) throw new Error("Limited weak map may not be removable. Did you mean `Limited map`?");
  return composeFrom(options);
}

/**
 * Compose Weak Registry
 * @param {ComposeFromOptions} options 
 * @returns {WeakRegistry}
 */
export function composeWeakRegistryFrom(options = { 
    iterable: false,
    removable: false
  }) {
  if ( !options.iterable ) throw new Error("Weak registry must not be iterable. Did you mean `Registry`?");
  if ( options.removable ) throw new Error("Weak registry may not be removable. Did you mean `Limited weak map`?");
  return composeFrom(options);
}
