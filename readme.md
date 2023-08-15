# Description
An Angular library providing an easier way to work web workers in an Angular application. It allows you to interact with a web worker in similar way to using a simple TypeScript class, enjoying all the features of the TypeScript language as the more messy communication is handled for you.
This is a fork of [gleosmith/angular-web-worker](https://github.com/gleosmith/angular-web-worker) to latest angular versions.
Schematics from the original package are not supported at the moment.

# Getting Started

### 1. Use an existing, or create a new Angular (v15+) app

### 2. Install the library

> npm i @wbds/angular-web-worker --save

### 3. Create a web worker

Schematics of the original package are not supported at the moment. So you have to create your web worker source file with decorators and the corresponding tsconfig on your own.
An example web worker could look like this:

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit } from '@wbds/angular-web-worker';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

    constructor() {}

    onWorkerInit() {
    }

}
bootstrapWorker(AppWorker);
```
**IMPORTANT:**
- If you have already used the web-worker schematics from the standard angular-cli v8+ _(ng generate web-worker)_ within your angular app, then you will need to modify the tsconfig.json in the project's root directory by removing "\*\*/\*.worker.ts" from the "exclude" property. If you have not done this the command _ng g angular-web-worker:angular-web-worker_ will prompt you to do so with an error message.
- The worker class cannot directly or indirectly have any import references from the `@angular/core` library as this will cause build errors when the worker is bundled separately by the [worker-plugin](https://github.com/GoogleChromeLabs/worker-plugin) for webpack. As such, this library has been built to consist of several sub-packages to ensure that the `@angular/core` library is not indirectly imported into a worker class.

# Usage

## The WorkerModule
Once a new worker class has been created, a definition of the worker must be imported into an Angular module through WorkerModule.forWorkers(definitions[]). This plays two roles, it provides an injectable Angular service which is used to create clients that communicate between the Angular app and the worker script. It is also contains the syntax which allows the [worker-plugin](https://github.com/GoogleChromeLabs/worker-plugin) for webpack to detect the worker classes and create separate bundles that can be loaded as worker scripts in the browser. The [worker-plugin](https://github.com/GoogleChromeLabs/worker-plugin) requires a specific syntax to create these separate bundles.


*app.module.ts*
```typescript
import { WorkerModule } from '@wbds/angular-web-worker';
import { AppWorker } from './app.worker';

@NgModule({
  ...
  imports: [
    ...,
    // the path in the init function must given as a string (not a variable) and the type must be 'module'
    WorkerModule.forWorkers([
       {worker: AppWorker, initFn: () => new Worker('./app.worker.ts', {type: 'module'})},
    ]),
    ...
  ],
})
export class AppModule { }
```
## The WorkerClient
Once the definitions have been imported into a module the WorkerManager service can be used to create new clients which have the functionality to create, communicate with and terminate workers throughout the angular application. While it seems as if the client calls the worker class directly, the standard postMessage and onmessage communication mechanism is still used under the hood therefore all data is still serialized. Therefore, when any class/object is sent to and/or received from a worker the data is copied and it's functions/methods will not be transferred. Circular referencing data structures are not serializable. For more on web workers see [here](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker';

@Component({
   ...
})
export class AppComponent implements OnInit {

  private client: WorkerClient<AppWorker>;

  constructor(private workerManager: WorkerManager) { }

  ngOnInit() {
    if (this.workerManager.isBrowserCompatible) {
      this.client = this.workerManager.createClient(AppWorker);
    } else {
      // if code won't block UI else implement other fallback behaviour
      this.client = this.workerManager.createClient(AppWorker, true);
    }
  }

}
```
***RUNNING THE WORKER IN THE APPLICATION***

The `WorkerManager.createClient()` method has an optional argument to run the worker inside the application, essentially keeping it within the application's "thread". This can be used as fallback behaviour if the browser does not support web workers, however it should be used with caution as intensive work will impact the performance and the user experience. In this case, no data is serialized in order to avoid the "expensive" serialization operations that will hinder performance. However, the worker should be designed with serialization in mind so that the functionality to execute the code in either a separate worker script or within the app can be used interchangeably. For this reason, it is important to use the testing utilities provided by the library which mocks this behaviour to ensure the code works as expected under both circumstances.

## Creating a Worker

The `WorkerClient.connect()` method will create a new worker in the browser and trigger the `OnWorkerInit` lifecycle hook, if it has been implemented. The promise will only be resolved once the `onWorkerInit` method has finished executing. If the `onWorkerInit` method is asynchronous _(returns a promise)_, the connect method will only resolve once that promise has been resolved.

**OnWorkerInit**

Any logic or initialization of variables in the constructor of the worker class will cause exceptions to be thrown given that both a client instance and a worker instance of the same class are created behind the scenes. Therefore, the `OnWorkerInit` has been provided as a replacement for the constructor.

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit } from '@wbds/angular-web-worker';
import { Subject } from 'rxjs';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

    private event: Subject<any>;
    private data: any;

    constructor() {}

    async onWorkerInit() {
      // can also be a synchronous function
      this.event = new Subject<any>();
      const resp = await fetch('https://example.com');
      this.data = await resp.json();
    }

}
bootstrapWorker(AppWorker);
```

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker/angular';

@Component({
   ...
})
export class AppComponent implements OnInit {

  private client: WorkerClient<AppWorker>;

  constructor(private workerManager: WorkerManager) { }

  ngOnInit() {
    if (this.workerManager.isBrowserCompatible) {
      this.client = this.workerManager.createClient(AppWorker);
    } else {
      this.client = this.workerManager.createClient(AppWorker, true);
    }
  }

  async createWorker() {
    // can use the Promise.then().catch() syntax if preferred
    await this.client.connect();
  }

}
```

## Creating Multiple Workers

Each client is responsible for a single worker, therefore creating multiple instances of the same worker simply involves creating multiple clients

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker';

@Component({
   ...
})
export class AppComponent implements OnInit {

  private client1: WorkerClient<AppWorker>;
  private client2: WorkerClient<AppWorker>;

  constructor(private workerManager: WorkerManager) {}

  ngOnInit() {
      if(this.workerManager.isBrowserCompatible) {
          this.client1 = this.workerManager.createClient(AppWorker);
          this.client2 = this.workerManager.createClient(AppWorker);
      } else {
          this.client1 = this.workerManager.createClient(AppWorker, true);
          this.client2 = this.workerManager.createClient(AppWorker, true);
      }
  }

  async createWorkers() {
      await Promise.all([this.client1.connect(), this.client2.connect()]);
  }

}
```

## Accessing Worker Properties

When a worker property is decorated with `@Accessable()` that property can be accessed by a client through the `WorkerClient.get()` and  `WorkerClient.set()` methods. Both of these methods are asynchronous and take a lambda expression as the first argument which returns the targeted property. Again, data that sent to the worker through the set operation, and returned from the worker through the get operation is serialized. Therefore, classes that have methods should generally be avoided. A `shallowTransfer` option can be provided as optional parameter to the decorator which transfers the prototype of the object or class that is sent to, or received from a worker. This allows the methods of the class/object to be copied, however, it is more of an experimental feature as it does have limitations which are discussed in more detail further below.

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit, Accessable } from '@wbds/angular-web-worker';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

    @Accessable() names: string[];

    constructor() {}

    onWorkerInit() {
        this.names = ['Joe', 'Peter', 'Mary'];
    }

}
bootstrapWorker(AppWorker);
```

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker/angular';

@Component({
   ...
})
export class AppComponent implements OnInit {

  private client: WorkerClient<AppWorker>;

  constructor(private workerManager: WorkerManager) {}

  ngOnInit() {
      if(this.workerManager.isBrowserCompatible) {
          this.client = this.workerManager.createClient(AppWorker);
      } else {
          this.client = this.workerManager.createClient(AppWorker, true);
      }
  }

  async updateWorkerNames() {
      // can use the Promise.then().catch() syntax if preferred
      await this.client.connect();
      const workerNames = await this.client.get(w => w.names);
      await this.client.set(w => w.names, ['John']);
  }

}
```

**Decorator Options:** *all options are optional*

| Name            | Description                              | Type    | Default |
|-----------------|------------------------------------------|---------|--------:|
| get             | whether `WorkerClient.get()` can be used | boolean |    true |
| set             | whether `WorkerClient.set()` can be used | boolean |    true |
| shallowTransfer | if the prototype is copied               | boolean |   false |

*Example*
```typescript
@Accessable({get: true, set: false, shallowTransfer: true}) names: string[];
```

## Calling Worker Methods

When a worker method is decorated with `@Callable()` that method can be called with `WorkerClient.call()`. This is an asynchronous method that only resolves once the decorated method has completed. If the decorated method is also asynchronous it will only resolve once that method has resolved. The `WorkerClient.call()` method only takes one argument which is a lambda function that calls the targeted method. Similar to the `@Accessable()` decorator, all data is serialized which applies to both the function arguments and the returned value. A `shallowTransfer` option can also be passed into the decorator, however this only applies to the value returned by the decorated method. A separate parameter decorator `@ShallowTransfer()` can be used on the method arguments. Read further below for more on the `shallowTransfer` feature.

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit, Callable } from '@wbds/angular-web-worker';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

  constructor() { }

  onWorkerInit() {
  }

  @Callable()
  async doSomeWork(value1: string, value2: number): Promise<string> {
    // execute some async code
    // this method can also be synchrounous
    return `${value1}-${value2 * 2}`;
  }

}
bootstrapWorker(AppWorker);
```

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker/angular';

@Component({
   ...
})
export class AppComponent implements OnInit {

  private client: WorkerClient<AppWorker>;

  constructor(private workerManager: WorkerManager) {}

  ngOnInit() {
      if(this.workerManager.isBrowserCompatible) {
          this.client = this.workerManager.createClient(AppWorker);
      } else {
          this.client = this.workerManager.createClient(AppWorker, true);
      }
  }

  async callWorkerMethod() {
      // can use the Promise.then().catch() syntax if preferred
      await this.client.connect();
      const returnValue = await this.client.call(w => w.doSomeWork('value', 2000));
  }

}
```
**Decorator Options:** *all options are optional*

| Name            | Description                                      | Type    | Default |
|-----------------|--------------------------------------------------|---------|--------:|
| shallowTransfer | if the prototype of the returned value is copied | boolean |   false |

*Example*
```typescript
@Callable({shallowTransfer: true})
doSomeWork(): MyClassWithMethods {
    return new MyClassWithMethods();
}
```

## Subscribing to Worker Events

When a RxJS subject property in a worker is decorated with `@Subscribable()` a client can create a subscription to the observable with `WorkerClient.subscribe()`. All types of multicasted RxJS observables are supported being a `Subject`,  `BehaviorSubject`, `ReplaySubject` or `AsyncSubject`. The subscribe method has two required arguments, the first is a lambda expression returning the targeted subject and the second is the `next` callback. There are two optional arguments being the `onerror` and `complete` callbacks for the subscription. Again, any data that sent from the worker to the client is serialized. 

**UNSUBSCRIBING**

The client's subscribe method returns a promise with the subscription, which can be unsubscribed from before the worker is terminated. However, it is not advisable to unsubscribe from the subscription with the normal `Subscription.unsubscribe()` approach. This is because two subscriptions are actually created, one within the Angular app and one within the worker script. Therefore, in order to release resources within the worker the `WorkerClient.unsubscribe(subscription)` method should be used.

If there is no need to unsubscribe from the subscription before the worker is terminated, simply terminating the worker with the `WorkerClient.destroy()` method will properly dispose of the subscriptions.

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit, Subscribable } from '@wbds/angular-web-worker';
import { BehaviorSubject } from 'rxjs';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

  @Subscribable() event: BehaviorSubject<number>;

  constructor() {}

  onWorkerInit() {
      this.event = new BehaviorSubject<number>(100);
  }

}
bootstrapWorker(AppWorker);
```

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker/angular';

@Component({
   ...
})
export class AppComponent implements OnInit, OnDestroy {

  private client: WorkerClient<AppWorker>;
  private subscription: Subscription;

  constructor(private workerManager: WorkerManager) { }

  ngOnInit() {
    if (this.workerManager.isBrowserCompatible) {
      this.client = this.workerManager.createClient(AppWorker);
    } else {
      this.client = this.workerManager.createClient(AppWorker, true);
    }
  }

  async subscribeToWorker() {
    await this.client.connect();
    this.subscription = await this.client.subscribe(w => w.event,
      (no) => { console.log(no); },
      // optional 
      (err) => { console.log(err); },
      () => { console.log('Done'); }
    );
  }

  unsubscribeFromWorker() {
    this.client.unsubscribe(this.subscription);
  }

  ngOnDestroy() {
    // will unsubscribe from all subscriptions
    this.client.destroy();
  }

}
```

## Creating Observables from Worker Events

Similar to subscribing to a worker event, a client can also create an RxJS observable from an event subject decorated with `@Subscribable()`. This is through the `WorkerClient.observe()` method, which returns a promise of the observable and takes one argument being a lambda expression that returns the targeted event subject. 

**UNSUBSCRIBING**

Typically, there is no need to unsubscribe when only using observables, however if there is no need to retain an observable created from `WorkerClient.observe()` until worker is terminated then `WorkerClient.unsubscribe(observable)` method should be used to release resources within the worker.

*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit, Subscribable } from '@wbds/angular-web-worker';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

    @Subscribable() event: BehaviorSubject<string[]>;

    constructor() {}

    onWorkerInit() {
        this.event = new BehaviorSubject<string[]>(['value1','value2']);
    }

}
bootstrapWorker(AppWorker);
```

*app.component.ts*
```typescript
import { AppWorker } from './app.worker';
import { WorkerManager, WorkerClient } from '@wbds/angular-web-worker';

@Component({
   ...
})
export class AppComponent implements OnInit, OnDestroy {

  private client: WorkerClient<AppWorker>;
  private observable$: Observable<string[]>;

  constructor(private workerManager: WorkerManager) { }

  ngOnInit() {
    if (this.workerManager.isBrowserCompatible) {
      this.client = this.workerManager.createClient(AppWorker);
    } else {
      this.client = this.workerManager.createClient(AppWorker, true);
    }
  }

  async createObservable() {
    await this.client.connect();
    this.observable$ = await this.client.observe(w => w.event);
  }

  removeObservable() {
    // remove observable before termination if needed
    this.client.unsubscribe(this.observable$);
    this.observable$ = null;
  }

  ngOnDestroy() {
    this.client.destroy();
  }

}
```
## Terminating a Worker

A worker script will remain active in the browser until the `WorkerClient.destroy()` method is called, so it is important ensure that the worker is properly disposed of before an Angular component/directive is destroyed.

```typescript
ngOnDestroy() {
  this.client.destroy();
}
```

## ShallowTransfers

The shallow transfer feature allows the prototype of the data sent to, or received from a worker to be copied after the data has been serialized. It can be used to copy the functions from a class, but it does have limitations as it will only copy the prototype class and will not copy the prototypes for any of its properties. Likewise for arrays, the array prototype is already natively detected by the browser so the use of the shallow transfer feature will have no effect as it will have no impact on the elements of the array.

**USAGE**
- `@Accessable({shallowTransfer: true})` - applies to both get and set operations
- `@Callable({shallowTransfer: true})` - applies to the value returned by the decorated function
- `@ShallowTransfer()` - decorator for arguments in a method decorated with @Callable()

*person.ts*
```typescript
class Person {

    name: string;
    age: number;
    spouse: Person;

    constructor() {}
    
    birthday() {
        this.age++;
    }
}
```
*app.worker.ts*
```typescript
import { AngularWebWorker, bootstrapWorker, OnWorkerInit, Callable, ShallowTransfer } from '@wbds/angular-web-worker';
/// <reference lib="webworker" />

@AngularWebWorker()
export class AppWorker implements OnWorkerInit {

    @Callable()
    doSomethingWithPerson(@ShallowTransfer() person: Person) {
        // ok
        person.birthday();
        // will throw error
        person.spouse.birthday();
    }

}
```
# Testing

The library provides a set of utilities for writing unit tests. The testing utilities essentially run the worker within the application's "thread" and mock the serialization behaviour that occurs when messages are sent to, or received from the worker. This ensures that your code will work as expected when running in a separate worker script. 

## Testing the Worker Class

When testing the worker class, all decorated methods and/or properties should be called/accessed through the `WorkerTestingClient` to mock the actual interaction with that class. A test client is an extension of the `WorkerClient` and exposes the underlying worker through an additional `workerInstance` property. This allows other functionality within the worker class to be tested/mocked directly.

*app.worker.spec.ts*
```typescript
import { createTestClient, WorkerTestingClient } from '@wbds/angular-web-worker/testing';
import { AppWorker } from './app.worker';

describe('AppWorker', () => {

    let client: WorkerTestingClient<AppWorker>;

    beforeEach(async () => {
        client = createTestClient(AppWorker);
        await client.connect();
    });

    it('Should call doSomethingElse', async () => {
        const spy = spyOn(client.workerInstance, 'doSomethingElse')
        await client.call(w => w.doSomething())
        expect(spy).toHaveBeenCalled();
    });

});

```

## The Worker Testing Module

When testing the usage of the injectable `WorkerManager` service within an Angular app, the `WorkerTestingModule` should be imported in place of the `WorkerModule`. Its usage is slightly different in that the path to the worker class is not provided in `WorkerTestingModule.forWorkers` as there is no need to generate separate worker scripts. The testing module will then return a  `WorkerTestingClient` when ever the `WorkerManager.createClient()` method is called

*app.component.spec.ts*
```typescript
import { WorkerTestingModule } from '@wbds/angular-web-worker/testing';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        WorkerTestingModule.forWorkers([AppWorker])
      ],
      declarations: [
        AppComponent,
      ],
    }).compileComponents();
  }));
});

```
