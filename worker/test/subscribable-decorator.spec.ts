import { WorkerAnnotations, SubscribableMetaData } from '../../common/src/public-api';
import { Subscribable } from '../src/public-api';
import { Subject } from 'rxjs';

class TestClass {
    @Subscribable()
    public event: Subject<any>;
}

describe('@Subscribable(): [angular-web-worker]', () => {

        it('Should attach metadata to the class prototype', () => {
            expect(TestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Observables].length).toEqual(1);
        });

        it('Should attach metadata with the property name', () => {
            expect((TestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Observables][0] as SubscribableMetaData).name).toEqual('event');
        });

        it('Should attach metadata with the design type', () => {
            expect((TestClass[WorkerAnnotations.Annotation][WorkerAnnotations.Observables][0] as SubscribableMetaData).type).toEqual(Subject);
        });

});
