import LimitedMap from "./limited-map.mjs";
import Registry from "./registry.mjs";
import composeFrom from "./compose-from.mjs";
import awaitableMixin from "./awaitable-registry-mixin.mjs";
import choicesMixin from "./choices-registry-mixin.mjs";
import identifiedMixin from "./identified-registry-mixin.mjs";
import keyedMixin from "./keyed-registry-mixin.mjs";
import lockableMixin, { LockingBehavior } from "./lockable-registry-mixin.mjs";
import moduleTranslationMixin from "./module-translation-mixin.mjs";
import uniqueMixin from "./unique-registry-mixin.mjs";
import validatedMixin from "./validated-registry-mixin.mjs";

const registryParts = {
  LimitedMap,
  Registry,
  composeFrom,
  awaitableMixin,
  choicesMixin,
  identifiedMixin,
  keyedMixin,
  lockableMixin,
  moduleTranslationMixin,
  uniqueMixin,
  validatedMixin,
  LockingBehavior
};

export default registryParts;
