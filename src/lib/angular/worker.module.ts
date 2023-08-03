import {WorkerManager} from './worker-manager';
import {ModuleWithProviders, NgModule} from '@angular/core';
import {WebWorkerType, WorkerAnnotations, WorkerUtils} from '../common';

/**
 * Provides the `WorkerManager` service with the worker definitions passed into the static `forWorkers` method.
 * @example
 * imports: [
 *  WorkerModule.forWorkers([
 *    {worker: AppWorker, initFn: () => new Worker('./app.worker.ts', {type: 'module'})},
 *  ])
 * ]
 */
@NgModule()
export class WorkerModule {

    /**
     * Returns a module with a `WorkerManager` provider
     * @param workerDefinitions list of worker defintions which contain the worker class and an `initFn` function which is necessary for the
     * webpack `worker-plugin` to bundle the worker seperately.
     * @example
     * imports: [
     *  WorkerModule.forWorkers([
     *    {worker: AppWorker, initFn: () => new Worker('./app.worker.ts', {type: 'module'})},
     *  ])
     * ]
    */
    static forWorkers(workerDefinitions: WorkerDefinition[]): ModuleWithProviders<WorkerModule> {

        workerDefinitions.forEach((definition) => {
            if (!WorkerUtils.getAnnotation(definition.worker, WorkerAnnotations.IsWorker)) {
                throw new Error('WorkerModule: one or more of the provided workers has not been decorated with the @AngularWebWorker decorator');
            }
        });

        return {
            ngModule: WorkerModule,
            providers: [
                { provide: WorkerManager, useValue: new WorkerManager(workerDefinitions) }
            ]
        };
    }

}

/**
 * A definition of a worker that is required to create new worker instances
 */
export interface WorkerDefinition {
    /**
     * the worker class which has been decorated with `@AngularWebWorker()`
     */
    worker: WebWorkerType<any>;
    /**
     * A function that creates a worker. This is required for the webpack `worker-plugin` to bundle the worker seperately and is used by a `WorkerClient`
     * to create a new worker
     *
     * **IMPORTANT**
     *
     * The syntax is crucial for the webpack plugin. The path must be a string and the {type: 'module'} argument must be given
     * @example
     * () => new Worker('./app.worker.ts', {type: 'module'})
     */
    initFn: () => Worker;
}



