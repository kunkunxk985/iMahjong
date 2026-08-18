/// <reference types="vite/client" />

interface PizhouBridge {
  newWindow: () => Promise<void>;
  getLocalServerUrl: () => Promise<string | null>;
}

interface Window {
  pizhou?: PizhouBridge;
}
