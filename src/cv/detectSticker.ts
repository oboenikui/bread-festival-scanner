/* eslint-disable no-loop-func */
import "mirada";
import { Mat, Rect } from "mirada";
import { BFMatcher, DMatchVector, KeyPointVector } from "./miradaExt";
import { memScoped } from "./util";

const stickerImgPaths = {
    "0.5": "sticker_samples/0.5_color.png",
    "1": "sticker_samples/1_color.png",
    "1.5": "sticker_samples/1.5_color.png",
    "2": "sticker_samples/2_color.png",
    "2.5": "sticker_samples/2.5_color.png",
}

const STICKER_SAMPLE_WIDTH = 120;
const STICKER_SAMPLE_HEIGHT = 120;
const STICKER_SAMPLE_RADIUS = 50;
const BASE_BRIGHTNESS = 180;
const BASE_SATURATION = 127;

type Circle = {
    x: number,
    y: number,
    radius: number,
}

const stickerKeypoints: { [key: string]: { keypoints: KeyPointVector, descriptors: Mat } } = {};
const stickerImgs: { [key: string]: Mat } = {};

let detector: any;

let bf: BFMatcher;

export const overridableFunctions = {
    readImage: null as typeof readImage | null,
};

async function readImage(imgPath: string): Promise<Mat> {
    if (overridableFunctions.readImage) {
        return await overridableFunctions.readImage(imgPath);
    }
    const image = new Image();
    image.src = imgPath;
    return new Promise<Mat>((resolve) => {
        image.addEventListener("load", () => {
            resolve(cv.imread(image));
        })
    });
}

export async function initModel(): Promise<void> {
    global.cv2 = cv as typeof cv2;
    detector = new cv2.AKAZE();
    bf = new cv.BFMatcher(cv2.NORM_HAMMING, true) as BFMatcher;
    detector.setThreshold(0.00001);
    const promises: Promise<void>[] = [];
    for (const [imgAlias, imgPath] of Object.entries(stickerImgPaths)) {
        const p = readImage(imgPath)
            .then((img) => {
                memScoped((createMat) => {
                    const detectorMask = createMat();
                    // keypoints, descriptorsは保存するためコンストラクタを使用
                    const keypoints = new cv.KeyPointVector() as KeyPointVector;
                    const descriptors = new cv.Mat();
                    normalizePartialImage(img, 0.2);
                    detector.detectAndCompute(img, detectorMask, keypoints, descriptors, false);
                    stickerKeypoints[imgAlias] = { keypoints, descriptors }
                    stickerImgs[imgAlias] = img;
                })
            })
        promises.push(p);
    }
    await Promise.all(promises);
}

export function detectStickers(img: Mat, debug: boolean = false): { circle: Circle, point: number }[] {
    return memScoped((createMat, registerVec) => {

        const imgForDetectCircle = registerVec(img.clone());
        normalizeImage(imgForDetectCircle);
        const { circles, rect } = detectCircles(imgForDetectCircle, debug);

        const imgForDetectStickers = registerVec(rect ? img.roi(rect) : img.clone());
        const result = detectStickersFromCircle(imgForDetectStickers, circles, debug);
        return result.map(({ circle, point }) => ({
            point,
            circle: {
                x: circle.x + (rect?.x ?? 0),
                y: circle.y + (rect?.y ?? 0),
                radius: circle.radius,
            }
        }));
    })
}

function normalizeImage(img: Mat) {
    memScoped((createMat, registerVec) => {
        const hsv = createMat();
        cv.cvtColor(img, hsv, cv.COLOR_RGB2HSV);

        const splitSize = 10;
        const width = Math.floor(hsv.size().width / splitSize);
        const height = Math.floor(hsv.size().height / splitSize);
        const brightnessGrad = [];
        for (let y = 0; y < splitSize; y++) {
            for (let x = 0; x < splitSize; x++) {

                const splitted = registerVec(hsv.roi(new cv.Rect(
                    width * x,
                    height * y,
                    width,
                    height
                )));

                const mean = cv.mean(splitted);
                const saturation = mean[1];
                const brightness = mean[2];
                brightnessGrad.push(0, (BASE_SATURATION - saturation) * 0.75, (BASE_BRIGHTNESS - brightness) * 0.75);
            }
        }

        const b = registerVec(cv.matFromArray(splitSize, splitSize, cv.CV_32FC3, brightnessGrad));
        const grad = createMat();
        cv.resize(b, grad, new cv.Size(hsv.size().width, hsv.size().height));
        cv.add(hsv, grad, hsv, createMat(), cv.CV_8UC3);

        cv.cvtColor(hsv, img, cv.COLOR_HSV2RGB);
    })
}

function normalizePartialImage(img: Mat, k: number) {
    memScoped((createMat, registerVec) => {
        const hsv = createMat();
        cv.cvtColor(img, hsv, cv.COLOR_RGB2HSV);

        const mean = cv.mean(hsv);
        const saturation = mean[1];
        const brightness = mean[2];
        const diff = createMat(hsv.rows, hsv.cols, cv.CV_32FC3, [0, BASE_SATURATION - saturation, BASE_BRIGHTNESS - brightness, 0]);

        cv.add(hsv, diff, hsv, createMat(), cv.CV_8UC3);

        cv.cvtColor(hsv, img, cv.COLOR_HSV2RGB);

        // シャープフィルタ
        if (k !== 0) {
            cv.filter2D(img, img, -1, registerVec(cv.matFromArray(3, 3, cv.CV_32F, [-k, -k, -k, -k, 1 + 8 * k, -k, -k, -k, -k])))
        }
    })
}

function detectCircles(img: Mat, debug: boolean): { circles: Circle[], rect?: Rect } {
    return memScoped((createMat, registerVec) => {
        const hsv = createMat();
        cv.cvtColor(img, hsv, cv.COLOR_RGB2HSV);

        const mask1 = createMat();
        // const minRange1 = registerVec(cv.matFromArray(3, 1, cv.CV_64FC1, [0, 0, 0]));
        // const maxRange1 = registerVec(cv.matFromArray(3, 1, cv.CV_64FC1, [255, 255, 255]));
        // cv.inRange(hsv, minRange1, maxRange1, mask1);

        const proceeded = createMat();

        const tmp = createMat();
        cv.bitwise_not(img, tmp);
        cv.bitwise_and(tmp, tmp, proceeded, mask1);
        cv.cvtColor(proceeded, proceeded, cv.COLOR_RGB2GRAY, 0);
        cv.bitwise_not(proceeded, proceeded);
        const mul = createMat(proceeded.rows, proceeded.cols, cv.CV_8UC1, [1, 1, 1, 1]);
        cv.multiply(proceeded, mul, proceeded, 1.7, cv.CV_8UC1);
        cv.bitwise_not(proceeded, proceeded);
        cv.multiply(proceeded, mul, proceeded, 3, cv.CV_8UC1);
        cv.bitwise_not(proceeded, proceeded);

        const gray = proceeded;
        const circles = houghCircles(gray, debug);

        if (debug) {
            cv.cvtColor(gray, gray, cv.COLOR_GRAY2RGB, 0);
            const color = new cv.Scalar(0, 256, 0);
            for (const circle of circles) {
                cv.circle(gray, { x: circle.x, y: circle.y }, circle.radius, color);
            }
            cv.imshow("grayImage", gray);
        }

        return { circles };
    })
}

function houghCircles(gray: Mat, debug: boolean): Circle[] {
    return memScoped((createMat) => {
        const circlesMat = createMat();
        const minEdge = Math.min(gray.size().height, gray.size().width);
        cv.HoughCircles(
            gray, // image
            circlesMat, // circles
            cv2.HOUGH_GRADIENT_ALT, // method
            1.2, // dp
            minEdge / 30, // minDist
            200, // param1
            0.7, // param2
            minEdge / 30, // minRadius
            minEdge / 5, // maxRadius
        )

        const circles: Circle[] = [];

        for (let i = 0; i < circlesMat.rows; i++) {
            for (let j = 0; j < circlesMat.cols; j++) {
                const [x, y, radius] = circlesMat.floatPtr(i, j);
                circles.push({ x, y, radius });
            }
        }
        if (debug) {
            console.log("circles", circles);
        }
        if (circles.length === 0) {
            return [];
        }

        const [minRadius, maxRadius] = calculateRadiusRange(circles);
        if (debug) {
            console.log({ minRadius, maxRadius });
        }

        const resultMat = createMat();
        cv.HoughCircles(
            gray, // image
            resultMat, // circles
            cv2.HOUGH_GRADIENT, // method
            2, // dp
            minRadius / 1.5, // minDist
            200, // param1
            50, // param2
            minRadius, // minRadius
            maxRadius, // maxRadius
        );

        const results = []
        for (let i = 0; i < resultMat.rows; i++) {
            for (let j = 0; j < resultMat.cols; j++) {
                const [x, y, radius] = resultMat.floatPtr(i, j);
                results.push({ x, y, radius });
            }
        }
        if (debug) {
            console.log("results", results);
        }
        return results;
    });
}

function calculateRadiusRange(circles: Circle[]): [number, number] {
    let radiusSum = 0;
    for (const circle of circles) {
        radiusSum += circle.radius;
    }
    const average = radiusSum / circles.length;
    let powDiffSum = 0;
    for (const circle of circles) {
        const powOfDiff = (circle.radius - average) ** 2;
        powDiffSum += powOfDiff;
    }
    const standardDeviation = Math.sqrt(powDiffSum / circles.length);

    let closest = circles[0].radius;

    for (const circle of circles) {
        if (Math.abs(circle.radius - average) < Math.abs(closest - average)) {
            closest = circle.radius;
        }
    }
    const diff = Math.max(standardDeviation * 0.3, closest / 10);
    return [closest - diff, closest + diff]
}

function detectStickersFromCircle(img: Mat, circles: Circle[], debug: boolean): { circle: Circle, point: number }[] {
    const points = new Set();

    if (circles.length === 0) {
        return [];
    }

    const sortedCircles = circles.sort((a, b) => b.radius - a.radius);

    // 中央値
    const centerRadius = (
        sortedCircles[Math.floor((sortedCircles.length - 1) / 2)].radius +
        sortedCircles[Math.floor(sortedCircles.length / 2)].radius) / 2;
    const filteredCircles = sortedCircles.filter(({ x, y, radius }, i, array) => {

        // 中央値の1.2倍以上もしくは中央値の0.8倍以下の場合は除外
        const outlier = radius > centerRadius * 1.2 || radius < centerRadius * 0.8;
        // 同じ中心の円が複数検出されることがあるので小さい方を除外する
        if (!points.has(`${x},${y}`) && !outlier) {
            points.add(`${x},${y}`);
            return true;
        } else {
            return false;
        }
    });

    return memScoped((createMat, registerVec) => {
        const results: { circle: Circle, point: number }[] = [];
        let j = 0;
        for (const { x, y, radius } of filteredCircles) {
            if (img.size().width < x + radius || img.size().height < y + radius) {
                continue;
            }
            const fixedRadius = radius * STICKER_SAMPLE_WIDTH / (STICKER_SAMPLE_RADIUS * 2);
            const left = Math.max(x - fixedRadius, 0);
            const top = Math.max(y - fixedRadius, 0);
            const right = Math.min(img.size().width, left + fixedRadius * 2);
            const bottom = Math.min(img.size().height, top + fixedRadius * 2);
            const rect = new cv.Rect(
                left,
                top,
                right - left,
                bottom - top,
            );
            const circleImg = registerVec(img.roi(rect));

            const result = detectSticker(circleImg, j++, debug);
            if (result > 0) {
                results.push({ point: result, circle: { x, y, radius } });
            }
        }
        return results;
    })
}

function detectSticker(stickerImg: Mat, index: number, debug: boolean = false): number {
    if (Object.keys(stickerKeypoints).length === 0) {
        console.warn("Models are not initialized");
        return 0;
    }

    return memScoped((createMat, registerVec) => {

        const normalized = createMat();
        const originalSize = stickerImg.size();
        const newSize = new cv.Size(STICKER_SAMPLE_WIDTH, STICKER_SAMPLE_HEIGHT);
        cv.resize(stickerImg, normalized, newSize);

        const k = Math.max(STICKER_SAMPLE_WIDTH / originalSize.width, 0.5);
        normalizePartialImage(normalized, k);

        const detectorMask = createMat(), keypoints = registerVec(new cv.KeyPointVector()), descriptors = createMat();
        detector.detectAndCompute(normalized, detectorMask, keypoints, descriptors, false);

        if (descriptors.size().height <= 0 || descriptors.size().width <= 0) {
            return 0;
        }

        const mask = createMat();

        const scores: {
            matchDistances: number[],
            alias: string,
        }[] = [];

        for (const [alias, { descriptors: queryDescriptor }] of Object.entries(stickerKeypoints)) {
            const matches = registerVec(new cv.DMatchVector()) as DMatchVector;
            try {
                bf.match(queryDescriptor, descriptors, matches, mask);
            } catch (e) {
                throw e;
            }
            let matchDistances = [];
            let matchCount = 0;
            for (let i = 0; i < matches.size(); i++) {
                const m = matches.get(i);
                if (!m) {
                    continue;
                }
                matchDistances.push(m.distance);
                matchCount++;
            }
            if (matchCount > 0) {
                matchDistances.sort((a, b) => a - b);
                scores.push({ alias, matchDistances });
            }
        }
        if (scores.length) {
            const matchedAlias = scores.reduce((prev, current) => {
                const count = Math.min(prev.matchDistances.length, current.matchDistances.length)
                return score(prev.matchDistances, count) > score(current.matchDistances, count) ? prev : current;
            });

            // scoreが0.8未満は一致度が低いのでスコアには含めない
            if (score(matchedAlias.matchDistances, matchedAlias.matchDistances.length) < 0.8) {
                return 0;
            }

            if (debug) {
                try {
                    const matches = registerVec(new cv.DMatchVector()) as DMatchVector;
                    bf.match(stickerKeypoints[matchedAlias.alias].descriptors, descriptors, matches, mask);

                    const matchingImage = createMat(), mc = new cv.Scalar(-1, -1, -1, -1), sc = new cv.Scalar(0, 255, 0, 0);
                    cv.drawMatches(stickerImgs[matchedAlias.alias], stickerKeypoints[matchedAlias.alias].keypoints, normalized, keypoints, matches, matchingImage, mc, sc);
                    cv.imshow("tmpImage" + index, matchingImage);
                } catch (e) {
                    console.error(e);
                }
            }

            return parseFloat(matchedAlias.alias);
        }

        return 0;
    });
}

function score(matchDistances: number[], count: number): number {
    const sumDistance = matchDistances.slice(0, count)
        .reduce((sum, cur) => cur + sum, 0)
    return 100 / (sumDistance / count);
}