# Registry: minimal base, one mixin per feature

Plan and contract. The tests are `tests/core/registry-mixins.mjs` in the tests module and are written first; they fail until the files below exist.

## Rules

- Two bases with one shape (`register`, `get`, `has`, `keys`, `values`, `entries`, `size`, iteration):
  - `limited-map.mjs` `LimitedMap` also has `delete`. The owner uses it where something is taken back.
  - `registry.mjs` `Registry` wraps a `LimitedMap` and passes on everything but removal.
- A mixin is `Base => class extends Base`. All options arrive in one object as the first constructor argument; every mixin calls `super(options)` with that same object and reads only its own keys.
- `compose(Base, m1, m2)` is `m2(m1(Base))`: later mixins are outermost, and their overrides run first. So apply `validated` before `keyed` (keys are checked first), and `lockable` after `awaitable`.
- A mixin that overrides `register` checks first, then calls `super.register`, so nothing is stored when a check throws.

## Files (`<name>-registry-mixin.mjs`, default export)

| Mixin | Adds | Options |
|---|---|---|
| `identified` | `namespace`, `name`, `hookName(suffix)`; throws without both | `namespace`, `name` |
| `keyed` | key must be a non-empty string | `keyPattern` (RegExp) |
| `validated` | `validate(definition, key)` before storing | `validate` |
| `unique` | what a second registration of a key does | `onDuplicate`: `replace` (default), `warn`, `throw` |
| `awaitable` | `ready()`, `isReady`, `hook`, `request(key)`, `require(key)` | none (hook from `identified`, else random) |
| `lockable` | `lockingBehavior`, `isLocked`; late `register`, and `delete` if the base has it; `lockable.LockingBehavior` | `lockingBehavior` |
| `choices` | `choices()`, `label(key)` | `labelOf` |

## Things the tests pin down

- `awaitable` uses `hookName()` when the registry is `identified`, and a random name when not; two anonymous registries never share a hook.
- `lockable` throws at construction when nothing below it can be ready.
- `LockAtHook` also refuses `delete` after ready (on a `LimitedMap`); the other two allow it.
- `validated` runs after `keyed`, so a bad key never reaches the validator.

## After the mixins exist

- `namespaced-registry.mjs` is `compose(LimitedMap, identified, awaitable, validated, lockable, keyed)`, taking `{ module, id }` and translating it to `{ namespace, name }`, with the same errors. That class stays `api.Registry`. It keeps `removable` and `unregister` for now (they hide `delete` unless `removable: true`) until the movement, units and property wrappers move to `LimitedMap`.
- `KindRegistry` becomes that plus `choices` and its kind-name check.
- Not built unless a consumer shows up: priority ordering, lazy definitions, per-registration change events.
- Left alone: `api.tests` (a forwarder) and `api.mixins` (dependency resolution).
