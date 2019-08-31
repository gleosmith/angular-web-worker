import { AngularWebWorker, Accessable, OnWorkerInit, Callable, Subscribable } from '../../worker/src/public-api';
import { WorkerClient, WorkerClientObservablesDict, WorkerClientRequestOpts, ClientWebWorker } from '../src/public-api';
import { WorkerAnnotations, WorkerEvents, SecretResult, WorkerRequestEvent, WorkerResponseEvent, WorkerEvent, WorkerObservableMessageTypes } from '../../common/src/public-api';
import { Subject, Observable } from 'rxjs';

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

interface PrivateWorkerClient {

    observables: <T>(client: WorkerClient<T>) => WorkerClientObservablesDict;

    isSecret: <SecretType extends number, T>(
        client: WorkerClient<T>,
        secretResult: any,
        type: SecretType
    ) => SecretResult<SecretType>;

    responseEvent: <T>(client: WorkerClient<T>) => Subject<WorkerResponseEvent<any>>;

    worker: <T>(client: WorkerClient<T>) => Worker | ClientWebWorker<T>;

    workerClass: <T>(client: WorkerClient<T>) => T;

    executableWorker: <T>(client: WorkerClient<T>) => T;

    clientSecret: <T>(client: WorkerClient<T>) => string;

    secrets: <T>(client: WorkerClient<T>) => string[];

    setClientSecret: <T>(client: WorkerClient<T>, secret: string) => void;

    sendRequest: <EventType extends number>(
        client: WorkerClient<TestClass>,
        type: EventType,
        opts: WorkerClientRequestOpts<TestClass, EventType, any>
    ) => Promise<any>;

    fakeConnection: <T>(client: WorkerClient<T>) => Promise<any>;
}

const PrivateClientUtils: PrivateWorkerClient = {

    observables: (client) => {
        return client['observables'];
    },

    isSecret: (client, result, type) => (<Function>client['isSecret']).apply(client, [result, type]),

    worker: (client) => client['workerRef'],

    workerClass: (client) => client['worker'],

    executableWorker: (client) => client['executableWorker'],

    secrets: (client) => client['secrets'],

    responseEvent: <T>(client: WorkerClient<T>) => client['responseEvent'],

    clientSecret: (client) => client['workerSecret'],

    setClientSecret: (client, secret) => { client['workerSecret'] = secret; },

    sendRequest: (client, type, opts) => (<Function>client['sendRequest']).apply(client, [type, opts]),

    fakeConnection: async <T>(client: WorkerClient<T>) => {
        client.connect();
        await sleep(10);
        client['_isConnected'] = true;
    }
};


@AngularWebWorker()
class TestClass implements OnWorkerInit {

    undecoratedProperty: string;
    @Accessable() property1: string;
    @Accessable() property2: TestUser;
    @Accessable({ shallowTransfer: true }) property3: TestUser;
    @Subscribable() event: Subject<string> = new Subject<string>();

    constructor() { }

    async onWorkerInit() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(100);
            }, 100);
        });
    }

    @Callable()
    function1(name: string, age: number): TestUser {
        return new TestUser({ name: name, age: age });
    }

    @Callable({ shallowTransfer: true })
    function2(name: string, age: number): TestUser {
        return new TestUser({ name: name, age: age });
    }
}





class FakeWorker implements Worker {

    onmessage(ev: MessageEvent) { }
    onerror(err: any) { }
    postMessage(resp: any) { }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent(evt: Event): boolean {
        return true;
    }
    terminate() { }
}


describe('WorkerClient: [angular-web-worker/angular]', () => {

    function merge<T>(defaultOptions: T, newOptions: Partial<T>): T {
        const opts: any = {};
        for (const key in defaultOptions) {
            if (key) {
                opts[key] = defaultOptions[key];
            }
        }
        for (const key in newOptions) {
            if (key) {
                opts[key] = newOptions[key];
            }
        }
        return opts;
    }

    function serialise(obj: any): any {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            throw new Error('Unable to serialize object');
        }
    }

    function response<T>(mergeVal?: Partial<WorkerResponseEvent<T>>): WorkerResponseEvent<T> {
        return merge({
            propertyName: 'property1',
            requestSecret: 'requestsecret',
            type: WorkerEvents.Accessable,
            isError: false,
            result: null
        }, mergeVal ? mergeVal : {});
    }

    let client: WorkerClient<TestClass>;
    beforeEach(() => {
        client = new WorkerClient({ worker: TestClass, initFn: () => new FakeWorker() }, true, true);
    });

    describe('connect()', () => {

        it('Should create a secret client key and add it to the secrets array', async () => {

            // run in worker
            client.connect();
            await sleep(10);
            expect(PrivateClientUtils.clientSecret(client)).toBeTruthy();
            expect(PrivateClientUtils.secrets(client)[0]).toEqual(PrivateClientUtils.clientSecret(client));

        });

        it(`Should call the worker factory annotation to create a new worker instance with a client config`, async () => {
            const originalFactory = TestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory];
            // run in worker
            const spy = spyOn<any>(TestClass[WorkerAnnotations.Annotation], WorkerAnnotations.Factory).and.callThrough();
            client.connect();
            await sleep(10);
            expect(spy).toHaveBeenCalledWith({ isClient: true, clientSecret: PrivateClientUtils.clientSecret(client) });
            expect(PrivateClientUtils.workerClass(client)).toBeTruthy();
        });

        describe('-> Run in worker', () => {
            it(`Should create a new instance of the native Worker class`, async () => {
                const clientRunInWorker = new WorkerClient({ worker: TestClass, initFn: () => new FakeWorker() });
                clientRunInWorker.connect();
                await sleep(10);
                expect(PrivateClientUtils.worker(clientRunInWorker) instanceof FakeWorker).toEqual(true);
            });
        });

        describe('-> Run in app', () => {
            it(`Should create a new instance of the ClientWebWorker class`, async () => {
                client.connect();
                await sleep(10);
                expect(PrivateClientUtils.worker(client) instanceof ClientWebWorker).toEqual(true);
            });
        });

        it(`Should send an init request to the worker which sets the connected flag to true if resolved`, async () => {
            const spy = spyOn<any>(client, 'sendRequest');
            client.connect();
            await sleep(10);

            const spyArgs: [number, WorkerClientRequestOpts<TestClass, WorkerEvents.Init, any>] = <any>spy.calls.mostRecent().args;
            expect(spyArgs[0]).toEqual(WorkerEvents.Init);
            expect(spyArgs[1].isConnect).toEqual(true);
            spyArgs[1].resolve();
            expect(client.isConnected).toEqual(true);
        });

    });

    describe('Event Listeners', () => {

        let worker: ClientWebWorker<TestClass>;
        beforeEach(async () => {
            await client.connect();
            worker = PrivateClientUtils.worker(client) as ClientWebWorker<TestClass>;
            PrivateClientUtils.observables(client)['key'] = { subject: new Subject<any>(), subscription: null, observable: null, propertyName: 'event' };
        });

        function event<T>(evt: T): WorkerEvent<WorkerResponseEvent<any>> {
            return new MessageEvent('TestEvent', {
                data: evt
            });
        }

        it('Should trigger the response event when the message is not of the ObservableMessage type', () => {
            const evt = {
                type: WorkerEvents.Accessable,
                result: 'somevalue'
            };
            const spy = spyOn(client['responseEvent'], 'next');
            worker.onmessage(event(evt));
            expect(spy).toHaveBeenCalledWith(evt);
        });

        it('Should trigger the observable subject when a next event is recieved through an ObservableMessage event', () => {
            const evt = {
                type: WorkerEvents.ObservableMessage,
                result: {
                    key: 'key',
                    type: WorkerObservableMessageTypes.Next,
                    value: 'some-value'
                }
            };
            const spy = spyOn(PrivateClientUtils.observables(client)['key'].subject, 'next');
            worker.onmessage(event(evt));
            expect(spy).toHaveBeenCalledWith('some-value');
        });

        it('Should trigger the observable subject when a complete event is recieved through an ObservableMessage event', () => {
            const evt = {
                type: WorkerEvents.ObservableMessage,
                result: {
                    key: 'key',
                    type: WorkerObservableMessageTypes.Complete,
                }
            };
            const spy = spyOn(PrivateClientUtils.observables(client)['key'].subject, 'complete');
            worker.onmessage(event(evt));
            expect(spy).toHaveBeenCalled();
        });

        it('Should trigger the observable subject when an error event is recieved through an ObservableMessage event', () => {
            const evt = {
                type: WorkerEvents.ObservableMessage,
                result: {
                    key: 'key',
                    type: WorkerObservableMessageTypes.Error,
                    error: 'error-msg'
                }
            };
            const spy = spyOn(PrivateClientUtils.observables(client)['key'].subject, 'error');
            worker.onmessage(event(evt));
            expect(spy).toHaveBeenCalledWith('error-msg');
        });
    });

    describe('isSecret()', () => {

        it('Should return null if the secret result is invalid', () => {
            expect(PrivateClientUtils.isSecret(client, 'asd', WorkerEvents.Accessable)).toEqual(null);
        });

        it('Should return null if the clientSecret does not match', () => {
            PrivateClientUtils.setClientSecret(client, 'secret');
            expect(PrivateClientUtils.isSecret(client, <SecretResult<WorkerEvents.Accessable>>{
                clientSecret: 'not-secret',
                type: WorkerEvents.Accessable,
                propertyName: 'property'
            }, WorkerEvents.Accessable)).toEqual(null);
        });

        it('Should return null if the secret type does not match', () => {
            expect(PrivateClientUtils.isSecret(client, <SecretResult<WorkerEvents.Callable>>{
                clientSecret: 'somesecret',
                type: WorkerEvents.Callable,
                propertyName: 'property'
            }, WorkerEvents.Accessable)).toEqual(null);
        });

        it('Should return the secret when valid', () => {
            PrivateClientUtils.setClientSecret(client, 'secret');
            const secret: SecretResult<WorkerEvents.Accessable> = {
                clientSecret: 'secret',
                type: WorkerEvents.Accessable,
                propertyName: 'property',
                body: null
            };
            expect(PrivateClientUtils.isSecret(client, secret, WorkerEvents.Accessable)).toEqual(secret);
        });

    });

    describe('sendRequest()', () => {

        function secretResult(workerClient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Accessable>>): SecretResult<WorkerEvents.Accessable> {
            return merge({
                type: WorkerEvents.Accessable,
                propertyName: 'property1',
                clientSecret: PrivateClientUtils.clientSecret(workerClient),
                body: {
                    get: true,
                    set: true,
                }
            }, mergeVal ? mergeVal : {});
        }

        function requestOpts(mergeVal?: Partial<WorkerClientRequestOpts<TestClass, any, any>>): WorkerClientRequestOpts<TestClass, any, any> {
            return merge(<any>{
                secretError: '',
                isConnect: false,
                workerProperty: (w: TestClass) => w.property1,
                body: () => { return { isGet: true }; }
            }, mergeVal ? mergeVal : {});
        }

        function request(mergeVal?: Partial<WorkerRequestEvent<WorkerEvents.Accessable>>): WorkerRequestEvent<WorkerEvents.Accessable> {
            return merge({
                propertyName: 'property1',
                requestSecret: 'requestsecret',
                type: WorkerEvents.Accessable,
                body: {isGet: true }
            }, mergeVal ? mergeVal : {});
        }

        let clientRunInWorker: WorkerClient<TestClass>;
        beforeEach(async () => {
            await client.connect();
            clientRunInWorker = new WorkerClient({ worker: TestClass, initFn: () => new FakeWorker() });
            await PrivateClientUtils.fakeConnection(clientRunInWorker);
        });

        it('Should throw an error if the client is not connected and the isConnect option is false', async () => {
            try {
                client['_isConnected'] = false;
                await PrivateClientUtils.sendRequest(client, WorkerEvents.Init, requestOpts({ isConnect: false }));
            } catch (e) {
                expect(e).toEqual(new Error('WorkerClient: the WorkerClient.connect() method must be called before a worker can be accessed'));
            }
        });

        it('Should not check the secret if no property name has been provided', async () => {
            const spy = spyOn<any>(client, 'isSecret').and.callThrough();
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts({ workerProperty: undefined }));
            await sleep(10);
            expect(spy).not.toHaveBeenCalled();
        });

        it('Should check the secret for a property/method if the property is provided as a string', async () => {
            const spy = spyOn<any>(client, 'isSecret').and.callThrough();
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts({ workerProperty: 'property1' }));
            await sleep(10);
            expect(spy).toHaveBeenCalledWith(secretResult(client), WorkerEvents.Accessable);
        });

        it('Should check the secret for a property/method if the property is provided as a lambda expression', async () => {
            const spy = spyOn<any>(client, 'isSecret').and.callThrough();
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts());
            await sleep(10);
            expect(spy).toHaveBeenCalledWith(secretResult(client), WorkerEvents.Accessable);
        });

        it('Should be rejected with the secret error if an undecorated property/method is provided', async () => {
            try {
                await PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts({ secretError: 'secret error', workerProperty: w => w.undecoratedProperty }));
            } catch (e) {
                expect(e).toEqual(new Error('secret error'));
            }
        });

        it('Should run additional conditions, passing in the secret result', async () => {
            const additionalCondition = { if: (result: SecretResult<any>) => true, reject: (result: SecretResult<any>) => 'rejected condition 1' };
            const spy = spyOn(additionalCondition, 'if').and.callThrough();
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts({ additionalConditions: [additionalCondition] }));
            await sleep(10);
            expect(spy).toHaveBeenCalledWith(secretResult(client));
        });

        it('Should be rejected if an additional condition fails', async () => {
            const additionalCondition = { if: (result: SecretResult<any>) => false, reject: (result: SecretResult<any>) => 'rejected condition 2' };
            const spy = spyOn(additionalCondition, 'reject').and.callThrough();
            try {
                await PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts({ additionalConditions: [additionalCondition] }));
            } catch (e) {
                expect(spy).toHaveBeenCalledWith(secretResult(client));
                expect(e).toEqual('rejected condition 2');
            }
        });

        it('Should call the beforeRequest option, if provided, with the secret', async () => {
            const requestOptions = requestOpts({
                beforeRequest: (secret) => {
                    return 10;
                },
            });
            const spy = spyOn(requestOptions, 'beforeRequest');
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOptions);
            expect(spy).toHaveBeenCalledWith(secretResult(client));
        });

        it(`Should subscribe to the response event to recieve messages sent back from the worker`, async () => {
            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(1);
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts());
            await sleep(10);
            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(2);
        });

        it('Should add a request secret to the secrets array', async () => {
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(2);
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts());
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(3);
        });

        it('Should post a message to the worker', async () => {
            spyOn<any>(client, 'generateSecretKey').and.returnValue('requestsecret');
            const spy = spyOn<any>(client, 'postMessage');
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts());
            expect(spy).toHaveBeenCalledWith(request());
        });

        it('Should post a message to the worker with the value returned by the body function', async () => {

            spyOn<any>(client, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                body: (secret) => {
                    return { isGet: false };
                }
            });

            await client.connect();
            const bodySpy = spyOn(opts, 'body').and.callThrough();
            const postMessageSpy = spyOn<any>(client, 'postMessage');

            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, opts);
            expect(bodySpy).toHaveBeenCalledWith(secretResult(client), undefined);
            expect((<WorkerRequestEvent<WorkerEvents.Accessable>>postMessageSpy.calls.mostRecent().args[0]).body).toEqual({ isGet: false });

        });

        it('Should pass the value returned by the beforeRequest option, if provided, to the body function', async () => {

            spyOn<any>(client, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                body: (secret) => {
                    return { isGet: false };
                },
                beforeRequest: () => 100
            });
            const bodySpy = spyOn(opts, 'body').and.callThrough();

            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, opts);
            expect(bodySpy).toHaveBeenCalledWith(secretResult(client), 100);

        });

        it('Should map the correct worker response to resolve the promise', async () => {
            spyOn<any>(client, 'generateSecretKey').and.returnValue('requestsecret');
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts()).then(() => {
                expect(true).toEqual(true);
            });
            PrivateClientUtils.worker(client).onmessage(new MessageEvent('response', { data: response() }));
        }, 1000);


        it('Should unsubscribe from the worker response event after resolved', async () => {
            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(1);
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts()).then(() => {
                expect(true).toEqual(true);
            });
            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response() }));
            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(1);
        }, 1000);

        it('Should remove the request secret from the secrets array when resolved', async () => {
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(2);
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts());
            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response({ requestSecret: PrivateClientUtils.secrets(clientRunInWorker)[2] }) }));
            await sleep(10);
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(2);
        });

        it('Should call the resolve option and return its value when the promise is resolved', async () => {

            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                resolve: (resp, secret) => 200
            });
            const spy = spyOn(opts, 'resolve').and.callThrough();
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, opts).then((val) => {
                expect(val).toEqual(200);
            });

            await sleep(10);
            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response() }));
            expect(spy).toHaveBeenCalledWith(response(), secretResult(clientRunInWorker), undefined);

        }, 1000);

        it('Should pass the value returned by the beforeRequest option, if provided, to the resolve function', async () => {

            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                resolve: (resp, secret) => 200,
                beforeRequest: (secret) => 500
            });
            const spy = spyOn(opts, 'resolve').and.callThrough();
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, opts);
            await sleep(10);

            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response() }));
            expect(spy).toHaveBeenCalledWith(response(), secretResult(clientRunInWorker), 500);

        }, 1000);

        it('Should be rejected if the worker returns an error response', async () => {

            spyOn<any>(client, 'generateSecretKey').and.returnValue('requestsecret');
            PrivateClientUtils.sendRequest(client, WorkerEvents.Accessable, requestOpts()).catch(() => {
                expect(true).toEqual(true);
            });
            await sleep(10);

            PrivateClientUtils.worker(client).onmessage(new MessageEvent('response', { data: response({ isError: true }) }));

        }, 1000);

        it('Should remove the request secret from the secrets array when rejected', async () => {
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(2);
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts()).catch((err) => { });
            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response({ requestSecret: PrivateClientUtils.secrets(clientRunInWorker)[2], isError: true }) }));
            await sleep(10);
            expect(PrivateClientUtils.secrets(clientRunInWorker).length).toEqual(2);
        });

        it('Should unsubscribe from the worker response event if the worker responds with an error response', async () => {

            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(1);
            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, requestOpts()).catch((err) => {
            });
            await sleep(10);

            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response({ isError: true }) }));
            expect(PrivateClientUtils.responseEvent(clientRunInWorker).observers.length).toEqual(1);

        }, 1000);

        it('Should call the beforeReject option if the worker returns an error response', async () => {

            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                beforeReject: (resp, secret, context) => {
                    return { isGet: false };
                },
                beforeRequest: () => 100
            });
            const spy = spyOn(opts, 'beforeReject');

            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, opts).catch(() => { });
            await sleep(10);

            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response({ isError: true }) }));
            expect(spy).toHaveBeenCalledWith(response({ isError: true }), secretResult(clientRunInWorker), 100);

        }, 1000);

        it('Should not map an incorrect worker response', async () => {

            spyOn<any>(clientRunInWorker, 'generateSecretKey').and.returnValue('requestsecret');
            const opts = requestOpts({
                resolve: (secret) => {
                    return { isGet: false };
                },
            });
            const spy = spyOn(opts, 'resolve');

            PrivateClientUtils.sendRequest(clientRunInWorker, WorkerEvents.Accessable, opts);
            await sleep(10);

            PrivateClientUtils.worker(clientRunInWorker).onmessage(new MessageEvent('response', { data: response({ type: WorkerEvents.Callable }) }));
            expect(spy).not.toHaveBeenCalled();

        }, 1000);

    });

    describe('get()', () => {

        function secretResult(workerCLient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Accessable>>): SecretResult<WorkerEvents.Accessable> {
            return merge({
                type: WorkerEvents.Accessable,
                propertyName: 'property1',
                clientSecret: PrivateClientUtils.clientSecret(workerCLient),
                body: {
                    get: true,
                    set: true,
                }
            }, mergeVal ? mergeVal : {});
        }

        let opts: WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
        let spy: jasmine.Spy;
        beforeEach(async () => {
            await client.connect();
            spy = spyOn<any>(client, 'sendRequest');
            client.get(w => w.property1);
            opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
        });

        it('Should pass the worker property lambda to the request', async () => {
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).property1);
        });

        it('Should check that the metadata allows for the get operation to be applied', async () => {
            expect(opts.additionalConditions[0].if(secretResult(client, { body: { get: false, set: true } }))).toEqual(false);
            expect(opts.additionalConditions[0].if(secretResult(client, { body: { get: true, set: true } }))).toEqual(true);
        });

        it('Should send the correct request body to the worker', async () => {
            expect(opts.body(secretResult(client, { body: { get: false, set: true } }))).toEqual({ isGet: true });
        });

        it('Should resolve with the response result', async () => {
            expect(opts.resolve(response({ result: 'propertyvalue' }), secretResult(client, { body: { get: false, set: true } }))).toEqual('propertyvalue');
        });

        it('Should not transfer the prototype of the resolved result if the shallowTransfer option is false or unset', async () => {
            client.get(w => w.property2);
            const argOpts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
            const user = new TestUser({ name: 'joe soap', age: 20 });
            expect(argOpts.resolve(response({ result: serialise(user), propertyName: 'property2' }), secretResult(client, { body: { get: false, set: true } })).birthday).toBeFalsy();
        });

        it('Should transfer the prototype of the resolved result if the shallowTransfer option is true', async () => {
            client.get(w => w.property3);
            const argOpts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
            const user = new TestUser({ name: 'joe soap', age: 20 });
            expect(argOpts.resolve(response({ result: serialise(user), propertyName: 'property3' }), secretResult(client, { body: { get: false, set: true } })).birthday).toBeTruthy();
        });

    });

    describe('set()', () => {

        function secretResult(workerClient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Accessable>>): SecretResult<WorkerEvents.Accessable> {
            return merge({
                type: WorkerEvents.Accessable,
                propertyName: 'property1',
                clientSecret: PrivateClientUtils.clientSecret(workerClient),
                body: {
                    get: true,
                    set: true,
                }
            }, mergeVal ? mergeVal : {});
        }

        let opts: WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
        beforeEach(async () => {
            await client.connect();
            const spy = spyOn<any>(client, 'sendRequest');
            client.set(w => w.property1, 'value');
            opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Accessable, any>;
        });

        it('Should pass the worker property lambda to the request', async () => {
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).property1);
        });

        it('Should check that the metadata allows for the set operation to be applied', async () => {
            expect(opts.additionalConditions[0].if(secretResult(client, { body: { get: false, set: false } }))).toEqual(false);
            expect(opts.additionalConditions[0].if(secretResult(client, { body: { get: false, set: true } }))).toEqual(true);
        });

        it('Should send the correct request body to the worker', async () => {
            expect(opts.body(secretResult(client, { body: { get: false, set: true } }))).toEqual({ isGet: false, value: 'value' });
        });


    });

    describe('call()', () => {

        function secretResult(workerClient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Callable>>): SecretResult<WorkerEvents.Callable> {
            return merge({
                type: WorkerEvents.Callable,
                propertyName: 'function1',
                clientSecret: PrivateClientUtils.clientSecret(workerClient),
                body: {
                    args: ['joe soap', 20]
                }
            }, mergeVal ? mergeVal : {});
        }

        let opts: WorkerClientRequestOpts<TestClass, WorkerEvents.Callable, any>;
        let spy: jasmine.Spy;
        beforeEach(async () => {
            await client.connect();
            spy = spyOn<any>(client, 'sendRequest');
            client.call(w => w.function1('joe soap', 20));
            opts = spy.calls.mostRecent().args[1];
        });

        it('Should call the worker method in the lambda expression', async () => {
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).function1('joe soap', 20));
        });

        it('Should pass the function arguments as the body', async () => {
            expect(opts.body(secretResult(client, { body: { args: ['name', 20] } }))).toEqual({ arguments: ['name', 20] });
        });

        it('Should resolve with the response result', async () => {
            expect(opts.resolve(response({ result: 'result', propertyName: 'function1' }), secretResult(client))).toEqual('result');
        });

        it('Should not transfer the prototype of the resolved result if the shallowTransfer option is false or unset', async () => {
            const user = new TestUser({ name: 'joe soap', age: 20 });
            expect(opts.resolve(response({ result: serialise(user), propertyName: 'function1' }), secretResult(client)).birthday).toBeFalsy();
        });

        it('Should transfer the prototype of the resolved result if the shallowTransfer option is true', async () => {
            client.call(w => w.function2('name', 20));
            opts = spy.calls.mostRecent().args[1];
            const user = new TestUser({ name: 'joe soap', age: 20 });
            expect(opts.resolve(response({ result: serialise(user), propertyName: 'function2' }), secretResult(client)).birthday).toBeTruthy();
        });

    });

    describe('subscribe()', () => {

        function secretResult(workerClient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Observable>>): SecretResult<WorkerEvents.Observable> {
            return merge({
                type: WorkerEvents.Observable,
                propertyName: 'event',
                clientSecret: PrivateClientUtils.clientSecret(workerClient),
                body: null
            }, mergeVal ? mergeVal : {});
        }

        let opts: WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
        beforeEach(async () => {
            await client.connect();
            const spy = spyOn<any>(client, 'sendRequest').and.callThrough();
            client.subscribe(w => w.event, (str) => { });
            opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
        });

        it('Should pass the worker subject in the lambda expression', () => {
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).event);
        });

        it('Should pass the correct data in the request body', () => {
            expect(opts.body(secretResult(client), 'secret-key')).toEqual({ subscriptionKey: 'secret-key', isUnsubscribe: false });
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).event);
        });

        it('Should create a subscription before the request is sent', () => {
            const spy = spyOn<any>(client, 'createSubscription').and.callThrough();
            const key = opts.beforeRequest(secretResult(client));
            expect(spy).toHaveBeenCalled();
            expect(spy.calls.mostRecent().returnValue).toEqual(key);
        });

        it('Should remove the subscription if rejected', () => {
            const spy = spyOn<any>(client, 'removeSubscription');
            const key = opts.beforeReject(response({ propertyName: 'event' }), secretResult(client), 'subscription-key');
            expect(spy).toHaveBeenCalledWith('subscription-key');
        });

        it('Should resolve with the newly created subscription', () => {
            const subject = new Subject<any>();
            PrivateClientUtils.observables(client)['subscription-key'] = { propertyName: 'event', subject: subject, subscription: subject.subscribe(), observable: null };
            expect(opts.resolve(response({ propertyName: 'event' }), secretResult(client), 'subscription-key')).toEqual(subject.subscribe());
        });

        describe('createSubscription()', () => {

            const subscriptionMethods = {
                next: (val: string) => { },
                error: (err: any) => { },
                complete: () => { }
            };

            beforeEach(async () => {
                await client.connect();
            });

            it('Should create a new key and add a new subject and a subscription to the observables dictionary with this key', () => {
                const key = client['createSubscription']('event');
                expect(PrivateClientUtils.observables(client)[key].subject).toBeTruthy();
                expect(PrivateClientUtils.observables(client)[key].subscription).toBeTruthy();
                expect(PrivateClientUtils.observables(client)[key].subject.observers.length).toEqual(1);
            });

            it('The subscription should subscribe the subject and act on the next event', () => {
                const spy = spyOn(subscriptionMethods, 'next');
                const key = client['createSubscription']('event', subscriptionMethods.next);
                PrivateClientUtils.observables(client)[key].subject.next();
                expect(spy).toHaveBeenCalled();
            });

            it('The subscription should subscribe the subject and act on the error event', () => {
                const spy = spyOn(subscriptionMethods, 'error');
                const key = client['createSubscription']('event', subscriptionMethods.next, subscriptionMethods.error, subscriptionMethods.complete);
                PrivateClientUtils.observables(client)[key].subject.error(null);
                expect(spy).toHaveBeenCalledWith(null);
            });

            it('The subscription should subscribe the subject and act on the complete event', () => {
                const spy = spyOn(subscriptionMethods, 'complete');
                const key = client['createSubscription']('event', subscriptionMethods.next, subscriptionMethods.error, subscriptionMethods.complete);
                PrivateClientUtils.observables(client)[key].subject.complete();
                expect(spy).toHaveBeenCalledWith();
            });
        });

    });

    describe('observe()', () => {

        function secretResult(workerClient: WorkerClient<TestClass>, mergeVal?: Partial<SecretResult<WorkerEvents.Observable>>): SecretResult<WorkerEvents.Observable> {
            return merge({
                type: WorkerEvents.Observable,
                propertyName: 'event',
                clientSecret: PrivateClientUtils.clientSecret(workerClient),
                body: null
            }, mergeVal ? mergeVal : {});
        }

        let opts: WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
        beforeEach(async () => {
            await client.connect();
            const spy = spyOn<any>(client, 'sendRequest').and.callThrough();
            client.observe(w => w.event);
            opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
        });

        it('Should pass the worker subject in the lambda expression', () => {
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).event);
        });

        it('Should pass the correct data in the request body', () => {
            expect(opts.body(secretResult(client), 'secret-key')).toEqual({ subscriptionKey: 'secret-key', isUnsubscribe: false });
            expect((<Function>opts.workerProperty)(PrivateClientUtils.workerClass(client))).toEqual(PrivateClientUtils.workerClass(client).event);
        });

        it('Should create an observable before the request is sent', () => {
            const spy = spyOn<any>(client, 'createObservable').and.callThrough();
            const key = opts.beforeRequest(secretResult(client));
            expect(spy).toHaveBeenCalled();
            expect(spy.calls.mostRecent().returnValue).toEqual(key);
        });

        it('Should remove the subscription if rejected', () => {
            const spy = spyOn<any>(client, 'removeSubscription');
            const key = opts.beforeReject(response({ propertyName: 'event' }), secretResult(client), 'subscription-key');
            expect(spy).toHaveBeenCalledWith('subscription-key');
        });

        it('Should resolve with the newly created observable', () => {
            const subject = new Subject<any>();
            PrivateClientUtils.observables(client)['subscription-key'] = { propertyName: 'event', subject: subject, subscription: null, observable: subject.asObservable() };
            expect(opts.resolve(response({ propertyName: 'event' }), secretResult(client), 'subscription-key')).toEqual(subject.asObservable());
        });

        describe('createObservable()', () => {

            it('Should create a new key and add a new subject and an observable to the observables dictionary with this key', async () => {
                await client.connect();
                const key = client['createObservable']('event');
                expect(PrivateClientUtils.observables(client)[key].subject).toBeTruthy();
                expect(PrivateClientUtils.observables(client)[key].observable).toBeTruthy();
            });

        });

    });

    describe('unsubscribe()', () => {

        function addObservable(workerClient: WorkerClient<TestClass>, key: string, propertyName: string, subscription: boolean) {
            const subject = new Subject<any>();
            PrivateClientUtils.observables(workerClient)[key] = {
                propertyName: propertyName,
                subject: subject,
                subscription: subscription ? subject.subscribe() : null,
                observable: !subscription ? subject.asObservable() : null
            };
        }

        beforeEach(async () => {
            await client.connect();
            addObservable(client, 'subscription', 'event1', true);
            addObservable(client, 'observable', 'event2', false);
            addObservable(client, 'subscription2', 'event3', true);
        });

        it('Should find the property name associated with a subscription and send this in the request', () => {
            const spy = spyOn<any>(client, 'sendRequest');
            client.unsubscribe(PrivateClientUtils.observables(client)['subscription2'].subscription);
            const opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
            expect(opts.workerProperty).toEqual('event3');
        });

        it('Should find the property name associated with an observable and send this in the request', () => {
            const spy = spyOn<any>(client, 'sendRequest');
            client.unsubscribe(PrivateClientUtils.observables(client)['observable'].observable);
            const opts = spy.calls.mostRecent().args[1] as WorkerClientRequestOpts<TestClass, WorkerEvents.Observable, any>;
            expect(opts.workerProperty).toEqual('event2');
        });

        it('Should do nothing if the subscription/observable does not exist in the dictionary', () => {
            const spy = spyOn<any>(client, 'removeSubscription');
            spyOn<any>(client, 'sendRequest');
            const observable = new Observable<any>();
            client.unsubscribe(observable);
            expect(spy).not.toHaveBeenCalled();
        });

        it('Should remove the subscription', () => {
            spyOn<any>(client, 'sendRequest');
            const spy = spyOn<any>(client, 'removeSubscription').and.callThrough();
            client.unsubscribe(PrivateClientUtils.observables(client)['subscription'].subscription);
            expect(spy).toHaveBeenCalledWith('subscription');
            expect(PrivateClientUtils.observables(client)['subscription']).toBeFalsy();
        });


    });


});

async function sleep(time) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}


