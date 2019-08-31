import { AngularWebWorker, WorkerController, Callable, ShallowTransfer, Accessable, OnWorkerInit, Subscribable } from '../src/public-api';
import { WorkerRequestEvent, WorkerCallableBody, WorkerSubscribableBody, WorkerObservableMessage, WorkerObservableMessageTypes } from '../../common/src/public-api';
import { WorkerEvents, WorkerAnnotations, WorkerResponseEvent, WorkerAccessableBody } from '../../common/src/public-api';
import { Subject, Subscription } from 'rxjs';

class TestUser {

    name: string;
    age: number;

    constructor(user: Partial<TestUser>) {
        this.age = user.age;
        this.name = user.name;
    }

    birthday() {
        this.age++;
    }
}

@AngularWebWorker()
class TestClass implements OnWorkerInit {

    @Accessable() setTestProp: number;
    @Accessable() getTestProp: string = 'testvalue';
    @Accessable({ shallowTransfer: true }) transferableTestProp: TestUser;
    @Subscribable() subscriptionTest: Subject<any> = new Subject<string>();
    @Subscribable() undefinedSubscriptionTest: Subject<any>;

    constructor() { }

    onWorkerInit() {
    }

    @Callable()
    argsTestFn(name: string, age: number) {
    }

    @Callable()
    syncReturnTestFn() {
        return 'sync';
    }

    @Callable()
    async asyncReturnTestFn() {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve('async');
            }, 100);
        });
    }

    @Callable()
    shallowTransferTestFn(baseAge: number, @ShallowTransfer() user: TestUser) {
        user.birthday();
        return baseAge + user.age;
    }


    @Callable()
    errorTestFn() {
        throw new Error('error');
    }

}

describe('WorkerController: [angular-web-worker]', () => {

    function createRequest<T extends number>(type: T, propertyName?: string, body?: any): WorkerRequestEvent<T> {
        return <WorkerRequestEvent<T>>{
            type: type,
            body: body ? JSON.parse(JSON.stringify(body)) : null,
            propertyName: propertyName,
            requestSecret: 'secret'
        };
    }

    function createResponse(request: WorkerRequestEvent<any>, result?: any): WorkerResponseEvent<any> {
        return <WorkerResponseEvent<any>>{
            type: request.type,
            result: result,
            isError: false,
            propertyName: request.propertyName,
            requestSecret: 'secret'
        };
    }

    function privateWorker<T>(workerController: WorkerController<T>): TestClass {
        return workerController['worker'];
    }

    function privateSubscriptionsDict<T>(workerController: WorkerController<T>): { [id: string]: Subscription } {
        return workerController['subscriptions'];
    }

    let controller: WorkerController<TestClass>;

    beforeEach(() => {
        controller = new WorkerController(TestClass, <any>window);
    });

    it(`Should call the worker factory annotation to create a new worker instance with a non-client config`, () => {
        const spy = spyOn<any>(TestClass[WorkerAnnotations.Annotation], WorkerAnnotations.Factory).and.callThrough();
        controller = new WorkerController(TestClass,  <any>window);
        expect(spy).toHaveBeenCalledWith({ isClient: false });
    });

    it(`Should call the handleInit method when a init client request is recieved through onmessage`, () => {
        const spy = spyOn(controller, 'handleInit');
        const initRequest = createRequest(WorkerEvents.Init);
        window.onmessage(new MessageEvent('mock-event', {
            data: initRequest
        }));
        expect(spy).toHaveBeenCalledWith(initRequest);
    });

    it(`Should call the OnWorkerInit hook if implemented`, () => {
        const spy = spyOn(privateWorker(controller), 'onWorkerInit');
        controller.handleInit(createRequest(WorkerEvents.Init));
        expect(spy).toHaveBeenCalled();
    });

    describe('Callables', () => {

        it(`Should call the handleCallable method when a callable client request is recieved through onmessage`, () => {
            const spy = spyOn(controller, 'handleCallable');
            const callableRequest = createRequest(WorkerEvents.Callable);
            window.onmessage(new MessageEvent('mock-event', {
                data: callableRequest
            }));
            expect(spy).toHaveBeenCalledWith(callableRequest);
        });

        it(`Should call the correct worker method with the arguments from the request`, async () => {
            const spy = spyOn<any>(privateWorker(controller), 'argsTestFn').and.callThrough();
            await controller.handleCallable(createRequest(WorkerEvents.Callable, 'argsTestFn', <WorkerCallableBody>{ arguments: ['Joe', 2] }));
            expect(spy).toHaveBeenCalledWith('Joe', 2);
        });

        it(`Should trigger postMessage with the return value of a sync function`, async () => {
            const spy = spyOn<any>(window, 'postMessage').and.callThrough();
            const req = createRequest(WorkerEvents.Callable, 'syncReturnTestFn', <WorkerCallableBody>{ arguments: [] });
            await controller.handleCallable(req);
            expect(spy).toHaveBeenCalledWith(createResponse(req, 'sync'));
        });

        it(`Should trigger postMessage with the return value of an async function`, async () => {
            const spy = spyOn<any>(controller, 'postMessage').and.callThrough();
            const req = createRequest(WorkerEvents.Callable, 'asyncReturnTestFn', <WorkerCallableBody>{ arguments: [] });
            await controller.handleCallable(req);
            expect(spy).toHaveBeenCalledWith(createResponse(req, 'async'));
        });

        it(`Should transfer the object prototypes for args decorated with a @ShallowTransfer()`, async () => {
            const spy = spyOn<any>(controller, 'postMessage').and.callThrough();
            const user = new TestUser({ name: 'joe', age: 20 });
            const req = createRequest(WorkerEvents.Callable, 'shallowTransferTestFn', <WorkerCallableBody>{ arguments: [20, user] });
            await controller.handleCallable(req);
            expect(spy).toHaveBeenCalledWith(createResponse(req, 41));
        });

        it(`Should catch errors and return as a WorkerReponseEvent through postMessage`, async () => {
            const spy = spyOn<any>(controller, 'postMessage').and.callThrough();
            const req = createRequest(WorkerEvents.Callable, 'errorTestFn', <WorkerCallableBody>{ arguments: [] });
            await controller.handleCallable(req);
            const callInfo = spy.calls.mostRecent();
            expect((<any>callInfo.args[0]).isError).toBe(true);
        });

    });

    describe('Accessables', () => {

        it(`Should call the handleAccessable method when a accessable client request is recieved through onmessage`, () => {
            const spy = spyOn(controller, 'handleAccessable');
            const accessableRequest = createRequest(WorkerEvents.Accessable);
            window.onmessage(new MessageEvent('mock-event', {
                data: accessableRequest
            }));
            expect(spy).toHaveBeenCalledWith(accessableRequest);
        });

        it('Should set the value of the variable in the worker', () => {
            controller.handleAccessable(createRequest(WorkerEvents.Accessable, 'setTestProp', <WorkerAccessableBody>{ isGet: false, value: 12 }));
            expect(privateWorker(controller).setTestProp).toEqual(12);
        });

        it('Should set the value and transfer prototype of a value when the shallowTransfer option is true', () => {
            controller.handleAccessable(createRequest(WorkerEvents.Accessable, 'transferableTestProp', <WorkerAccessableBody>{ isGet: false, value: new TestUser({ name: 'name', age: 20 }) }));
            expect(privateWorker(controller).transferableTestProp.birthday).toBeTruthy();
        });

        it('Should get the value of the variable in the worker and return it through postMessage', () => {
            const spy = spyOn<any>(controller, 'postMessage').and.callThrough();
            const req = createRequest(WorkerEvents.Accessable, 'getTestProp', <WorkerAccessableBody>{ isGet: true });
            controller.handleAccessable(req);
            expect(spy).toHaveBeenCalledWith(createResponse(req, 'testvalue'));
        });

    });

    describe('Observables', () => {

        it(`Should call the handleSubscription method when a observable client request is recieved through onmessage`, () => {
            const spy = spyOn(controller, 'handleSubscription');
            const subscribableReq = createRequest(WorkerEvents.Observable);
            window.onmessage(new MessageEvent('mock-event', {
                data: subscribableReq
            }));
            expect(spy).toHaveBeenCalledWith(subscribableReq);
        });

        it(`Should should add a subscription to the targeted event subject and add it to the dictionary`, () => {
            spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'subscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: false, subscriptionKey: 'key123' }));
            expect(privateWorker(controller).subscriptionTest.observers.length).toEqual(1);
            expect(privateSubscriptionsDict(controller)['key123']).toBeTruthy();
        });

        it(`Should should unsubscribe from the targeted event subject`, () => {
            privateSubscriptionsDict(controller)['key456'] = privateWorker(controller).subscriptionTest.subscribe();
            spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'subscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: true, subscriptionKey: 'key456' }));
            expect(privateWorker(controller).subscriptionTest.observers.length).toEqual(0);
            expect(privateSubscriptionsDict(controller)['key456']).toBeFalsy();
        });

        it('Should catch the error when subscribing from an undefined event subject and return the error in the form of a WorkerResponseEvent through postMessage', () => {
            const spy = spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'undefinedSubscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: false, subscriptionKey: 'key456' }));
            expect((<any>spy.calls.mostRecent().args[0]).isError).toEqual(true);
        });

        it('Should post an observable message when the subscribed subject\'s next method is triggered', async () => {

            const postMessageSpy = spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'subscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: false, subscriptionKey: 'key123' }));
            expect(postMessageSpy).toHaveBeenCalled();

            const postSubscriptionSpy = spyOn(controller, 'postSubscriptionMessage');
            privateWorker(controller).subscriptionTest.next('value');
            expect(postSubscriptionSpy).toHaveBeenCalledWith(<WorkerResponseEvent<WorkerObservableMessage>>{
                type: WorkerEvents.ObservableMessage,
                propertyName: 'subscriptionTest',
                isError: false,
                requestSecret: null,
                result: {
                    key: 'key123',
                    type: WorkerObservableMessageTypes.Next,
                    value: 'value'
                }
            });
        });

        it('Should post an observable message when the subscribed subject\'s complete method is triggered', async () => {

            const postMessageSpy = spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'subscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: false, subscriptionKey: 'key123' }));
            expect(postMessageSpy).toHaveBeenCalled();

            const postSubscriptionSpy = spyOn(controller, 'postSubscriptionMessage');
            privateWorker(controller).subscriptionTest.complete();
            expect(postSubscriptionSpy).toHaveBeenCalledWith(<WorkerResponseEvent<WorkerObservableMessage>>{
                type: WorkerEvents.ObservableMessage,
                propertyName: 'subscriptionTest',
                isError: false,
                requestSecret: null,
                result: {
                    key: 'key123',
                    type: WorkerObservableMessageTypes.Complete,
                }
            });
        });

        it('Should post an observable message when the subscribed subject\'s error is fired', async () => {

            const postMessageSpy = spyOn(controller, 'postMessage');
            controller.handleSubscription(createRequest(WorkerEvents.Observable, 'subscriptionTest', <WorkerSubscribableBody>{ isUnsubscribe: false, subscriptionKey: 'key123' }));
            expect(postMessageSpy).toHaveBeenCalled();

            const postSubscriptionSpy = spyOn(controller, 'postSubscriptionMessage');
            privateWorker(controller).subscriptionTest.error(null);
            expect(postSubscriptionSpy.calls.mostRecent().args[0].isError).toBe(true);
            expect(postSubscriptionSpy.calls.mostRecent().args[0].result.type).toBe(WorkerObservableMessageTypes.Error);
        });

        it('Should unsubscribe from all subscriptions', () => {
            const subject1 = new Subject<any>();
            const subject2 = new Subject<any>();
            controller['subscriptions']['1'] = subject1.subscribe();
            controller['subscriptions']['2'] = subject1.subscribe();
            controller['subscriptions']['3'] = subject2.subscribe();
            controller.removeAllSubscriptions();
            expect(subject1.observers.length).toEqual(0);
            expect(subject2.observers.length).toEqual(0);
            expect(controller['subscriptions']['1']).toBeFalsy();
            expect(controller['subscriptions']['2']).toBeFalsy();
            expect(controller['subscriptions']['3']).toBeFalsy();
        });

    });

});
