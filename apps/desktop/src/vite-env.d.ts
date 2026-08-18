/// <reference types="vite/client" />

interface PizhouBridge {
  newWindow: () => Promise<void>;
}

interface Window {
  pizhou?: PizhouBridge;
}
