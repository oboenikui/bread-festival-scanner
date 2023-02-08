import classNames from "classnames";
import { ChangeEvent, CSSProperties, HTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam"
import { detectStickers, initModel } from "../cv/detectSticker";
import { AppButton } from "./AppButton";
import "./Scanner.scss";


const DEFAULT_VIDEO_WIDTH = 480;
const DEFAULT_VIDEO_HEIGHT = 640;

const CONSECUTIVE_TIMES_THRESHOLD = 3;
const DEBUG = false;

const useAnimationFrame = (callback = () => { }) => {
    const reqIdRef = useRef<number>();
    const loop = useCallback(() => {
        reqIdRef.current = requestAnimationFrame(loop);
        callback();
    }, [callback]);

    useEffect(() => {
        reqIdRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(reqIdRef.current ?? 0);
    }, [loop]);
};

const orientationQuery = window.matchMedia && window.matchMedia("(orientation: portrait)");
function videoConstrains(prop: { deviceId?: string } = {}): MediaStreamConstraints["video"] {
    const isPortrait = window.screen.orientation?.type?.includes("portrait") ?? orientationQuery.matches;
    return {
        aspectRatio: isPortrait ? 4 / 3 : 3 / 4,
        width: isPortrait ? DEFAULT_VIDEO_HEIGHT : DEFAULT_VIDEO_WIDTH,
        height: isPortrait ? DEFAULT_VIDEO_WIDTH : DEFAULT_VIDEO_HEIGHT,
        facingMode: "environment",
        ...prop,
    };
}

export const Scanner: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const inputCanvasRef = useRef<HTMLCanvasElement>(null);
    const [videoDeviceInfo, setVideoDeviceInfo] = useState<MediaDeviceInfo[]>();
    const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(localStorage.getItem("currentDeviceId") || undefined);
    const [videoConstraints, setVideoConstrains] = useState<MediaStreamConstraints["video"]>(videoConstrains());
    const [consecutiveTimes, setConsecutiveTimes] = useState<number[]>([]);
    const [showResult, setShowResult] = useState(false);
    const [result, setResult] = useState<ReturnType<typeof detectStickers>>([]);
    const [resultShadowStyles, setResultShadowStyles] = useState<CSSProperties[]>([]);
    const [resultBadgeStyles, setResultBadgeStyles] = useState<CSSProperties[]>([]);

    useEffect(() => {
        const configure = () => {
            setVideoConstrains(videoConstrains({
                deviceId: currentDeviceId
            }));
        }
        configure();
        orientationQuery.addEventListener("change", configure);
        return () => orientationQuery.removeEventListener("change", configure);
    }, [currentDeviceId]);
    const onChangeDevice = (ev: ChangeEvent<HTMLSelectElement>) => {
        localStorage.setItem("currentDeviceId", ev.target.value);
        setCurrentDeviceId(ev.target.value);
    }

    const detect = useCallback(() => {
        if (showResult || !window.cv) {
            return;
        }

        const webcam = webcamRef.current;
        if (!webcam || !webcam.video ||
            webcam.video.videoWidth === 0 || webcam.video.videoHeight === 0) return;

        const canvasElement = inputCanvasRef.current;
        if (!canvasElement) return;

        canvasElement.width = webcam.video.videoWidth;
        canvasElement.height = webcam.video.videoHeight;

        const context = canvasElement.getContext("2d");
        context?.drawImage(webcam.video, 0, 0);

        const img = cv.imread(canvasElement);
        const result = detectStickers(img, DEBUG);

        img.delete();
        const nextSum = result.reduce((acc, next) => acc + next.point, 0);
        if (nextSum !== 0) {

            if (consecutiveTimes.length + 1 > CONSECUTIVE_TIMES_THRESHOLD) {
                const counter: Record<number, number> = {}
                for (const s of [...consecutiveTimes, nextSum]) {
                    counter[s] = (counter[s] ?? 0) + 1;
                }
                let maxCountAndSum = [0, 0]
                for (const [s, count] of Object.entries(counter)) {
                    if (maxCountAndSum[1] < count) {
                        maxCountAndSum = [parseFloat(s), count];
                    }
                }
                if (maxCountAndSum[1] < CONSECUTIVE_TIMES_THRESHOLD || maxCountAndSum[0] !== nextSum) {
                    if (consecutiveTimes.length >= 10) {
                        setConsecutiveTimes(pre => [...pre.slice(pre.length - 9), nextSum]);
                    } else {
                        setConsecutiveTimes(pre => [...pre, nextSum]);
                    }
                    return;
                }

                setShowResult(true);
                setResult(result);

                const imageWidth = canvasElement.width;
                const imageHeight = canvasElement.height;
                setResultShadowStyles(result.map(sticker => ({
                    left: `${(sticker.circle.x - sticker.circle.radius) / imageWidth * 100}%`,
                    top: `${(sticker.circle.y - sticker.circle.radius) / imageHeight * 100}%`,
                    width: `${(sticker.circle.radius * 2) / imageWidth * 100}%`,
                    height: `${(sticker.circle.radius * 2) / imageHeight * 100}%`,
                })));

                setResultBadgeStyles(result.map(sticker => ({
                    left: `${sticker.circle.x / imageWidth * 100}%`,
                    top: `${(sticker.circle.y - sticker.circle.radius) / imageHeight * 100}%`,
                })));

                setConsecutiveTimes([]);
            } else {
                setConsecutiveTimes(pre => [...pre, nextSum]);
            }
        } else {
            setConsecutiveTimes([]);
        }

    }, [consecutiveTimes, showResult]);
    useAnimationFrame(detect);

    const setupCv = () => {
        if (window.cv && cv.Mat) {
            initModel();
        } else if (window.cv) {
            window.cv.onRuntimeInitialized = () => {
                initModel();
            }
        } else {
            setTimeout(setupCv, 500)
        }
    }

    useEffect(() => {
        setupCv();
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
        {DEBUG && (<div className="debug">
            <canvas id="grayImage"></canvas>
            {Array.from(new Array(30)).map((_, i) => (<canvas key={i} id={`tmpImage${i}`}></canvas>))}
        </div>)}
        <div className="webcam-container" style={{ top: DEBUG ? "90vh" : undefined }}>
            {
                useMemo(() => !showResult && <Webcam
                    ref={webcamRef}
                    className="webcam"
                    videoConstraints={videoConstraints}
                    onUserMedia={() => navigator.mediaDevices.enumerateDevices().then(deviceInfo => {
                        setVideoDeviceInfo(deviceInfo.filter(info => info.kind === "videoinput"));
                        if (!currentDeviceId) {
                            setCurrentDeviceId(currentDeviceId ?? deviceInfo.filter(info => info.kind === "videoinput")[0]?.deviceId);
                        }
                    })}
                />, [videoConstraints, showResult, currentDeviceId])
            }
        </div>
        <div className="shadow-wrapper">
            <div className="shadow"></div>
            <div className="exclude-mask-wrapper">
                {
                    !showResult
                        ? <div className="exclude-mask"></div>
                        : resultShadowStyles.map((style, i) =>
                            <i key={i}
                                className="sticker-exclude-mask"
                                style={style} />)
                }
            </div>
        </div>
        <div className={classNames("guides", { showResult })}>

            <Guide className="guide guide-left-top" />
            <Guide className="guide guide-right-top" />
            <Guide className="guide guide-left-bottom" />
            <Guide className="guide guide-right-bottom" />

            <div className="camera-control">
                <select onChange={onChangeDevice} value={currentDeviceId}>
                    {videoDeviceInfo && videoDeviceInfo.map(info => <option key={info.deviceId} value={info.deviceId}>{info.label}</option>)}
                </select>
            </div>
        </div>
        {showResult && <div className="result-container">
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