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

## Precedence

A world setting (**Precedence**, in the settings of Enhanced Core) says who has the last word where the game system and the Enhanced
modules both set the same thing, such as a class on `CONFIG`: `host`, the game system's own choice (the default), or `enhanced`.
It is the module's own API, not the neutral one: `api.modules.require("enhanced-core")` has `PRECEDENCE`, `precedence()` and
`enhancedHasPrecedence()`. A library module sets what it wants at `init`, which is before the system's, so the system wins by default;
a module that can take its thing back does it at `setup` when `enhancedHasPrecedence()` is true. The ui module's drag and drop class
does this. Reload to apply a change. It is one setting for all the modules for now.

## Mixin exclusions

The world setting `mixinExclusions` (`enhanced-core.mixinExclusions`, kept out of the settings screen) lists the mixins a world has opted
out of, `{ "<mixin id>": ["<type>", ...] }`. The mixin registry, which is this module's, reads it as each mixin is applied. A host that
still passes `mixinExclusionsSetting` to `provide` is warned and ignored.

## The API layer

The module creates the API when it loads. It is a Foundry **library module** (`"library": true` in `module.json`), and
Foundry loads library modules' scripts before the game system's and before every ordinary module, whatever order the
world lists them in. The API starts with what this module provides: the module registry, the mixin registry, the test
registry, `Registry` and `deprecateMoved`. It is wrapped in the guard that warns about misspelled members, and mirrored
on `game.system.api` at init.

The game system then adds its own parts while it loads, by calling `enhancedApi.provide({ systemId, cssNamespace, config, data, ... })`.
That happens before any ordinary module runs, so modules find the API complete. `provide` cannot replace what this module
owns. `bootstrap.mjs` creates the API and must stay the first import of `config.mjs`, because the module's own `api.mjs`
reads `globalThis.enhancedApi` when it is evaluated.

A module adds to a namespace of the API with `enhancedApi.contribute("applications", { ... })`, while it evaluates: the parts
are merged into what is there, as the host's are, and a class or function that is already there is not replaced.
Foundry decides the order the scripts of the modules run in, and it can change with a version or differ between hosts, so nothing
relies on it. The libraries run before the ordinary modules and the system before them (Foundry documents that), but `requires`
does not change the order of scripts, and the order among libraries, and among ordinary modules, is not ours to count on (it is
alphabetical in practice). So a module reads another module's API in the init hook, when every module has published, and not while
it loads, whatever the ids are (`enhanced-containers` makes its model there, `enhanced-damage` builds its roll there). Reading a
library's API while loading is the one exception that is only a note: it rests on the libraries running first. `modulize --check`
reports a module that reads the API of an ordinary module while it loads as an error.

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

## Kinds

`api.KindRegistry` is a `Registry` of the kinds of something: the kinds of aspect, of meta-actor, of activity. A kind is
named `<module id>.<name>`, so two modules never claim the same one, and has a `label` (a localization key) and, when what it
describes has data of its own, a `dataModel`. Anything else in the definition is kept for the owner. The owner makes the
registry and the modules that define a kind register it:

```js
const metaKinds = new api.KindRegistry({ module: MODULE, id: "meta-kinds" });
metaKinds.register("enhanced-factions.faction", { label: "FACTIONS.Faction", dataModel: FactionData });
```

| Member | Does |
|---|---|
| `getModel(kind)` | The kind's data model, or `null`. |
| `label(kind)` | The label in the player's language, or an empty string. |
| `choices()` | The kinds as `{ value, label }` options for a select, in registration order. |

`api.data.fields.KindDetailsField` holds the data of a document's kind. It reads the kind from a sibling property (`kind`, or the
one named by `kindKey`) and uses the kind's data model from the registry (`kinds`). A kind that is not registered keeps its
details as a plain object, so a world that loses a module loses no data:

```js
kind: new StringField({ required: true, blank: true, initial: "" }),
details: new KindDetailsField({ kinds: metaKinds })
```

## Hook names

A hook is named for the module that fires it: `<module id>.<name>`. A module writes `${MODULE.hooks}.name` (its id), core's
registries use `<module id>.<registry id>.ready`, and the hooks of the window classes, which the ui module owns, are
`enhanced-ui.prepareSheetContext` and `enhanced-ui.prepareConfigSheetContext`. Listening to a hook is how one module
answers another without importing it (the dice module adds the advantage options to configuration sheets this way). The
game system's own lifecycle hook is `<system id>.ready`. `node utils/modulize.mjs <name> --check` reports a hook a module
fires under any other name.
