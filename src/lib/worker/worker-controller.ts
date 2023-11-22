import { Subject, Subscription } from 'rxjs';
import {WebWorkerType} from './common/worker-types';
import {WorkerUtils} from './common/worker-utils';
import {AccessableMetaData, ShallowTransferParamMetaData, WorkerAnnotations} from './common/annotations';
import {WorkerMessageBus} from './common/message-bus';
import {WorkerEvent, WorkerEvents, WorkerObservableMessage, WorkerObservableMessageTypes, WorkerRequestEvent, WorkerResponseEvent} from './common/worker-events';
/**
 * Handles communication to and from a `WorkerClient` and triggers work with the worker class.
 */
export class WorkerController<T> {

    /**
     * Instance of the worker class
     */
    private worker: any;
    /**
     * Dictionary of subscriptions to RxJS subjects within the worker
     */
    private subscriptions: { [id: string]: Subscription };

    /**
     * Creates a new `WorkerController`
     * @param workerClass the worker class,
     * @param messageBus
     */
    constructor(private workerClass: WebWorkerType<any>, private messageBus: WorkerMessageBus) {
        try {
            this.worker = WorkerUtils.getAnnotation<Function>(workerClass, WorkerAnnotations.Factory)({
                isClient: false
            });
            this.subscriptions = {};
            this.registerEvents();
        } catch (e) { }
    }

    /**
     * Returns instance of worker class
     */
    get workerInstance(): T {
        return this.worker;
    }

    /**
     * Creates the event listeners to correctly handle and respond to messages recieved from a `WorkerClient`
     */
    private registerEvents() {
        this.messageBus.onmessage = (ev: WorkerEvent<WorkerRequestEvent<any>>) => {
            switch (ev.data.type) {
                case WorkerEvents.Callable:
                    this.handleCallable(ev.data);
                    break;
                case WorkerEvents.Accessable:
                    this.handleAccessable(ev.data);
                    break;
                case WorkerEvents.Observable:
                    this.handleSubscription(ev.data);
                    break;
                case WorkerEvents.Init:
                    this.handleInit(ev.data);
                    break;
            }
        };
    }

    /**
     * A utility function to create a new `WorkerResponseEvent` from the details provided by the `WorkerRequestEvent`, as well as the result to be returned
     * @param type The type of worker event
     * @param request The request that the response relates to
     * @param result data to return with the response
     */
    private response<EventType extends number>(
        type: EventType,
        request: WorkerRequestEvent<EventType>,
        result: any
    ): WorkerResponseEvent<EventType> {
        return {
            type: type,
            isError: false,
            requestSecret: request.requestSecret,
            propertyName: request.propertyName,
            result: result
        };
    }

    /**
     * A utility function to create a new error in the form of a `WorkerResponseEvent` from the details provided by the `WorkerRequestEvent`, as well as the error to be returned
     * @param type The type of worker event
     * @param request The request that the error relates to
     * @param result the error to be returned
     */
    private error<EventType extends number>(
        type: number,
        request: WorkerRequestEvent<EventType>,
        error: any
    ): WorkerResponseEvent<EventType> {
        return {
            type: type,
            isError: true,
            requestSecret: request.requestSecret,
            propertyName: request.propertyName,
            error: JSON.stringify(error, this.replaceErrors),
            result: null
        };
    }

    /**
     * A utility function as the replacer for the `JSON.stringify()` function to make the native browser `Error` class serializable to JSON
     */
    private replaceErrors(key: string, value: any) {
        if (value instanceof Error) {
            const error = {};
            // tslint:disable-next-line: no-shadowed-variable
            Object.getOwnPropertyNames(value).forEach(function (key) {
                error[key] = value[key];
            });
            return error;
        }
        return value;
    }

    /**
     * Handles `WorkerEvents.Init` requests from a client by calling the `onWorkerInit` hook if implemented and only responding once the hook has been completed, regardless of whether it is
     * async or not
     * @param request request recieved from the `WorkerClient`
     */
    async handleInit(request: WorkerRequestEvent<WorkerEvents.Init>) {
        if (this.worker['onWorkerInit']) {
            try {
                const result = this.worker['onWorkerInit']();
                let isPromise = false;
                if (result) {
                    isPromise = result.__proto__.constructor === Promise;
                }
                if (isPromise) {
                    result.then(() => {
                        this.postMessage(this.response(WorkerEvents.Init, request, null));
                    }).catch((err: any) => {
                        this.postMessage(this.error(WorkerEvents.Init, request, err));
                    });
                } else {
                    this.postMessage(this.response(WorkerEvents.Init, request, null));
                }
            } catch (e) {
                this.postMessage(this.error(WorkerEvents.Init, request, null));
            }
        } else {
            this.postMessage(this.response(WorkerEvents.Init, request, null));
        }
    }


    /**
     * Handles `WorkerEvents.Callable` requests from a client by calling the targeted method and responding with the method's return value
     * @param request request recieved from the `WorkerClient`
     */
    async handleCallable(request: WorkerRequestEvent<WorkerEvents.Callable>) {
        let response: WorkerResponseEvent<any>;
        try {
            request.body.arguments = this.applyShallowTransferToCallableArgs(request, request.body.arguments);
            const result = await this.worker[request.propertyName](...request.body.arguments);

            response = this.response(WorkerEvents.Callable, request, result);
        } catch (e) {
            response = this.error(WorkerEvents.Callable, request, e);
        } finally {
            this.postMessage(response);
        }

    }

    /**
     * Transfers the prototype of any function arguments decorated with `@ShallowTransfer()` which have been serialized and recieved from a `WorkerEvents.Callable` request.
     *  This occurs before the arguments are used to call the worker function.
     * @param request request recieved from the `WorkerClient`
     * @param args array of function arguments
     */
    applyShallowTransferToCallableArgs(
        request: WorkerRequestEvent<WorkerEvents.Callable>,
        args: any[]
    ): any[] {

        const metaData = WorkerUtils.getAnnotation<ShallowTransferParamMetaData[]>(this.workerClass, WorkerAnnotations.ShallowTransferArgs, []);

        if (metaData) {
            const shallowTransferMeta = metaData.filter(x => x.name === request.propertyName);
            for (let i = 0; i < args.length; i++) {
                const meta = shallowTransferMeta.filter(x => x.argIndex === i)[0];
                if (meta) {
                    if (meta.type && args[i]) {
                        args[i].__proto__ = meta.type.prototype;
                    }
                }
            }
        }

        return args;
    }

    /**
     * Handles `WorkerEvents.Accessable` requests from a client by either setting the target property of the worker or responding with the target property's value
     * @param request request recieved from the `WorkerClient`
     */
    handleAccessable(request: WorkerRequestEvent<WorkerEvents.Accessable>) {
        let response: WorkerResponseEvent<any>;
        try {
            const metaData = WorkerUtils.getAnnotation<AccessableMetaData[]>(this.workerClass, 'accessables', []).filter(x => x.name === request.propertyName)[0];
            if (request.body.isGet) {
                response = this.response(WorkerEvents.Accessable, request, this.worker[request.propertyName]);
            } else {
                this.worker[request.propertyName] = request.body.value;
                if (metaData.shallowTransfer) {
                    if (metaData.type && this.worker[request.propertyName]) {
                        this.worker[request.propertyName].__proto__ = metaData.type.prototype;
                    }
                }
                response = this.response(WorkerEvents.Accessable, request, null);
            }
        } catch (e) {
            response = this.error(WorkerEvents.Accessable, request, e);
        } finally {
            this.postMessage(response);
        }
    }

    /**
     * Handles `WorkerEvents.Subscribable` requests from a client by creating a new subscription to the targeted observable which will send messages to the client each time
     * an event is triggered by the observable. The function may also unsubscribe from a subscription depending on the details of the request
     * @param request request recieved from the `WorkerClient`
     */
    handleSubscription(request: WorkerRequestEvent<WorkerEvents.Observable>) {
        let response: WorkerResponseEvent<WorkerEvents.Observable>;

        if (!request.body.isUnsubscribe) {
            try {
                this.createSubscription(request);
                response = this.response(WorkerEvents.Observable, request, request.body.subscriptionKey);
            } catch (e) {
                this.removeSubscription(request.body.subscriptionKey);
                response = this.error(WorkerEvents.Observable, request, e);
            } finally {
                this.postMessage(response);
            }
        } else {
            try {
                this.removeSubscription(request.body.subscriptionKey);
                response = this.response(WorkerEvents.Observable, request, null);
            } catch (e) {
                response = this.error(WorkerEvents.Observable, request, e);
            } finally {
                this.postMessage(response);
            }
        }
    }

    /**
     * Creates a new subscription to a worker observable and adds it to the `subscriptions` dictionary. The subscriptions will send messages to the client each time
     *  and event is triggered by the observable
     * @param request request recieved from the `WorkerClient`
     */
    createSubscription(request: WorkerRequestEvent<WorkerEvents.Observable>): void {

        this.removeSubscription(request.body.subscriptionKey);

        this.subscriptions[request.body.subscriptionKey] = (<Subject<any>>this.worker[request.propertyName]).subscribe(
            (val) => {
                const response: WorkerResponseEvent<WorkerObservableMessage> = {
                    type: WorkerEvents.ObservableMessage,
                    propertyName: request.propertyName,
                    isError: false,
                    requestSecret: null,
                    result: {
                        key: request.body.subscriptionKey,
                        type: WorkerObservableMessageTypes.Next,
                        value: val
                    }
                };
                this.postSubscriptionMessage(response);
            }, err => {
                const response: WorkerResponseEvent<WorkerObservableMessage> = {
                    type: WorkerEvents.ObservableMessage,
                    propertyName: request.propertyName,
                    isError: true,
                    requestSecret: null,
                    result: {
                        key: request.body.subscriptionKey,
                        type: WorkerObservableMessageTypes.Error,
                        error: JSON.parse(JSON.stringify(err, this.replaceErrors))
                    }
                };
                this.postSubscriptionMessage(response);
            }, () => {
                const response: WorkerResponseEvent<WorkerObservableMessage> = {
                    type: WorkerEvents.ObservableMessage,
                    propertyName: request.propertyName,
                    isError: false,
                    requestSecret: null,
                    result: {
                        key: request.body.subscriptionKey,
                        type: WorkerObservableMessageTypes.Complete,
                    }
                };
                this.postSubscriptionMessage(response);
            });
    }

    /**
     * Removes a subscription from the `subscriptions` dictionary, unsubscribing before it is deleted
     * @param subscriptionKey key in dictionary
     */
    removeSubscription(subscriptionKey: string) {
        if (this.subscriptions[subscriptionKey]) {
            this.subscriptions[subscriptionKey].unsubscribe();
        }
        delete this.subscriptions[subscriptionKey];
    }

    /**
     * Unsubscribes from all subscriptions
     */
    removeAllSubscriptions(): void {
        for (const key in this.subscriptions) {
            if (this.subscriptions[key]) {
                this.subscriptions[key].unsubscribe();
                delete this.subscriptions[key];
            }
        }
    }

    /**
     * A wrapper function around the `postMessage()` method allowing serialization errors to be caught and sent to the client as a `WorkerResponseEvent`.
     * Only used when the response is triggered by a request, which is not the case when the event type is `WorkerEvents.ObservableMessage`.
     * @param response reponse to send to the client
     */
    postMessage<EventType extends number>(
        response: WorkerResponseEvent<EventType>,
    ): void {
        try {
            this.messageBus.postMessage(response);
        } catch (e) {
            const errorResponse: WorkerResponseEvent<EventType> = {
                type: response.type,
                isError: true,
                requestSecret: response.requestSecret,
                propertyName: response.propertyName,
                error: JSON.parse(JSON.stringify(new Error('Unable to serialize response from worker to client'), this.replaceErrors)),
                result: null
            };
            this.messageBus.postMessage(errorResponse);
        }
    }

    /**
     * A wrapper function around the `postMessage()` method allowing serialization errors to be caught and sent to the client as a `WorkerResponseEvent`.
     * Only used when the response type is `WorkerEvents.ObservableMessage` which requires a different implementation to the `WorkerController.postMessage` wrapper as it
     * is one-way communication which is not triggered by a request
     */
    postSubscriptionMessage(
        response: WorkerResponseEvent<WorkerObservableMessage>,
    ): void {
        try {
            this.messageBus.postMessage(response);
        } catch (e) {
            const errorResponse: WorkerResponseEvent<WorkerObservableMessage> = {
                type: response.type,
                isError: true,
                requestSecret: response.requestSecret,
                propertyName: response.propertyName,
                result: {
                    key: response.result.key,
                    type: WorkerObservableMessageTypes.Error,
                    error: JSON.parse(JSON.stringify(new Error('Unable to serialize subsribable response from worker to client'), this.replaceErrors))
                },
            };
            this.messageBus.postMessage(errorResponse);
        }
    }


}
