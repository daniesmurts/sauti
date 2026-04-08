#!/usr/bin/env node
/**
 * Patches react-native-config/index.js to gracefully handle the native module
 * being null.  react-native-config >=1.6 unconditionally calls
 * NativeConfigModule.default.getConfig() at require-time which crashes when
 * the TurboModule codegen bridge returns null (old architecture).
 *
 * Run automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');

const target = path.resolve(
  __dirname,
  '../node_modules/react-native-config/index.js',
);

const patched = `"use strict";

let Config = {};
try {
  const NativeModule = require("./codegen/NativeConfigModule").default;
  if (NativeModule && typeof NativeModule.getConfig === "function") {
    Config = NativeModule.getConfig().config || {};
  }
} catch (_) {
  // Native module unavailable - graceful fallback
}

module.exports = Config;
module.exports.Config = Config;
module.exports.default = Config;
`;

try {
  fs.writeFileSync(target, patched, 'utf8');
  console.log('[patch] react-native-config/index.js patched successfully.');
} catch (err) {
  console.warn('[patch] Could not patch react-native-config:', err.message);
}
