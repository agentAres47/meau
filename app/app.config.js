// Extends app.json: injects the Google Maps key into the native Android config
// from the environment so it's not committed. Needed for react-native-maps tiles
// in a dev/production build (Places/Directions are REST and don't need this).
module.exports = ({ config }) => {
  config.android = config.android || {};
  config.android.config = {
    ...(config.android.config || {}),
    googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY },
  };
  return config;
};
