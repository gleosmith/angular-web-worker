import {AngularWebWorker} from '../worker';
import {WorkerManager} from './worker-manager';
import {WorkerClient} from './worker-client';
import {WorkerDefinition} from './worker.module';


@AngularWebWorker()
class TestClass {
    name: string = 'random';
}

@AngularWebWorker()
class TestClass2 {
    name: string = 'random22';
}

describe('WorkerManager: [angular-web-worker/angular]', () => {

    let manager: WorkerManager;
    function privateWorkerDefintion(client: WorkerClient<any>): WorkerDefinition  {
        return client['definition'];
    }

    beforeEach(() => {
        manager = new WorkerManager([{worker: TestClass, initFn: null}]);
    });

    it('Should create a new worker client with a defintion', () => {
        const client = manager.createClient(TestClass);
        expect(privateWorkerDefintion(client)).toEqual({worker: TestClass, initFn: null});
    });

    it('Should throw an error if the worker class argument does not have a definition', () => {
        expect(() => manager.createClient(TestClass2)).toThrowError();
    });

});
