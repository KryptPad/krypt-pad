declare global {
    interface Window { bridge: any; }
}

//window.bridge = window.bridge || {};

/**
 * This script gets the context bridge between main process and render process via IPC.
 */
const bridge = window.bridge;

export { bridge };