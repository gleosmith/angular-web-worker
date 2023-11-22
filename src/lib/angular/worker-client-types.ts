import { Subject, Subscription, Observable } from 'rxjs';
import {SecretResult, WorkerAccessableBody, WorkerCallableBody, WorkerEvents, WorkerResponseEvent, WorkerSubscribableBody} from '../common';

/**
 * A dictionary of client observables that have been created to listen to events trigger by RxJS subjects in the worker.
 * The dictionary keys map the the messages that are sent from the worker to a particular observable in the client.
 */
export interface WorkerClientObservablesDict {
    [key: string]: WorkerClientObservableRef;
}

/**
 * A definition of a client observable that listens to events triggered by RxJS subjects in the worker and then triggers events in the browser
 * which depends on which `WorkerClient` method was used to create the listener
 */
export interface WorkerClientObservableRef {
    /**
     * The event that is triggered in the client when a observable message is recieved from the worker.
     * This will either execute a subscription or trigger an observable depending on whether the event listener was registered with the
     * `WorkerClient.subscribe()` or `WorkerClient.observe()` method.
     */
    subject: Subject<any>;
    /**
     * A subscription to the `WorkerClientObservableRef.subject` which is created and returned by the `WorkerClient.subscribe()` method.
     */
    subscription: Subscription;
    /**
     *  An observable from the `WorkerClientObservableRef.subject` which is created and returned by the `WorkerClient.observe()` method.
     */
    observable: Observable<any>;
    /**
     * The name of the worker's RxJS subject property that the client is listening to
     */
    propertyName: string;
}

/**
 * Configurable options that defines how a `WorkerClient` sends a request to, and handles the response from a `WorkerController` through the `WorkerClient.sendRequest()` method
 */
export interface WorkerClientRequestOpts<T, EventType extends number, ReturnType> {
    /**
     * Whether the request is triggered by the init event and therefore not requiring the client's connected property to be true
     */
    isConnect?: boolean;
    /**
     * The worker property to which the request relates. Can be provided as a string, or a lamda function which is used in the `WorkerClient`'s APIs
     */
    workerProperty?: ((worker: T) => ReturnType) | string;
    /**
     * The error message when the `WorkerClient.sendRequest()` method is rejected from the targeted worker property/method not returning the correct `SecretResult`
     * when called upon by the client
     */
    secretError: string;
    /**
     * Any conditions that need to be met, in addition to the correct `SecretResult`, before a request can be made to the worker
     */
    additionalConditions?: { if: (secretResult?: SecretResult<EventType>) => boolean, reject: (secretResult?: SecretResult<EventType>) => any }[];
    /**
     * A placeholder to perform unique work in the more generic `WorkerClient.sendRequest()` method. This occurs immediately before the client sends the request to
     * the worker and after the `SecretKey` is validated, along with any `additionalConditions` if the option was specified. The value returned
     * by this function is available for use through the `additionalContext` arguments in the `body`, `resolve` and `beforeReject` options' functions
     */
    beforeRequest?: (secretResult?: SecretResult<EventType>) => any;
    /**
     * Must return the `WorkerRequestEvent.body` that will be sent to the worker.  The structure is determined by the `WorkerClientRequestOpts`'s
     * `EventType` type argument
     * @param secretResult the `SecretResult` that is returned when the client called upon the targeted worker property or method
     * @param additionalContext if the `beforeRequest` option is provided it is the returned result of that function
     * otherwise it will be undefined
     */
    body?: (secretResult?: SecretResult<EventType>, additionalContext?: any) => EventType extends WorkerEvents.Callable ? WorkerCallableBody
        : EventType extends WorkerEvents.Accessable ? WorkerAccessableBody
        : EventType extends WorkerEvents.Observable ? WorkerSubscribableBody : null;
    /**
     * Function that returns the value that is resolved by the `WorkerClient.sendRequest()` method. Only occurs if a successful request has been made to, and a response has been recieved from the worker
     * @param response the `WorkerResponseEvent` that was returned by the worker
     * @param secretResult the `SecretResult` that was returned when the client called upon the targeted worker property or method
     * @param additionalContext if the `beforeRequest` option is provided it is the returned result of that function
     * otherwise it will be undefined
     */
    resolve?: (response?: WorkerResponseEvent<any>, secretResult?: SecretResult<EventType>, additionalContext?: any) => any;
    /**
     * A placeholder to perform unique work in the more generic `WorkerClient.sendRequest()` method. This occurs immediately before the request is rejected due to an error
     * being caught
     * @param response the `WorkerResponseEvent` that was returned by the worker
     * @param secretResult the `SecretResult` that was returned when the client called upon the targeted worker property or method
     * @param additionalContext if the `beforeRequest` option is provided it is the returned result of that function
     */
    beforeReject?: (response?: WorkerResponseEvent<any>, secretResult?: SecretResult<EventType>, additionalContext?: any) => void;
}


