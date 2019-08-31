import { AngularWebWorker } from '../../worker/src/public-api';
import { WorkerTestingClient, createTestClient } from 'testing/src/public-api';

@AngularWebWorker()
class TestClass {
    property: string = 'propertyvalue';
}

class UndecoratedClass {
}

describe('WorkerTestingClient: [angular-web-worker/testing]', () => {

    let worker: WorkerTestingClient<TestClass>;
    beforeEach(() => {
        worker = new WorkerTestingClient<TestClass>({worker: TestClass, initFn: () => null});
    });

    it('Should be configured for testing', () => {
        expect(worker['isTestClient']).toEqual(true);
        expect(worker['runInApp']).toEqual(true);
    });

    it('Should provide access to the underlying worker instance', async () => {
        await worker.connect();
        expect(worker.workerInstance instanceof TestClass).toEqual(true);
    }, 200);

});

describe('createTestWorker(): [angular-web-worker/testing]', () => {

    it('Should create a new instance of a TestWorkerClient', () => {
        expect(createTestClient(TestClass) instanceof WorkerTestingClient).toEqual(true);
    });

    it('Should throw an error if an undecorated class is provided', () => {
        expect(() => createTestClient(UndecoratedClass)).toThrow();
    });
});
