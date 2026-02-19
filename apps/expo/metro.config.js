const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force a single React/React Native instance across workspace packages.
const singleReactModules = ['react', 'react-native'];
const rootNodeModules = path.join(monorepoRoot, 'node_modules');

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singleReactModules.includes(moduleName)) {
    const resolved = path.join(rootNodeModules, moduleName);
    if (fs.existsSync(resolved)) {
      const pkg = require(path.join(resolved, 'package.json'));
      const entry = pkg.main || 'index.js';
      const filePath = path.join(resolved, entry);
      if (fs.existsSync(filePath)) {
        return { type: 'sourceFile', filePath };
      }
    }
  }

  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
