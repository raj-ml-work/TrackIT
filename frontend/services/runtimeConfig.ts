type AppConfig = {
  VITE_API_URL?: string;
};

export const getRuntimeConfig = (): AppConfig => {
  if (typeof window === 'undefined') {
    return {};
  }
  const config = (window as unknown as { __APP_CONFIG__?: AppConfig }).__APP_CONFIG__;
  return config || {};
};
