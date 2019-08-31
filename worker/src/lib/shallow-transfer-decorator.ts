import { WorkerUtils, ShallowTransferParamMetaData, WorkerAnnotations } from 'angular-web-worker/common';

/**
 * Transfers the decorated argument's prototype when it is serialized and unserialized when the method is called from `WorkerClient.call()`. This will only have an effect if
 * the method is decorated with `@Callable()`
 * @Experimental has limitations
 */
export function ShallowTransfer() {
    return function (target: Object, propertyKey: string | symbol, parameterIndex: number) {
        const argTypes: any[] = Reflect.getMetadata('design:paramtypes', target, propertyKey);
        WorkerUtils.pushAnnotation(target.constructor, WorkerAnnotations.ShallowTransferArgs, <ShallowTransferParamMetaData>{
            name: propertyKey,
            type: argTypes[parameterIndex],
            argIndex: parameterIndex
        });
    };
}
