const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Support the npm-workspaces monorepo layout.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  // RN 0.81 nests @react-native/virtualized-lists under
  // node_modules/react-native/node_modules; with hierarchical lookup
  // disabled Metro would never look there and the bundle fails.
  path.resolve(workspaceRoot, 'node_modules/react-native/node_modules'),
];

// expo-sqlite's web backend imports a `.wasm` binary; treat it as an asset
// so Metro can bundle it instead of failing resolution.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// @lumen/shared uses NodeNext-style `.js`-suffixed imports for `.ts` files
// (e.g. `./constants.js` -> `./constants.ts`), which Metro cannot resolve on
// its own. Rewrite relative `.js` imports to their TypeScript sources.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^\.{1,2}\/.+\.js$/.test(moduleName)) {
    for (const ext of ['.ts', '.tsx']) {
      try {
        return (defaultResolveRequest ?? context.resolveRequest)(
          context,
          moduleName.replace(/\.js$/, ext),
          platform,
        );
      } catch {
        // Try the next extension.
      }
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
