const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const {fingerprint} = require('./env');

/**
 * Editing .env has to re-transform the bundle; Metro's own cache key does not
 * see the file. See env.js.
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  cacheVersion: `petnow-env-${fingerprint()}`,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
