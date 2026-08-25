/// <reference types="vite/client" />

interface Window {
  electron?: {
    checkForUpdates: () => void;
    onUpdateMessage: (callback: (message: string) => void) => void;
  };
}
