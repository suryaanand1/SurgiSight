"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { Camera, Play, Upload } from "./icons";
import { MAX_HANDS, TrackedHand, updateHandTracks } from "./hand-tracking";
import { addTrackingFrame, createMotionMetricState, finalizeMotionResults, MotionResults } from "./motion-metrics";
import { MotionResultsPanel } from "./motion-results";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

type SourceMode = "empty" | "upload" | "camera";
type TrackingState = "idle" | "loading" | "ready" | "tracking" | "lost" | "error";

function drawHands(canvas: HTMLCanvasElement, video: HTMLVideoElement, hands: TrackedHand[]) {
  if (!video.videoWidth || !video.videoHeight) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const colors = ["#48d7c7", "#ffb15c"];

  hands.forEach((hand) => {
    const { landmarks, visible } = hand;
    const color = colors[hand.id];
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(3, canvas.width / 260);
    context.strokeStyle = color;
    context.shadowColor = "rgba(0,0,0,.35)";
    context.shadowBlur = 4;
    HAND_CONNECTIONS.forEach(([start, end]) => {
      if (!visible[start] || !visible[end]) return;
      context.beginPath();
      context.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
      context.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
      context.stroke();
    });
    context.shadowBlur = 0;
    context.fillStyle = color;
    landmarks.forEach((point, index) => {
      if (!visible[index]) return;
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 190), 0, Math.PI * 2);
      context.fill();
    });
  });
}

export function VideoInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastSeenRef = useRef(0);
  const lastTwoHandsRef = useRef(0);
  const tracksRef = useRef<TrackedHand[]>([]);
  const metricsRef = useRef(createMotionMetricState());
  const cameraStartedAtRef = useRef(0);
  const modeRef = useRef<SourceMode>("empty");
  const [mode, setMode] = useState<SourceMode>("empty");
  const [fileName, setFileName] = useState("");
  const [trackingState, setTrackingState] = useState<TrackingState>("idle");
  const [message, setMessage] = useState("Upload a recording or use your camera to begin.");
  const [handCount, setHandCount] = useState(0);
  const [results, setResults] = useState<MotionResults | null>(null);

  const stopLoop = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const loadLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setTrackingState("loading");
    setMessage("Loading hand tracking…");
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: MAX_HANDS,
        minHandDetectionConfidence: 0.62,
        minHandPresenceConfidence: 0.58,
        minTrackingConfidence: 0.62,
      });
      landmarkerRef.current = landmarker;
      setTrackingState("ready");
      setMessage("Hand tracking ready.");
      return landmarker;
    } catch (error) {
      console.error("Unable to load MediaPipe Hand Landmarker", error);
      setTrackingState("error");
      setMessage("Hand tracking could not load. Check your connection and reload the page.");
      return null;
    }
  }, []);

  const trackFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) {
      animationRef.current = null;
      return;
    }
    const landmarker = landmarkerRef.current ?? await loadLandmarker();
    if (!landmarker) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const now = performance.now();
        const frame = updateHandTracks(tracksRef.current, result, now);
        tracksRef.current = frame.tracks;
        drawHands(canvas, video, frame.hands);
        addTrackingFrame(metricsRef.current, frame.hands, video.currentTime, video.videoWidth, video.videoHeight);
        const count = frame.detectedCount;
        setHandCount(count);
        if (count === 2 && frame.rejectedCount === 0) {
          lastSeenRef.current = now;
          lastTwoHandsRef.current = now;
          setTrackingState("tracking");
          setMessage("2 hands detected");
        } else if (count > 0 || frame.rememberedCount > 0 || frame.rejectedCount > 0) {
          if (count > 0) lastSeenRef.current = now;
          const recentlyHadTwoHands = now - lastTwoHandsRef.current < 650;
          if (recentlyHadTwoHands || frame.rejectedCount > 0 || now - lastSeenRef.current > 350) {
            setTrackingState("lost");
            setMessage("Hand tracking limited — keep both hands visible and reduce overlap.");
          } else {
            setTrackingState("tracking");
            setMessage("1 hand detected");
          }
        } else if (now - lastSeenRef.current > 900) {
          setTrackingState("lost");
          setMessage("Hands not visible. Keep both hands in frame with good lighting.");
        }
      } catch (error) {
        console.error("Hand tracking stopped", error);
        setTrackingState("error");
        setMessage("Hand tracking stopped unexpectedly. Try restarting the video or camera.");
        animationRef.current = null;
        return;
      }
    }
    animationRef.current = requestAnimationFrame(trackFrame);
  }, [loadLandmarker]);

  const beginTracking = useCallback(() => {
    stopLoop();
    lastVideoTimeRef.current = -1;
    lastSeenRef.current = performance.now();
    lastTwoHandsRef.current = 0;
    tracksRef.current = [];
    animationRef.current = requestAnimationFrame(trackFrame);
  }, [stopLoop, trackFrame]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => () => {
    stopLoop();
    stopCamera();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    landmarkerRef.current?.close();
  }, [stopCamera, stopLoop]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !videoRef.current) return;
    stopLoop();
    stopCamera();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setMode("upload");
    setResults(null);
    metricsRef.current = createMotionMetricState();
    setFileName(file.name);
    setHandCount(0);
    setTrackingState("loading");
    setMessage("Preparing video and hand tracking…");
    videoRef.current.srcObject = null;
    videoRef.current.src = objectUrlRef.current;
    videoRef.current.controls = true;
    videoRef.current.muted = false;
    videoRef.current.load();
    await loadLandmarker();
  }

  async function useCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setTrackingState("error");
      setMessage("Live camera is not supported in this browser. You can still upload a video.");
      return;
    }
    stopLoop();
    stopCamera();
    setMode("camera");
    setResults(null);
    metricsRef.current = createMotionMetricState();
    setFileName("");
    setHandCount(0);
    setTrackingState("loading");
    setMessage("Waiting for camera permission…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (modeRef.current === "camera") {
          stopLoop();
          setTrackingState("error");
          setMessage("Camera access ended. Select Use Camera to reconnect.");
        }
      });
      const video = videoRef.current;
      if (!video) return;
      video.removeAttribute("src");
      video.srcObject = stream;
      video.controls = false;
      video.muted = true;
      cameraStartedAtRef.current = performance.now();
      await Promise.all([video.play(), loadLandmarker()]);
      beginTracking();
    } catch (error) {
      console.error("Unable to start camera", error);
      setMode("empty");
      setTrackingState("error");
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setMessage(denied ? "Camera permission was denied. Allow camera access in your browser, or upload a video instead." : "The camera could not start. Check that it is connected and not being used by another app.");
    }
  }

  function finishUploadedVideo() {
    stopLoop();
    setTrackingState("ready");
    setMessage("Video finished.");
    const duration = videoRef.current?.duration;
    setResults(finalizeMotionResults(metricsRef.current, Number.isFinite(duration) ? duration ?? 0 : 0));
  }

  function finishCameraAnalysis() {
    const duration = cameraStartedAtRef.current > 0 ? (performance.now() - cameraStartedAtRef.current) / 1000 : 0;
    stopLoop();
    videoRef.current?.pause();
    stopCamera();
    setResults(finalizeMotionResults(metricsRef.current, duration));
    setTrackingState("ready");
    setMessage("Camera analysis finished.");
  }

  function resetAnalysis() {
    stopLoop();
    stopCamera();
    setResults(null);
    setMode("empty");
    setFileName("");
    setHandCount(0);
    setTrackingState("idle");
    setMessage("Upload a recording or use your camera to begin.");
    tracksRef.current = [];
    metricsRef.current = createMotionMetricState();
    cameraStartedAtRef.current = 0;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    if (videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
  }

  const statusColor = trackingState === "error" ? "bg-red-500" : trackingState === "lost" ? "bg-amber-400" : trackingState === "tracking" ? "bg-emerald-400" : "bg-slate-400";

  if (results) return <MotionResultsPanel results={results} onReset={resetAnalysis} />;

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_15rem]">
      <div className="relative grid min-h-[340px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-[#102a33] shadow-soft sm:min-h-[470px]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:40px_40px]" />
        <video
          ref={videoRef}
          className={`relative z-10 h-full max-h-[70vh] w-full object-contain ${mode === "empty" ? "hidden" : "block"}`}
          playsInline
          onPlay={beginTracking}
          onPause={stopLoop}
          onEnded={finishUploadedVideo}
        />
        <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 z-20 h-full w-full object-contain ${mode === "empty" ? "hidden" : "block"}`} aria-hidden="true" />
        {mode === "empty" && (
          <div className="relative z-10 max-w-sm p-6 text-center text-white">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10"><Play className="h-7 w-7" /></span>
            <h2 className="mt-5 text-lg font-semibold">Your video will appear here</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Upload a recording or use your camera to begin.</p>
          </div>
        )}
        {mode !== "empty" && (
          <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-[#081b22]/80 px-3 py-2 text-xs font-medium text-white backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} /> {message}
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-30 flex gap-2 text-[11px] font-semibold text-white">
          {handCount > 0 && <span className="rounded-full bg-[#081b22]/75 px-2.5 py-1.5 backdrop-blur">{handCount}/2 hands</span>}
          <span className="rounded-full bg-[#081b22]/75 px-2.5 py-1.5 backdrop-blur">On-device</span>
        </div>
      </div>

      <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 lg:p-5">
        <div><h2 className="font-semibold">Add a video</h2><p className="mt-1 text-xs leading-5 text-slate-500">Choose how you want to capture your practice.</p></div>
        <input ref={inputRef} className="sr-only" type="file" accept="video/*" onChange={handleFile} />
        <button type="button" onClick={() => inputRef.current?.click()} className="primary-button w-full"><Upload /> Upload Video</button>
        <button type="button" onClick={useCamera} className="secondary-button w-full"><Camera /> Use Camera</button>
        {mode === "camera" && trackingState !== "loading" && <button type="button" onClick={finishCameraAnalysis} className="primary-button w-full">Finish &amp; View Results</button>}
        {fileName && <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{fileName}</p>}
        {trackingState === "error" && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{message}</p>}
        <div className="mt-auto rounded-xl bg-mist/70 p-3 text-xs leading-5 text-slate-500"><span className="font-semibold text-ink">Good lighting helps.</span><br />Keep both hands fully visible and avoid glare.</div>
        <div className="flex items-center gap-3 px-1 text-[11px] text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#48d7c7]" /> Hand 1</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#ffb15c]" /> Hand 2</span></div>
      </aside>
    </div>
  );
}
