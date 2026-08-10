const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prioritize compiled JavaScript main & browser fields over uncompiled TS src entry points in react-native-svg
config.resolver.mainFields = ['browser', 'main', 'react-native'];

module.exports = config;
