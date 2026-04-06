const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

// pnpm stores packages in .pnpm virtual store with symlinks in node_modules.
// Metro needs symlink support enabled to resolve them correctly.
const config = {
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, 'node_modules/.pnpm/node_modules'),
    ],
  },
  watchFolders: [
    path.resolve(__dirname, 'node_modules/.pnpm'),
  ],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
