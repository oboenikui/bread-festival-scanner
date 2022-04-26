import "mirada";
import { Mat, Vector } from "mirada";

type MatParams = ConstructorParameters29<typeof Mat>

export function memScoped<T>(fn: (createMat: (...theArgs: MatParams) => Mat, registerVec: <T extends Vector<any>>(vec: T) => T) => T): T {

    const matCaches: Vector<any>[] = [];

    function createMat(...theArgs: MatParams) {
        const mat = new cv.Mat(...(theArgs as [m: Mat]));
        matCaches.push(mat);
        return mat;
    }

    function registerVec<T extends Vector<any>>(mat: T): T {
        matCaches.push(mat);
        return mat;
    }

    try {
        return fn.call(null, createMat, registerVec);
    } finally {
        for (const mat of matCaches) {
            mat.delete();
        }
    }
}

type ConstructorParameters29<T> =
    T extends {
        new(...args: infer A1): any; new(...args: infer A2): any;
        new(...args: infer A3): any; new(...args: infer A4): any;
        new(...args: infer A5): any; new(...args: infer A6): any;
        new(...args: infer A7): any; new(...args: infer A8): any;
        new(...args: infer A9): any; new(...args: infer A10): any;
        new(...args: infer A11): any; new(...args: infer A12): any;
        new(...args: infer A13): any; new(...args: infer A14): any;
        new(...args: infer A15): any; new(...args: infer A16): any;
        new(...args: infer A17): any; new(...args: infer A18): any;
        new(...args: infer A19): any; new(...args: infer A20): any;
        new(...args: infer A21): any; new(...args: infer A22): any;
        new(...args: infer A23): any; new(...args: infer A24): any;
        new(...args: infer A25): any; new(...args: infer A26): any;
        new(...args: infer A27): any; new(...args: infer A28): any;
        new(...args: infer A29): any;
    } ? A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10
    | A11 | A12 | A13 | A14 | A15 | A16 | A17 | A18 | A19 | A20
    | A21 | A22 | A23 | A24 | A25 | A26 | A27 | A28 | A29 : never;