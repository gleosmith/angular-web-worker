import { WorkerModule, WorkerManager } from 'angular-web-worker/angular';
import { WebWorkerType, WorkerUtils, WorkerAnnotations } from 'angular-web-worker/common';
import { WorkerTestingManager } from './worker-testing-manager';

/**
 * **Used for Testing**
 *
 * Testing implementation a `WorkerModule`, which provides a `WorkerTestingManager` that creates testable worker client that dos not run in a worker script but mocks the serialization that occurs when messages are transfered to
 * and from a worker.
 */
export class WorkerTestingModule {

    static forWorkers(workers: WebWorkerType<any>[]) {

        workers.forEach((wkr) => {
            if (!WorkerUtils.getAnnotation(wkr, WorkerAnnotations.IsWorker)) {
                throw new Error('WorkerModule: one or more of the provided workers has not been decorated with the @AngularWebWorker decorator');
            }
        });

        return {
            ngModule: WorkerModule,
            providers: [
                { provide: WorkerManager, useValue: new WorkerTestingManager(workers) }
            ]
        };
    }
}
