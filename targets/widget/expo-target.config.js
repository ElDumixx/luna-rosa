/** iOS home-screen widget (WidgetKit), added to the Xcode project by @bacons/apple-targets. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LunaWidget",
  icon: "../../assets/icon.png",
  deploymentTarget: "17.0",
  colors: {
    $accent: "#E88AA6",
    $widgetBackground: { light: "#FCE7EE", dark: "#3E2A34" },
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
