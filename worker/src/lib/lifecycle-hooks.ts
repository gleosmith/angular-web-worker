/**
 * Lifecycle hook that is called after the worker class is connected to from a client
 */
export interface OnWorkerInit {
    onWorkerInit: () => void | Promise<any>;
}
