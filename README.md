# Enhanced Core

The shared groundwork Enhanced modules rely on. It builds and publishes the neutral API (`enhancedApi`) that modules code
against, and holds **capabilities**, the flags and defaults that modules declare for each other so a module can check
for a feature instead of branching on the game system.

A module that provides a feature declares it when it loads:

```js
const core = game.modules.get("enhanced-core")?.api ?? null;   // or api.modules.get("enhanced-core")
core?.declare({ defaultItemType: "enhanced-items.item" });
```

A module that wants the feature reads it, and carries on without it when it is not there:

```js
const itemType = enhancedApi.capabilities.defaultItemType;
if ( itemType ) await Item.create({ name, type: itemType });
```

| Member | Does |
|---|---|
| `capabilities` | The shared object, also at `enhancedApi.capabilities`. |
| `declare(capabilities)` | Adds capabilities to it; a later declaration replaces an earlier one with the same key. |

## The API layer

The module creates the API when it loads. It is a Foundry **library module** (`"library": true` in `module.json`), and
Foundry loads library modules' scripts before the game system's and before every ordinary module, whatever order the
world lists them in. The API starts with what this module provides: the module registry, the mixin registry, the test
registry, `Registry` and `deprecateMoved`. It is wrapped in the guard that warns about misspelled members, and mirrored
on `game.system.api` at init.

The game system then adds its own parts while it loads, by calling `enhancedApi.provide({ systemId, config, data, ... })`.
That happens before any ordinary module runs, so modules find the API complete. `provide` cannot replace what this module
owns. `bootstrap.mjs` creates the API and must stay the first import of `config.mjs`, because the module's own `api.mjs`
reads `globalThis.enhancedApi` when it is evaluated.

Every other module's `api.mjs` does the same read and throws `enhanced-<name> needs the enhanced-core module` when the API
is missing, instead of building a fallback.

The Enhanced system requires this module in its `system.json`.

## Registry

`api.Registry` is a generic keyed set of definitions that modules add to. The owning module creates it, modules register
into it, and the owner calls `ready()` once registration should be over:

```js
const properties = new api.Registry({ module: MODULE, id: "properties", validate: def => { /* throw to reject */ } });
properties.register("enhanced-items.weight", { label: p => p.value });

// A dependent that wants the complete set waits for the hook
Hooks.once("enhanced-items.properties.ready", registry => { /* registry.get(...), registry.has(...) */ });

properties.ready();   // fires "enhanced-items.properties.ready" once, with the registry
```

| Member | Does |
|---|---|
| `register(key, definition)` | Adds or replaces a definition; returns the registry. A `validate` function given to the constructor can reject it. |
| `get(key)` / `has(key)` | The definition, or whether there is one. |
| `keys()` / `values()` / `entries()` | Iterate what is registered, in registration order. |
| `ready()` | Fires `<module id>.<registry id>.ready` the first time; later calls do nothing. |
| `isReady`, `isLocked`, `lockingBehavior`, `id`, `hook` | State and names. |

A hook listener added after `ready()` has run will not be called, so check `registry.isReady` first.

### Locking

A registry that is read once, such as one that data models build their schemas from, should not take registrations after
that. The `lockingBehavior` option, one of `Registry.LockingBehavior`, says what a registration after `ready()` does:

| Value | A registration after `ready()` |
|---|---|
| `None` (default) | is accepted. |
| `WarnAfterHook` | is accepted, with a console warning naming the registry and the key. |
| `LockAtHook` | throws, and nothing is stored or validated. `isLocked` is true from `ready()`, including while the hook's listeners run. |

`api.modules`, where modules publish their own API, is built on a registry: `register`, `get` and `has` go straight to it, while
`require` and `findConfig` read it. Its hook, `enhanced-core.modules.ready`, fires at init once every API is mirrored on
`game.modules.get(id).api`. `api.modules.request(id)` is the graceful way to ask for an optional module: a promise for its API, or `undefined`, that
settles once every module has published. It never throws; use `require` for a module you cannot work without. It uses
`LockAtHook`: publish while your module loads, because `modules.register` after init
throws, naming the module.

## Hook names

A hook is named for the module that fires it: `<module id>.<name>`. A module writes `${MODULE.hooks}.name` (its id), core's
registries use `<module id>.<registry id>.ready`, and the hooks of the window classes, which core will own, are
`enhanced-core.prepareSheetContext` and `enhanced-core.prepareConfigSheetContext`. Listening to a hook is how one module
answers another without importing it (the dice module adds the advantage options to configuration sheets this way). The
game system's own lifecycle hook is `<system id>.ready`. `node utils/modulize.mjs <name> --check` reports a hook a module
fires under any other name.

## Data fields

`api.data.fields` starts with the fields that need nothing from a game system, which live in `data/fields/`:

| Field | Is |
|---|---|
| `MappingField` | an object of keys to one kind of field, with initial keys and per-key labels |
| `FormulaField` | a dice formula (optionally dice-free), with the effect-change operations |
| `LocalDocumentField` | a reference by id to a document embedded in the same document |
| `EnhancedTypedDataField` | an object whose model is chosen by its type, falling back to a plain object |

The game system adds what needs its own elements and tools (`FiltersField`) to the same namespace with `provide`, which
merges its namespaces into this module's and refuses to replace a class or function this module provides. Fields that come
with an input element are not here: the identifier field and its input are in the `enhanced-fields` module, which requires
this one.
