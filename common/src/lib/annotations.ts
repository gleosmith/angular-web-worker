
/**
 * Worker annotation constants for decorators
 */
export enum WorkerAnnotations {
    Annotation = '__worker_annotations__',
    Config = '__worker_config__',
    Callables = 'callables',
    Observables = 'observables',
    Accessables = 'accessables',
    ShallowTransferArgs = 'shallowTransferArgs',
    IsWorker = 'isWorker',
    Factory = 'workerFactory'
}

/**
 * Configuration options attached to a worker instance describing if the instance is a client or not
 */
export interface WorkerConfig {
    /**
     * Whether worker is client instance or not, determined by whether it is created from a `WorkerClient` or the `bootstrapWorker()` function
     */
    isClient: boolean;
    /**
     * A secret that is attached to the client instance of a worker which must be returned when a `WorkerClient` calls any methods/properties of the worker
     */
    clientSecret?: string;
}

/**
 * Metadata attached to a worker's prototype for any properties decorated with `@Accessable()`. Contains details that describes how a `WorkerClient` can access the property
 */
export interface AccessableMetaData {
    /**
     * Name of the decorated property
     */
    name: string;
    /**
     * Prototype of the decorated property's design type that is obtained using reflection
     */
    type: Function;
    /**
     * Determines whether the decorated worker property can be retrieved by a `WorkerClient`. Set as an optional parameter in the `@Accessable()` decorator
     * @defaultvalue true
     */
    get: boolean;
    /**
     * Determines whether the decorated worker property can be set from a `WorkerClient`. Set as an optional parameter in the `@Accessable()` decorator
     * @defaultvalue true
     */
    set: boolean;
    /**
     * Whether the decoratored property's prototype is transfered after it has been serialized and unserialized during communication between a worker and a client. Set as an optional parameter in the `@Accessable()` decorator
     * @defaultvalue false
     * @Experimental has limitations
     */
    shallowTransfer: boolean;
}

/**
 * Metadata attached to a worker's prototype for any methods decorated with `@Callable()`. Contains details that allows the method to be called from a `WorkerClient`
 */
export interface CallableMetaData {
    /**
     * Name of the decorated property
     */
    name: string;
    /**
     * Prototype of the decorated method's return type that is obtained using reflection
     */
    returnType: Function;
    /**
     * Whether the returned value's prototype is transfered after it has been serialized and unserialized when it is brought back to a client. Set as an optional parameter in the `@Callable()` decorator
     * @defaultvalue false
     * @Experimental has limitations (cannot be used with async functions)
     */
    shallowTransfer: boolean;
}

/**
 * Metadata attached to a worker's prototype for any RxJS Subject properties that are decorated with `@Subscribable()`. Allows a `WorkerClient` to
 *  subscribe to and/or create observables from the subject within the worker
 */
export interface SubscribableMetaData {
    /**
     * Name of the decorated property
     */
    name: string;
    /**
     * Prototype of the decorated property's design type
     */
    type: Function;
}

/**
 * Metadata attached to a worker's prototype for method arguments that are decorated with `@ShallowTransfer()`.
 * Contains details that allows the argument's prototype to be transfered after it has been serialized and unserialized when sent from a client to be passed as an argument of a worker function.
 * @Experimental has limitations
 */
export interface ShallowTransferParamMetaData {
    /**
     * Name of the decorated property
     */
    name: string;
    /**
     * Prototype of the decorated argument's design type
     */
    type: Function;
    /**
     * Index of the argument in the functions call signiture
     */
    argIndex: number;
}


