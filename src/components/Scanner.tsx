import classNames from "classnames";
import { CSSProperties, HTMLAttributes, useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam"
import { detectStickers, initModel } from "../cv/detectSticker";
import { AppButton } from "./AppButton";


const DEFAULT_VIDEO_WIDTH = 480;
const DEFAULT_VIDEO_HEIGHT = 640;
const DEFAULT_VIDEO_CONSTRAINS: MediaStreamConstraints["video"] = {
    aspectRatio: 3 / 4,
    width: DEFAULT_VIDEO_WIDTH,
    height: DEFAULT_VIDEO_HEIGHT,
}

const CONSECUTIVE_TIMES_THRESHOLD = 3;

const useAnimationFrame = (callback = () => { }) => {
    const reqIdRef = useRef<number>();
    const loop = useCallback(() => {
        reqIdRef.current = requestAnimationFrame(loop);
        callback();
    }, [callback]);

    useEffect(() => {
        reqIdRef.current = requestAnimationFrame(loop);
        return () => { reqIdRef.current && cancelAnimationFrame(reqIdRef.current); }
    }, [loop]);
};

export const Scanner: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const inputCanvasRef = useRef<HTMLCanvasElement>(null);
    const [videoConstraints, setVideoConstrains] = useState<MediaStreamConstraints["video"]>(DEFAULT_VIDEO_CONSTRAINS);
    const [sum, setSum] = useState(0);
    const [consecutiveTimes, setConsecutiveTimes] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [result, setResult] = useState<ReturnType<typeof detectStickers>>([]);
    const [resultShadowStyles, setResultShadowStyles] = useState<CSSProperties[]>([]);
    const [resultBadgeStyles, setResultBadgeStyles] = useState<CSSProperties[]>([]);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                if (devices.filter(device => device.kind === "videoinput").length > 1) {
                    setVideoConstrains(v => Object.assign({}, v, {
                        facingMode: { exact: "environment" },
                    }));
                }
            })

    }, []);

    useEffect(() => {

        const configure = () => {
            const isPortrait = window.screen.orientation.type.includes("portrait")
            setVideoConstrains(v => Object.assign({}, v, {
                aspectRatio: 3 / 4,
                width: isPortrait ? DEFAULT_VIDEO_HEIGHT : DEFAULT_VIDEO_WIDTH,
                height: isPortrait ? DEFAULT_VIDEO_WIDTH : DEFAULT_VIDEO_HEIGHT,
            }));
        }
        configure();
        window.screen.orientation.addEventListener("change", configure);
        return () => window.screen.orientation.removeEventListener("change", configure);
    }, []);

    const detect = () => {
        if (showResult) {
            return;
        }

        const webcam = webcamRef.current;
        if (!webcam || !webcam.video) return;

        const imageSrc = webcam.getCanvas({
            width: webcam.video.videoWidth,
            height: webcam.video.videoHeight,
        });
        if (!imageSrc) return;
        const canvasElement = inputCanvasRef.current;
        if (!canvasElement) return;

        canvasElement.width = webcam.video.videoWidth;
        canvasElement.height = webcam.video.videoHeight;

        const context = canvasElement.getContext("2d");
        context?.drawImage(imageSrc, 0, 0);

        // try {
        const img = cv.imread(canvasElement);
        const result = detectStickers(img);

        const nextSum = result.reduce((acc, next) => acc + next.point, 0);
        if (nextSum !== 0 && sum === nextSum) {
            setConsecutiveTimes(pre => pre + 1);

            if (consecutiveTimes + 1 >= CONSECUTIVE_TIMES_THRESHOLD) {
                setShowResult(() => true);
                setResult(() => result);

                const imageWidth = canvasElement.width;
                const imageHeight = canvasElement.height;
                setResultShadowStyles(() =>
                    result.map(sticker => ({
                        left: `${(sticker.circle.x - sticker.circle.radius) / imageWidth * 100}%`,
                        top: `${(sticker.circle.y - sticker.circle.radius) / imageHeight * 100}%`,
                        width: `${(sticker.circle.radius * 2) / imageWidth * 100}%`,
                        height: `${(sticker.circle.radius * 2) / imageHeight * 100}%`,
                    })));

                setResultBadgeStyles(() =>
                    result.map(sticker => ({
                        left: `${sticker.circle.x / imageWidth * 100}%`,
                        top: `${(sticker.circle.y - sticker.circle.radius) / imageHeight * 100}%`,
                    })));
            }
        } else {
            setConsecutiveTimes(() => 0);
        }
        setSum(() => nextSum);


        img.delete();

        // } catch (error) {
        //     console.log(error);
        // }
    }
    useAnimationFrame(detect);

    useEffect(() => {

        if (cv && cv.Mat) {
            initModel();
        } else {
            cv.onRuntimeInitialized = () => {
                initModel();
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

    const resultSum = result.reduce((acc, sticker) => acc + sticker.point, 0);
    return <div className="Scanner">
        <div className="webcam-container">
            {
                !showResult && <Webcam
                    ref={webcamRef}
                    audio={false}
                    className="webcam"
                    videoConstraints={videoConstraints}
                />
            }
        </div>
        <div className={classNames("guides", { showResult })}>
            <div className="shadow shadow-left"></div>
            <div className="shadow shadow-right"></div>
            <div className="shadow shadow-top"></div>
            <div className="shadow shadow-bottom"></div>

            <Guide className="guide guide-left-top" />
            <Guide className="guide guide-right-top" />
            <Guide className="guide guide-left-bottom" />
            <Guide className="guide guide-right-bottom" />
        </div>
        {showResult && <div className="result-container">
            <div className="shadow" />
            {
                resultShadowStyles.map((style, i) =>
                    <i key={i}
                        className="sticker-highlight"
                        style={style} />)
            }
            {
                result.map((sticker, i) =>
                    <span key={i}
                        className="point-badge"
                        style={resultBadgeStyles[i]} >
                        {sticker.point}
                    </span>
                )
            }
            <canvas className="result" ref={resultCanvasRef} />
        </div>}
        <canvas className="input-img" ref={inputCanvasRef} />

        {
            showResult && <div className="footer">
                <div className="sum-card">
                    <div className="sum">計: {resultSum}点</div>
                    <p>スキャン結果は参考値です。</p>
                    <p>交換の際は必ず各点数をご確認ください。</p>
                </div>

                <AppButton onClick={() => setShowResult(false)}>再スキャン</AppButton>
            </div>
        }
    </div >
}

const Guide: React.FC<HTMLAttributes<HTMLOrSVGElement>> = (params) =>
    <svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" {...params}>
        <path d="M4 54V4H54" stroke="white" strokeOpacity="0.8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>