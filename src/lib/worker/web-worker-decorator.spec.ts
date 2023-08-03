import { AngularWebWorker, Accessable, WorkerFactoryFunctions } from './public-api';
import { WorkerAnnotations, WorkerConfig, WorkerEvents, SecretResult } from '../../common/src/public-api';
import { Subscribable } from './public-api';
import { Subject } from 'rxjs';

@AngularWebWorker()
class WorkerTestClass {
    name: string;
    constructor() {
        this.name = 'Peter';
    }
}

describe('@AngularWebWorker(): [angular-web-worker]', () => {


    it('Should attach metadata', () => {
        expect(WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.IsWorker]).toEqual(true);
    });

    it('Should attach metadata with a factory function', () => {
        expect(typeof WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory]).toEqual('function');
    });

    describe('Worker factory', () => {

        const config: WorkerConfig = {
            isClient: false
        };

        it('Should return a new class instance', () => {
            const spy = spyOn(WorkerFactoryFunctions, 'setWorkerConfig');
            expect(WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory](config)).toEqual(new WorkerTestClass());
        });

        it('Should call setWorkerConfig with config and new instance', () => {
            const spy = spyOn(WorkerFactoryFunctions, 'setWorkerConfig');
            WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory](config);
            expect(spy).toHaveBeenCalledWith(new WorkerTestClass(), config);
        });

        it('Should call WorkerFactoryFunctions.configureAccessables', () => {
            const spy = spyOn(WorkerFactoryFunctions, 'configureAccessables');
            WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory](config);
            expect(spy).toHaveBeenCalled();
        });

        it('Should call WorkerFactoryFunctions.configureSubscribables', () => {
            const spy = spyOn(WorkerFactoryFunctions, 'configureSubscribables');
            WorkerTestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Factory](config);
            expect(spy).toHaveBeenCalled();
        });

        describe('WorkerFactoryFunctions.configureAccessables()', () => {

            class AccessableTestClass {
                @Accessable()
                public property: string;
                public property2: string;
            }

            let clientInstance: AccessableTestClass;
            let workerInstance: AccessableTestClass;
            const property1Value = 'value1';
            const property2Value = 'value2';
            const clientSecretKey = 'my-secret';

            beforeEach(() => {
                clientInstance = new AccessableTestClass();
                clientInstance[WorkerAnnotations.Config] = <WorkerConfig>{
                    isClient: true,
                    clientSecret: clientSecretKey
                };
                clientInstance.property = property1Value;
                clientInstance.property2 = property2Value;
                WorkerFactoryFunctions.configureAccessables(clientInstance);

                workerInstance = new AccessableTestClass();
                workerInstance[WorkerAnnotations.Config] = <WorkerConfig>{
                    isClient: false,
                };
                workerInstance.property = property1Value;
                workerInstance.property2 = property2Value;
                WorkerFactoryFunctions.configureAccessables(workerInstance);
            });

            it('For client instances, it should replace the getter of decorated properties to return a secret', () => {
                const secretResult: SecretResult<WorkerEvents.Accessable> = {
                    clientSecret: clientSecretKey,
                    propertyName: 'property',
                    type: WorkerEvents.Accessable,
                    body: {
                        get: true,
                        set: true,
                    }
                };
                expect((<any>clientInstance.property)).toEqual(secretResult);
            });

            it('For client instances, it should not replace the getter of undecorated properties', () => {
                expect(clientInstance.property2).toEqual(property2Value);
            });

            it('For worker instances, it should not replace the getter functionality of any properties', () => {
                expect(workerInstance.property).toEqual(property1Value);
                expect(workerInstance.property2).toEqual(property2Value);
            });

            it('For instances where no config has been set, it should not replace the getter functionality of any properties', () => {
                const instance = new AccessableTestClass();
                instance.property = property1Value;
                instance.property2 = property2Value;
                expect(instance.property).toEqual(property1Value);
                expect(instance.property2).toEqual(property2Value);
            });

        });

        describe('WorkerFactoryFunctions.configureSubscribables()', () => {

            class SubscribableTestClass {
                @Subscribable()
                public event: Subject<any>;
                public event2: Subject<any>;
            }

            let clientInstance: SubscribableTestClass;
            let workerInstance: SubscribableTestClass;
            const subjectValue = new Subject<any>();
            const clientSecretKey = 'my-secret';

            beforeEach(() => {
                clientInstance = new SubscribableTestClass();
                clientInstance[WorkerAnnotations.Config] = <WorkerConfig>{
                    isClient: true,
                    clientSecret: clientSecretKey
                };
                clientInstance.event = subjectValue;
                clientInstance.event2 = subjectValue;
                WorkerFactoryFunctions.configureSubscribables(clientInstance);

                workerInstance = new SubscribableTestClass();
                workerInstance[WorkerAnnotations.Config] = <WorkerConfig>{
                    isClient: false,
                };
                workerInstance.event = subjectValue;
                WorkerFactoryFunctions.configureSubscribables(workerInstance);
            });

            it('For client instances, it should replace the getter of decorated properties to return a secret', () => {
                const secretResult: SecretResult<WorkerEvents.Observable> = {
                    clientSecret: clientSecretKey,
                    propertyName: 'event',
                    type: WorkerEvents.Observable,
                    body: null
                };
                expect((<any>clientInstance.event)).toEqual(secretResult);
            });

            it('For client instances, it should not replace the getter of undecorated properties', () => {
                expect(clientInstance.event2).toEqual(subjectValue);
            });

            it('For worker instances, it should not replace the getter functionality of any properties', () => {
                expect(workerInstance.event).toEqual(subjectValue);
                expect(workerInstance.event2).toEqual(undefined);
            });

            it('For instances where no config has been set, it should not replace the getter functionality of any properties', () => {
                const instance = new SubscribableTestClass();
                instance.event = subjectValue;
                expect(instance.event).toEqual(subjectValue);
                expect(instance.event2).toEqual(undefined);
            });

        });

        describe('WorkerFactoryFunctions.setWorkerConfig()', () => {

            it('Should attach config to class intance', () => {
                const instance = new WorkerTestClass();
                WorkerFactoryFunctions.setWorkerConfig(instance, config);
                expect(instance[WorkerAnnotations.Config]).toEqual(config);
            });

        });

    });


});
