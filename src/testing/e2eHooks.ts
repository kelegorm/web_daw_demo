export interface E2EHooks {
  sequencerTicks: number;
  remountApp?: () => void;
}

type E2EWindow = Window & {
  __e2eHooksEnabled?: boolean;
  __e2eHooks?: E2EHooks;
};

export function getE2EHooks(): E2EHooks | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }

  const appWindow = window as E2EWindow;
  if (!appWindow.__e2eHooksEnabled) {
    return null;
  }

  if (!appWindow.__e2eHooks) {
    appWindow.__e2eHooks = { sequencerTicks: 0 };
  }

  return appWindow.__e2eHooks;
}
