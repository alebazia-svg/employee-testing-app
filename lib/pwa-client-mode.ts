export type PwaClientMode = 'standalone' | 'browser';

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function pwaClientModeFromSignals(input: {
  iosStandalone?: boolean;
  displayModeStandalone?: boolean;
  displayModeFullscreen?: boolean;
}): PwaClientMode {
  return input.iosStandalone || input.displayModeStandalone || input.displayModeFullscreen
    ? 'standalone'
    : 'browser';
}

export function currentPwaClientMode(): PwaClientMode {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'browser';
  return pwaClientModeFromSignals({
    iosStandalone: (navigator as StandaloneNavigator).standalone === true,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches === true,
    displayModeFullscreen: window.matchMedia?.('(display-mode: fullscreen)').matches === true,
  });
}
