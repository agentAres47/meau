// Extends app.json: injects the Google Maps key into the native Android config
// from the environment so it's not committed. Needed for react-native-maps tiles
// in a dev/production build (Places/Directions are REST and don't need this).
module.exports = ({ config }) => {
  config.android = config.android || {};
  config.android.config = {
    ...(config.android.config || {}),
    googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY },
  };
  // google-services.json is gitignored (contains a Firebase client key), so EAS
  // Build's archive step never sees the static path in app.json's
  // android.googleServicesFile — it's uploaded instead as the EAS file secret
  // GOOGLE_SERVICES_JSON (`eas env:create ... --type file`), which resolves to a
  // real on-disk path at build time. Falls back to app.json's static
  // "./google-services.json" for local builds where the raw file sits on disk.
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  return config;
};
