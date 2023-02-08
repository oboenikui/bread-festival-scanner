import { detectStickers, initModel, overridableFunctions } from "./detectSticker";
import "mirada";
import Jimp from "jimp";
import { testdata } from "../../testdata/testdata";
import assert from "assert";

const window = global as { [key: string]: any };
window.Module = {};

const testDataDir = `${__dirname}/../../testdata`;

overridableFunctions.readImage = async (imgPath) => {

    const imgSrc = await Jimp.read(`${__dirname}/../../public/${imgPath}`);
    return cv.matFromImageData(imgSrc.bitmap);
}

function grouping(result: number[]) {
    const grouped: { [key: string]: number } = {
        "0.5": 0,
        "1": 0,
        "1.5": 0,
        "2": 0,
        "2.5": 0,
        "0": 0,
    };
    for (const f of result) {
        grouped[f.toString()] = (grouped[f.toString()] ?? 0) + 1;
    }
    if (grouped["0"] !== 0) {
        console.warn(`contains ${grouped["0"]} detect error(s)`);
    }
    delete grouped["0"];
    return grouped;
}

async function initOpenCv() {
    return new Promise<void>((resolve) => {
        window.Module.onRuntimeInitialized = () => {
            resolve();
        }
        window.cv = require("../../public/opencv");
    })
}

jest.setTimeout(100000)
test('detectSticker test', async () => {
    console.log("waiting initialize opencv...")

    await initOpenCv();
    console.log("waiting initialize models...")

    await initModel();
    console.log("test start...")

    for (const [fileName, pointInfo] of Object.entries(testdata)) {
        const imgSrc = await Jimp.read(`${testDataDir}/${fileName}`);
        const img = cv.matFromImageData(imgSrc.bitmap);

        try {
            console.log(fileName);
            const result = detectStickers(img);
            const grouped = grouping(result.map(el => el.point));
            assert.deepEqual(grouped, pointInfo);
        } finally {
            img.delete();
        }
    }
});
