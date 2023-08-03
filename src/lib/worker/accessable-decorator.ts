import 'reflect-metadata';
import {WorkerUtils} from '../common/worker-utils';
import {AccessableMetaData, WorkerAnnotations} from '../common/annotations';

/**
 * Configurable options for the `@Accessable()` decorator, defining how the decorated property can be interacted with from a `WorkerClient`.
 */
export interface AccessableOpts {
    /**
     * Determines whether the decorated property can be retrieved by a `WorkerClient` with its `get()` method
     * @defaultvalue true
     */
    get?: boolean;
    /**
     * Determines whether the decorated property can be set by a `WorkerClient` with its `set()` method
     * @defaultvalue true
     */
    set?: boolean;
    /**
     * Whether the decoratored property's prototype is transfered after it has been serialized and unserialized.
     * @defaultvalue false
     * @Experimental has limitations
     */
    shallowTransfer?: boolean;
}

/**
 * Allows the decorated worker property to be accessed from the `WorkerClient.get()` and `WorkerClient.set()` methods
 * @Serialized Functions will not be copied and circular referencing structures will cause errors
 * @param options configurable options defining how the decorated property can be interacted with from a `WorkerClient`
 */
export function Accessable(options?: AccessableOpts) {

    const opts: AccessableOpts = { get: true, set: true, shallowTransfer: false };
    if (options) {
        opts.get = options.get === false ? false : true;
        opts.set = options.set === false ? false : true;
        opts.shallowTransfer = options.shallowTransfer ? true : false;
    }

    return function (target: any, propertyKey: string) {
        WorkerUtils.pushAnnotation(target.constructor, WorkerAnnotations.Accessables, <AccessableMetaData>{
            name: propertyKey,
            type: Reflect.getMetadata('design:type', target, propertyKey),
            get: opts.get,
            set: opts.set,
            shallowTransfer: opts.shallowTransfer
        });
    };

}

