import { WorkerUtils } from 'angular-web-worker/common';
import { WorkerAnnotations } from 'angular-web-worker/common';

class TestClass {
    constructor() {
    }
}

describe('WorkerUtils: [angular-web-worker/common]', () => {

        let cls: TestClass;
        const annotationProperty = 'testProperty';

        beforeEach(() => {
            cls = new TestClass();
        });

        it('Should set annotations', () => {
            WorkerUtils.setAnnotation(cls, annotationProperty, 10);
            expect(cls[WorkerAnnotations.Annotation][annotationProperty]).toEqual(10);
        });

        it('Should add an item to an annotation array', () => {
            WorkerUtils.pushAnnotation(cls, annotationProperty, 'value 1');
            expect(cls[WorkerAnnotations.Annotation][annotationProperty].length).toEqual(1);
            WorkerUtils.pushAnnotation(cls, annotationProperty, 'value 2');
            expect(cls[WorkerAnnotations.Annotation][annotationProperty].length).toEqual(2);
        });

        it('Should get annotations', () => {
            const annotationValue = {
                property: 'value'
            };
            cls[WorkerAnnotations.Annotation] = {};
            cls[WorkerAnnotations.Annotation][annotationProperty] = annotationValue;
            expect(WorkerUtils.getAnnotation(cls, annotationProperty)).toEqual(annotationValue);
        });

        it('Should return the correct value if no annotation exists', () => {
            const undefinedValue = [];
            expect(WorkerUtils.getAnnotation(cls, annotationProperty)).toEqual(null);
            expect(WorkerUtils.getAnnotation(cls, annotationProperty, undefinedValue)).toEqual(undefinedValue);
        });

});
