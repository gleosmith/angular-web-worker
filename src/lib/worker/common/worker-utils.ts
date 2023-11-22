import { WorkerAnnotations, WorkerConfig } from './annotations';

/**
 * A set of static utility functions for creating and retrieving worker annotations
 */
export class WorkerUtils {

    /**
     * Creates or replaces a worker annotation
     * @param cls Class or object that the annotations will be attached to
     * @param propertyKey name of the annotated property
     * @param value the value of the annotation
     */
    static setAnnotation(cls: any, propertyKey: string, value: any): void {
        if (cls.hasOwnProperty(WorkerAnnotations.Annotation)) {
            cls[WorkerAnnotations.Annotation][propertyKey] = value;
        } else {
            Object.defineProperty(cls, WorkerAnnotations.Annotation, {
                value: {}
            });
            WorkerUtils.setAnnotation(cls, propertyKey, value);
        }
    }


    /**
     * Adds an item to an array for a particular annotation property. If no array exists a new array will be created before the item is added
     * @param cls Class or object that the annotations will be attached to
     * @param propertyKey name of the annotated array
     * @param value the item to add in the array
     */
    static pushAnnotation(cls: any, propertyKey: string, value: any): void {
        if (cls.hasOwnProperty(WorkerAnnotations.Annotation)) {
            if (cls[WorkerAnnotations.Annotation].hasOwnProperty(propertyKey)) {
                cls[WorkerAnnotations.Annotation][propertyKey].push(value);
            } else {
                cls[WorkerAnnotations.Annotation][propertyKey] = [];
                cls[WorkerAnnotations.Annotation][propertyKey].push(value);
            }
        } else {
            Object.defineProperty(cls, WorkerAnnotations.Annotation, {
                value: {}
            });
            WorkerUtils.pushAnnotation(cls, propertyKey, value);
        }
    }

    /**
     * Returns an annotated worker property. Allows for a generic type argument to specify the return type of the annotation
     * @param cls Class or object that the annotations is attached to
     * @param propertyKey name of the annotated array
     * @param ifUndefined the returned value if the annotated property does not exist
     */
    static getAnnotation<T>(cls: any, propertyKey: string, ifUndefined = null): T {
        if (cls.hasOwnProperty(WorkerAnnotations.Annotation)) {
            return cls[WorkerAnnotations.Annotation][propertyKey];
        } else {
            return ifUndefined;
        }
    }

}

