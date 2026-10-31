const base = require('./app.json').expo;

module.exports = ({ config }) => {
  const development = process.env.APP_VARIANT === 'development';
  return {
    ...config,
    ...base,
    name: development ? 'MyCircle (dev)' : 'MyCircle',
    android: {
      ...base.android,
      package: development ? 'com.anonymous.mycircle.dev' : base.android.package,
    },
    updates: {
      ...base.updates,
      checkAutomatically: 'ON_LOAD',
      requestHeaders: {
        'expo-channel-name': development ? 'development' : 'preview',
      },
    },
  };
};
