import { WorkerUtils, WorkerConfig, WorkerAnnotations, AccessableMetaData, SecretResult, WorkerEvents, SubscribableMetaData } from 'angular-web-worker/common';

/*
* Collection of factory functions for the factory as attached to a single object which allows for testing of imported function
*/
export interface WorkerFactoryFunctionsDict {
    /*
    * Attaches a worker configuration to an instance of a worker class
    * @param instance instance of the worker class
    * @param config configuration
    */
    setWorkerConfig: (instance: any, config: WorkerConfig) => void;
    /*
    * Adds a get wrapper to all properties decorated with `@Accessable()` which returns a `SecretResult` if the class instance is a client, otherwise it will use the default behaviour
    * @param instance instance of the worker class
    */
    configureAccessables: (instance: any) => void;
    /**
     * Adds a get wrapper to all properties decorated with `@Subscribable()` which returns a `SecretResult` if the class instance is a client, otherwise it will use the default behaviour
     * @param instance instance of the worker class
     */
    configureSubscribables: (instance: any) => void;
}

export const WorkerFactoryFunctions: WorkerFactoryFunctionsDict = {
    /*
     * Attaches a worker configuration to an instance of a worker class
     * @param instance instance of the worker class
     * @param config configuration
     */
    setWorkerConfig: (instance: any, config: WorkerConfig) => {
        Object.defineProperty(instance, WorkerAnnotations.Config, {
            get: function () {
                return config;
            },
            enumerable: true,
            configurable: true
        });
    },

    configureAccessables: (instance: any) => {
        const accessables: AccessableMetaData[] = WorkerUtils.getAnnotation(instance.__proto__.constructor, WorkerAnnotations.Accessables, []);

        if (accessables) {
            accessables.forEach((item) => {
                let _val = instance[item.name];
                const getter = function () {
                    const config: WorkerConfig = this.__worker_config__;
                    if (config) {
                        if (config.isClient) {
                            const secret: SecretResult<WorkerEvents.Accessable> = {
                                clientSecret: config.clientSecret,
                                type: WorkerEvents.Accessable,
                                propertyName: item.name,
                                body: {
                                    get: item.get,
                                    set: item.set
                                }
                            };
                            return secret;
                        } else {
                            return _val;
                        }
                    } else {
                        return _val;
                    }
                };

                const setter = newVal => {
                    _val = newVal;
                };

                delete instance[item.name];
                Object.defineProperty(instance, item.name, {
                    get: getter,
                    set: setter,
                    enumerable: true,
                    configurable: true
                });

            });
        }

    },

    configureSubscribables: (instance: any) => {

        const observables = WorkerUtils.getAnnotation<SubscribableMetaData[]>(instance.__proto__.constructor, WorkerAnnotations.Observables, []);

        if (observables) {
            observables.forEach((item) => {
                let _val = instance[item.name];

                const getter = function () {
                    const config: WorkerConfig = this.__worker_config__;
                    if (config) {
                        if (config.isClient) {
                            const secret: SecretResult<WorkerEvents.Observable> = {
                                clientSecret: config.clientSecret,
                                type: WorkerEvents.Observable,
                                propertyName: item.name,
                                body: null
                            };
                            return secret;
                        } else {
                            return _val;
                        }
                    } else {
                        return _val;
                    }
                };

                const setter = newVal => {
                    _val = newVal;
                };

                delete instance[item.name];
                Object.defineProperty(instance, item.name, {
                    get: getter,
                    set: setter,
                    enumerable: true,
                    configurable: true
                });

            });
        }

    }
};

/**
 * Class decorator allowing the class to be bootstrapped into a web worker script, and allowing communication with a `WorkerClient`
 */
export function AngularWebWorker() {

    return function (target: any) {
        WorkerUtils.setAnnotation(target, WorkerAnnotations.IsWorker, true);
        WorkerUtils.setAnnotation(target, WorkerAnnotations.Factory, function create(config: WorkerConfig) {
            const instance = new target();
            WorkerFactoryFunctions.setWorkerConfig(instance, config);
            WorkerFactoryFunctions.configureAccessables(instance);
            WorkerFactoryFunctions.configureSubscribables(instance);
            return instance;
        });

    };

}




