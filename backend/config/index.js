const env = process.env.PROFILE || process.env.NODE_ENV || 'dev';

const map = {
  development: 'dev',
  dev: 'dev',
  qa: 'qa',
  production: 'prod',
  prod: 'prod',
};

const profile = map[env] || 'dev';

let config = {};
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  config = require(`./${profile}`);
} catch (err) {
  console.warn(`No config for profile '${profile}', falling back to defaults.`);
  config = {};
}

module.exports = Object.assign({ profile }, config);
