import 'reflect-metadata';
import { CallableMetaData, WorkerConfig, WorkerEvents, SecretResult, WorkerUtils, WorkerAnnotations } from 'angular-web-worker/common';

/**
 * Configurable options for the `@Callable()` decorator, defining how the decorated method is called from a `WorkerClient`.
 */
export interface CallableOpts {
    /**
     * Whether the prototype of the value returned by the decorated method is transfered after it has been serialized and unserialized when brought back to the `WorkerClient`
     * @defaultvalue false
     * @Experimental has limitations
     */
    shallowTransfer?: boolean;
}

/**
 * Allows the decorated worker method to be called, and its value returned, from the `WorkerClient.call()` method.
 * Can be used on both asynchronous and synchronous methods.
 * @Serialized Functions will not be copied and circular referencing structures will cause errors. This applies to both the function arguments and the value returned by the function
 * @param options Configurable options defining how the decorated method is called from a `WorkerClient`
 */
export function Callable(options?: CallableOpts) {

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {

        const opts = { shallowTransfer: false };
        if (options) {
            opts.shallowTransfer = options.shallowTransfer ? true : false;
        }

        WorkerUtils.pushAnnotation(target.constructor, WorkerAnnotations.Callables, <CallableMetaData>{
            name: propertyKey,
            shallowTransfer: opts.shallowTransfer,
            returnType: Reflect.getMetadata('design:returntype', target, propertyKey)
        });

        const originalMethod = descriptor.value;
        descriptor.value = function () {
            const context = this;
            const args = Array.prototype.slice.call(arguments);
            const config: WorkerConfig = context.__worker_config__;
            if (config) {
                if (config.isClient) {
                    const secret: SecretResult<WorkerEvents.Callable> = {
                        clientSecret: context.__worker_config__.clientSecret,
                        type: WorkerEvents.Callable,
                        propertyName: propertyKey,
                        body: {
                            args: args
                        }
                    };
                    return secret;
                } else {
                    return originalMethod.call(context, ...args);
                }
            } else {
                return originalMethod.call(context, ...args);
            }
        };
        return descriptor;
    };
}
