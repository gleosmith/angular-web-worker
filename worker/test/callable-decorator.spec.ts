import { Callable } from '../src/public-api';
import { WorkerAnnotations, CallableMetaData, WorkerConfig, SecretResult, WorkerEvents } from '../../common/src/public-api';

class TestClassWithoutOptions {
    @Callable()
    doSomething(value: string, value2: number): string {
        return value + String(value2);
    }
}

class TestClassWithOptions {
    @Callable({ shallowTransfer: true })
    doSomething(value: string, value2: number): string {
        return value + String(value2);
    }
}


describe('@Callable(): [angular-web-worker]', () => {

    it('Should attach metadata to the class prototype', () => {
        expect(TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Callables].length).toEqual(1);
    });

    it('Should attach metadata with the property name', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Callables][0] as CallableMetaData).name).toEqual('doSomething');
    });

    it('Should attach metadata with the return type', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Callables][0] as CallableMetaData).returnType).toEqual(String);
    });

    it('Should attach metadata with the default options', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Callables][0] as CallableMetaData).shallowTransfer).toEqual(false);
    });

    it('Should attach metadata with the provided options', () => {
        expect((TestClassWithOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Callables][0] as CallableMetaData).shallowTransfer).toEqual(true);
    });

    it('For client instances, it should replace the function implementation to return a secret', () => {

        const instance = new TestClassWithOptions();
        instance[WorkerAnnotations.Config] = <WorkerConfig>{
            isClient: true,
            clientSecret: 'my-secret',
        };

        const result: SecretResult<WorkerEvents.Callable> = {
            propertyName: 'doSomething',
            type: WorkerEvents.Callable,
            clientSecret: 'my-secret',
            body: {
                args: ['hello', 1]
            }
        };
        expect(<any>instance.doSomething('hello', 1)).toEqual(result);
    });

    it('For worker instances, it should not replace the function implementation', () => {
        const instance = new TestClassWithOptions();
        instance[WorkerAnnotations.Config] = <WorkerConfig>{
            isClient: false,
        };
        expect(<any>instance.doSomething('twelve', 12)).toEqual('twelve12');
    });

    it('For instances where no config has been set, it should not replace the function implementation', () => {
        const instance = new TestClassWithOptions();
        expect(<any>instance.doSomething('joe', 20)).toEqual('joe20');
    });

});
