import { CV, FS, InputArray } from "mirada";

declare global {
    var cv2: CV & {
        FS: FS;
        [key: string]: any;
    }
}

declare class BFMatcher extends cv.BFMatcher {
    knnMatch(
        queryDescriptors: InputArray,
        trainDescriptors: InputArray,
        matches: cv.DMatchVectorVector,
        k: number,
        mask?: InputArray,
        compactResult?: boolean,
    )
    match(
        queryDescriptors: InputArray,
        trainDescriptors: InputArray,
        matches: cv.DMatchVector,
        mask?: InputArray,
    )
}

declare class DMatchVectorVector extends cv.DMatchVectorVector {
    size(): number;
}

declare class DMatchVector extends cv.DMatchVector {
    size(): number;
}

declare class KeyPointVector extends cv.KeyPointVector {
    size(): number;
}