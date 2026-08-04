export const getWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram && (window as any).Telegram.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
};

export const WebApp = new Proxy({} as any, {
  get(_target, prop) {
    const webApp = getWebApp();
    if (webApp) {
      const value = webApp[prop];
      if (typeof value === 'function') {
        return value.bind(webApp);
      }
      return value;
    }
    return undefined;
  },
  set(_target, prop, value) {
    const webApp = getWebApp();
    if (webApp) {
      webApp[prop] = value;
      return true;
    }
    return false;
  }
});
