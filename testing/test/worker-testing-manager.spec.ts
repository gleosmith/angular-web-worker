import { WorkerTestingManager, createTestManager } from '../src/lib/worker-testing-manager';
import { WorkerTestingClient } from 'testing/src/public-api';
import { AngularWebWorker } from '../../worker/src/lib/web-worker-decorator';

@AngularWebWorker()
class TestClass {
    property: string = 'propertyvalue';
}

@AngularWebWorker()
class UndecoratedClass {
}

describe('WorkerTestingManager: [angular-web-worker/testing]', () => {

    let manager: WorkerTestingManager;
    beforeEach(() => {
        manager = new  WorkerTestingManager([TestClass]);
    });

    it('Should to create a new instance of a worker client', () => {
        expect(manager.createClient(TestClass) instanceof WorkerTestingClient).toEqual(true);
    });

    it('Should through an error if no worker classes are provided', async () => {
        expect(() => new WorkerTestingManager(null)).toThrowError();
    });

});

describe('createTestManager(): [angular-web-worker/testing]', () => {

    it('Should create a new instance of a TestWorkerManager', () => {
        expect(createTestManager([TestClass]) instanceof WorkerTestingManager).toEqual(true);
    });

});
