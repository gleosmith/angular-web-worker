import 'reflect-metadata';
import {ObservablesOnly} from './common/worker-types';
import {SubscribableMetaData, WorkerAnnotations} from './common/annotations';
import {WorkerUtils} from './common/worker-utils';

/**
 * Allows the decorated worker property to be subscribed to, or observed through the `WorkerClient.subscribe()` and `WorkerClient.observe()` methods.
 *
 * Can only be used on multicasted RxJS observables being a `Subject`,  `BehaviorSubject`, `ReplaySubject` or `AsyncSubject`.
 * @Serialized When data is transferred through `Subject.next()`, functions will not be copied and circular referencing structures will cause errors
 */
export function Subscribable() {
    return function <T, Tkey extends keyof ObservablesOnly<T>>(target: T, propertyKey: Tkey) {
        WorkerUtils.pushAnnotation(target.constructor, WorkerAnnotations.Observables, <SubscribableMetaData>{
            name: propertyKey,
            type: Reflect.getMetadata('design:type', target, <string>propertyKey)
        });
    };
}
