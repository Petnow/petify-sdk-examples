const {INLINED_VARS, loadEnv} = require('./env');

// .env first, so the key it holds is what gets inlined below. See env.js.
loadEnv();

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['transform-inline-environment-variables', {include: INLINED_VARS}]],
};
