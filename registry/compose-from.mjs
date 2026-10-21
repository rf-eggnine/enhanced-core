import LimitedMap from "./limited-map.mjs";
import Registry from "./registry.mjs";
import awaitableMixin from "./awaitable-registry-mixin.mjs";
import choicesMixin from "./choices-registry-mixin.mjs";
import identifiedMixin from "./identified-registry-mixin.mjs";
import keyedMixin from "./keyed-registry-mixin.mjs";
import lockableMixin from "./lockable-registry-mixin.mjs";
import uniqueMixin from "./unique-registry-mixin.mjs";
import validatedMixin from "./validated-registry-mixin.mjs";
import LimitedWeakMap from "./limited-weak-map.mjs";
import WeakRegistry from "./weak-registry.mjs";

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
 * @returns {Function}
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
  if ( !iterable && (keyed || choices) ) {
    throw new Error("A registry that is not iterable (weak) has object keys and cannot be keyed or give choices.");
  }
  const Base = iterable
    ? (removable ? LimitedMap : Registry)
    : (removable ? LimitedWeakMap : WeakRegistry);
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
