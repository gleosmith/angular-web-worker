import { WorkerManager, WorkerClient } from 'angular-web-worker/angular';
import { WebWorkerType } from 'angular-web-worker/common';
import { WorkerTestingClient } from './worker-testing-client';

/**
 * **Used for Testing**
 *
 * Testing implementation of the `WorkerManager` service, overriding the `createClient()` method to create a testable instance of the
 * `WorkerClient`
 *
 */
export class WorkerTestingManager extends WorkerManager {

    constructor(private workers: WebWorkerType<any>[]) {

        super(workers.map(x => {
            return { worker: x, initFn: () => null };
        }));

        if (!workers) {
            throw new Error('the workers argument for the TestWorkerManager constructor cannot be undefined or null');
        }
    }

    createClient<T>(workerType: WebWorkerType<T>, runInApp: boolean = false): WorkerClient<T> {
        const definition = this.workers.filter(p => p === workerType)[0];
        if (definition) {
            return new WorkerTestingClient<T>({ worker: workerType, initFn: () => null });
        } else {
            throw new Error('WorkerManager: all web workers must be registered in the createTestManager function');
        }
    }

}

/**
 * Creates a new `TestWorkerManager`
 * @param workers array of workers that can be created through the `createClient` method
 */
export function createTestManager(workers: WebWorkerType<any>[]): WorkerTestingManager {
    return new WorkerTestingManager(workers);
}
