// Initial release: Employment Hero Payroll is not deployed in production.
// Keep every deferred family's metadata, configs, manifests, fixtures and tests in this kit.
// Only this release selection controls generated skills, agent routing, templates and catalogue cards.
const allFamilies = require('./families.js');
const deferredQIds = new Set(['Q32', 'Q33', 'Q34']);
const isIncluded = (family) => !deferredQIds.has(family.q);
module.exports = {
  families: allFamilies.filter(isIncluded),
  deferredFamilies: allFamilies.filter((family) => !isIncluded(family)),
  isIncluded,
};
