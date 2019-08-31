import { WorkerClient, WorkerDefinition, ClientWebWorker } from 'angular-web-worker/angular';
import { WebWorkerType, WorkerUtils, WorkerAnnotations } from 'angular-web-worker/common';

/**
 * **Used for Testing**
 *
 * Testing implementation a `WorkerClient`, which does not run in a worker script but mocks the serialization that occurs when messages are transfered to
 * and from a worker. Also adds a public `workerInstance` to test and spy on the worker class
 *
 */
export class WorkerTestingClient<T> extends WorkerClient<T> {

    constructor(definition: WorkerDefinition) {
        super(definition, true, true);
    }

    /**
     * Exposed instance of the private worker instance to allow testing & spying
     */
    get workerInstance(): T {
        if (this.isConnected) {
            return (this['workerRef'] as ClientWebWorker<T>).workerInstance;
        } else {
            throw new Error('Cannot access worker instance until the connect method has been called');
        }
    }
}

/**
 * Creates a new `TestWorkerClient`
 * @param workerClass worker class
 */
export function createTestClient<T>(workerClass: WebWorkerType<T>): WorkerTestingClient<T> {
    if (!WorkerUtils.getAnnotation(workerClass, WorkerAnnotations.IsWorker)) {
        throw new Error('createTestClient: the provided class must be decorated with @AngularWebWorker()');
    } else {
        return new WorkerTestingClient({ worker: workerClass, initFn: () => null });
    }
}
