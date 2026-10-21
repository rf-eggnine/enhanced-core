
/**
 * @typedef {object} ComposeFromOptions
 * @property {boolean} [iterable=true] false stores in a `WeakMap`: keys are objects, held weakly, and the registry
 *   cannot be listed (no keys, values, entries, size or iteration), so it cannot be `keyed` or `choices`
 * @property {boolean} removable enables the `unregister` method
 * @property {boolean} identified requires namespace and name
 * @property {boolean} awaitable enables the awaitable request method
 * @property {boolean} lockable allows lock behavior at the hook
 * @property {boolean} unique allows definition of how to handle updates
 * @property {boolean} validated allows reception of the validate method
 * @property {boolean} keyed rejects empty string keys and optionally matches keys to a pattern
 * @property {boolean} choices provides the keys an labels as choices, requires labelof
 */
