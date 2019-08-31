import { Accessable } from '../src/public-api';
import { WorkerAnnotations, AccessableMetaData } from '../../common/src/public-api';

class TestClassWithoutOptions {
    @Accessable()
    public property: string;
}

class TestClassWithOptions {
    @Accessable({
        get: false,
        set: false,
        shallowTransfer: true
    })
    public property: string;
    public property2: string;
    constructor() { }
}


describe('@Accessable(): [angular-web-worker]', () => {

    it('Should attach metadata to the class prototype', () => {
        expect(TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables].length).toEqual(1);
    });

    it('Should attach metadata with the property name', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).name).toEqual('property');
    });

    it('Should attach metadata with the design type', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).type).toEqual(String);
    });

    it('Should attach metadata with the default options', () => {
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).get).toEqual(true);
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).set).toEqual(true);
        expect((TestClassWithoutOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).shallowTransfer).toEqual(false);
    });

    it('Should attach metadata with the provided options', () => {
        expect((TestClassWithOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).get).toEqual(false);
        expect((TestClassWithOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).set).toEqual(false);
        expect((TestClassWithOptions[WorkerAnnotations.Annotation][WorkerAnnotations.Accessables][0] as AccessableMetaData).shallowTransfer).toEqual(true);
    });

});
