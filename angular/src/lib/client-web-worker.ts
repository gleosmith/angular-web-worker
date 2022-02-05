import { WorkerController } from 'angular-web-worker';
import { WebWorkerType, WorkerMessageBus } from 'angular-web-worker/common';

/**
 * Used to mock the behaviour of the native `Worker` class when a `WorkerClient` is set to run in the app and not in the worker script.
 * Controls the flow of messages to and from a `WorkerClient` and a `WorkerController`
 */
export class ClientWebWorker<T> implements Worker {

    /**
     * Handles execution of code in a worker
     */
    private controller: WorkerController<T>;

    /**
     * Interface for message bus provided into a `WorkerController` allowing the communication mechanism to be interchanged between in-app, and native worker
     * communication mechansims
     */
    private messageBus: WorkerMessageBus;

    /**
     * Creates a new instance of a `ClientWebWorker`
     * @param workerType the worker class
     * @param isTestClient whether the instance is used for testing which will then mock serialization
     */
    constructor(workerType: WebWorkerType<T>, private isTestClient: boolean) {
        this.messageBus = {
            onmessage: () => { },
            postMessage: (resp: any) => {
                this.onmessage(new MessageEvent('ClientWebWorker', { data: this.isTestClient ? this.serialize(resp) : resp }));
            }
        };
        this.controller = new WorkerController(workerType, this.messageBus);
    }
    onmessageerror: (this: Worker, ev: MessageEvent<any>) => any;

    /**
     * Returns instance of worker class
     */
    get workerInstance(): T {
        return this.controller.workerInstance;
    }

    /**
     * Message listener for a `WorkerClient`
     */
    onmessage(ev: MessageEvent) {
    }

    /**
     * Sends messages triggered from a `WorkerClient` to a `WorkerController`
     */
    postMessage(resp: any) {
        this.messageBus.onmessage(new MessageEvent('ClientWebWorker', { data: this.isTestClient ? this.serialize(resp) : resp }));
    }

    /**
     * Unsubscribes from all subscriptions in the `WorkerController` and then destroys the controller
     */
    terminate() {
        this.controller.removeAllSubscriptions();
        this.controller = null;
    }

    /**
     * Used for testing to mock the serialization that occurs when native the postMessage or onmessage are used to communicate with a worker script
     * @param obj object to be serialised
     */
    private serialize(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }


    /**
     * Ensures class conforms to the native `Worker` class
     * @NotImplemented
     */
    onerror(err: any) {
    }

    /**
     * Ensures class conforms to the native `Worker` class
     * @NotImplemented
     */
    addEventListener() {
    }

    /**
     * Ensures class conforms to the native `Worker` class
     * @NotImplemented
     */
    removeEventListener() {
    }


    /**
     * Ensures class conforms to the native `Worker` class
     * @NotImplemented
     */
    dispatchEvent(evt: Event): boolean {
        return true;
    }



}
