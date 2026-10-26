// Fixture commune : chaque test échoue si la page lève une erreur JavaScript non rattrapée.
const base = require('@playwright/test');

exports.test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await use(page);
    base.expect(errors, 'erreurs JavaScript dans la page').toEqual([]);
  },
});
exports.expect = base.expect;
