// Alternative Android app icons (adaptive: foreground, background and the themed monochrome layer), switched from
// Ajustes with expo-alternate-app-icons. Only its Android half is used: the iPhone keeps its Liquid Glass icon.
// props: [{ name, foregroundImage, backgroundImage, monochromeImage }]
const { withAdaptiveIconsGenerator } = require("expo-alternate-app-icons/plugin/build/android/withAdaptiveIconsGenerator");
const { withAndroidManifestUpdate } = require("expo-alternate-app-icons/plugin/build/android/withAndroidManifestUpdate");

module.exports = function withAndroidIconStyles(config, icons = []) {
  const alternates = icons.map(({ name, ...android }) => ({ name, android }));
  config = withAdaptiveIconsGenerator(config, alternates);
  return withAndroidManifestUpdate(config, icons.map((i) => i.name));
};
