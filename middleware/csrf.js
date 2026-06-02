const { csrfSync } = require('csrf-sync');

const { generateToken, csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) => req.body._csrf,
});

module.exports = { generateToken, csrfProtection: csrfSynchronisedProtection };