import { Observable, BehaviorSubject, Subject, AsyncSubject, ReplaySubject } from 'rxjs';

/**
 * A type interface to specify the prototype of any class that can be used as a web worker when decorated with `@AngularWebWorker()`
 */
export interface WebWorkerType<T> extends Function {
    new(...args: any[]): T;
}

/**
 * The names of methods/functions from any class provided as a generic type argument
 */
export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

/**
 * Selection of class methods/functions where the class is provided as a generic type argument
 */
export type FunctionsOnly<T> = Pick<T, FunctionPropertyNames<T>>;

/**
 * The names of properties in a particular class that are neither methods nor observables where the class is provided as a generic type argument
 */
export type NonObservablePropertyNames<T> = { [K in keyof T]: T[K] extends Observable<any> ? never
    : T[K] extends Function ? never : K }[keyof T];
/**
 * Selection class properties that are neither methods nor observables where the class is provided as a generic type argument
 */
export type NonObservablesOnly<T> = Pick<T, NonObservablePropertyNames<T>>;

/**
 * The names of class properties that are multicasted RxJS observables, being a `Subject`, `BehaviorSubject`, `AsyncSubject` or `ReplaySubject`.
 * The class is provided as a generic type argument
 */
export type ObservablePropertyNames<T> = { [K in keyof T]: T[K] extends
    (BehaviorSubject<any> | Subject<any> | AsyncSubject<any> | ReplaySubject<any>) ? K : never;
}[keyof T];

/**
 * Selection of class properties that are multicasted RxJS observables, being a `Subject`, `BehaviorSubject`, `AsyncSubject` or `ReplaySubject`.
 * The class is provided as a generic type argument
 */
export type ObservablesOnly<T> = Pick<T, ObservablePropertyNames<T>>;

/**
 * A type of RxJS observable
 */
export type WorkerObservableType<T> = Observable<T>;


