import { useCallback, useEffect, useRef, useState } from "react";
import { detectStickers, initModel } from "../cv/detectSticker";
const DEBUG = true;

export const Debug: React.FC = () => {
    const inputCanvasRef = useRef<HTMLCanvasElement>(null);
    const [cvInit, setCvInit] = useState<boolean>(false);
    const [result, setResult] = useState<ReturnType<typeof detectStickers>>([]);

    const detect = (imgEl: HTMLImageElement) => {

        const canvasElement = inputCanvasRef.current;
        if (!canvasElement) return;

        canvasElement.width = 480;
        canvasElement.height = 640;

        const context = canvasElement.getContext("2d");
        context?.drawImage(imgEl, 0, 0, 480, 640);

        const img = cv.imread(canvasElement);
        const result = detectStickers(img, DEBUG);
        setResult(result);
        img.delete();
    }

    const imgRef = useCallback((element: HTMLImageElement | null) => {
        if (element && cvInit) {
            detect(element)
        }
    }, [cvInit]);


    useEffect(() => {
        if (cv && cv.Mat) {
            initModel().then(() => setCvInit(true));
        } else {
            cv.onRuntimeInitialized = () => {
                initModel().then(() => setCvInit(true))
            }
        }
    }, []);

    const resultCanvasRef = useCallback((node: HTMLCanvasElement) => {
        if (node !== null && inputCanvasRef.current) {
            node.width = inputCanvasRef.current.width;
            node.height = inputCanvasRef.current.height;
            const context = node.getContext("2d");
            context?.drawImage(inputCanvasRef.current, 0, 0);
        }
    }, []);

    return <div>
        <img src="testdata/(testimage)" ref={imgRef} alt="" width="480" height="640" />
        <canvas className="input-img" ref={inputCanvasRef} />
        <div className="debug">
            <canvas id="grayImage"></canvas>
            {Array.from(new Array(30)).map((_, i) => (<canvas key={i} id={`tmpImage${i}`}></canvas>))}
        </div>
        <canvas className="result" ref={resultCanvasRef} />
        <ul className="footer">
            {result.map((el, i) => <li key={i}>
                {`center: (${el.circle.x}, ${el.circle.y}) radius: ${el.circle.radius} ${el.point}点`}
            </li>)}
        </ul>

    </div >
}