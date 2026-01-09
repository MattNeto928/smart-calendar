// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the smart-calendar-mobile directory to the watchFolders
config.watchFolders = [
  ...(config.watchFolders || []),
  `${__dirname}/smart-calendar-mobile`
];

// Add additional file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
