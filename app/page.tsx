"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const NOTES = [
  { note: "C4", key: "A", black: false },
  { note: "C#4", key: "W", black: true },
  { note: "D4", key: "S", black: false },
  { note: "D#4", key: "E", black: true },
  { note: "E4", key: "D", black: false },
  { note: "F4", key: "F", black: false },
  { note: "F#4", key: "T", black: true },
  { note: "G4", key: "G", black: false },
  { note: "G#4", key: "Y", black: true },
  { note: "A4", key: "H", black: false },
  { note: "A#4", key: "U", black: true },
  { note: "B4", key: "J", black: false },
  { note: "C5", key: "K", black: false },
  { note: "C#5", key: "O", black: true },
  { note: "D5", key: "L", black: false },
  { note: "D#5", key: "P", black: true },
  { note: "E5", key: ";", black: false },
];

const FREQ: Record<string, number> = {
  C4: 261.63, "C#4": 277.18, D4: 293.66, "D#4": 311.13, E4: 329.63,
  F4: 349.23, "F#4": 369.99, G4: 392, "G#4": 415.3, A4: 440,
  "A#4": 466.16, B4: 493.88, C5: 523.25, "C#5": 554.37,
  D5: 587.33, "D#5": 622.25, E5: 659.25,
};

const FINGER_TIPS = [4, 8, 12, 16, 20];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const audioRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map());
  const gestureNotesRef = useRef<Set<string>>(new Set());
  const sustainRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [sustain, setSustain] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const volumeRef = useRef(volume);

  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { sustainRef.current = sustain; }, [sustain]);

  const getAudio = () => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  };

  const playNote = useCallback((note: string) => {
    if (voicesRef.current.has(note)) return;
    const audio = getAudio();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = FREQ[note];
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volumeRef.current * 0.3, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volumeRef.current * 0.13), now + 0.55);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    voicesRef.current.set(note, { osc, gain });
    setActiveNotes(new Set(voicesRef.current.keys()));
  }, []);

  const stopNote = useCallback((note: string, force = false) => {
    if (sustainRef.current && !force) return;
    const voice = voicesRef.current.get(note);
    if (!voice || !audioRef.current) return;
    const now = audioRef.current.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.08);
    voice.osc.stop(now + 0.5);
    voicesRef.current.delete(note);
    setActiveNotes(new Set(voicesRef.current.keys()));
  }, []);

  const toggleSustain = () => {
    const next = !sustainRef.current;
    setSustain(next);
    sustainRef.current = next;
    if (!next) {
      [...voicesRef.current.keys()].forEach((note) => {
        if (!gestureNotesRef.current.has(note)) stopNote(note, true);
      });
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space") { e.preventDefault(); toggleSustain(); return; }
      const match = NOTES.find((n) => n.key === e.key.toUpperCase());
      if (match) playNote(match.note);
    };
    const up = (e: KeyboardEvent) => {
      const match = NOTES.find((n) => n.key === e.key.toUpperCase());
      if (match) stopNote(match.note);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playNote, stopNote]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    handRef.current?.close();
    handRef.current = null;
    gestureNotesRef.current.forEach((n) => stopNote(n, true));
    gestureNotesRef.current.clear();
    setCameraOn(false);
    setStatus("Camera paused");
  }, [stopNote]);

  const startCamera = async () => {
    try {
      setStatus("Loading hand tracking…");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );
      handRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      setCameraOn(true);
      setStatus("Hands detected in real time");

      const detect = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const detector = handRef.current;
        if (!video || !canvas || !detector || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const result = detector.detectForVideo(video, performance.now());
        const nextNotes = new Set<string>();
        result.landmarks.forEach((hand) => {
          ctx.strokeStyle = "#a8ff3e";
          ctx.fillStyle = "#d9ff9d";
          ctx.lineWidth = 3;
          hand.forEach((point, i) => {
            const x = (1 - point.x) * canvas.width;
            const y = point.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, FINGER_TIPS.includes(i) ? 8 : 4, 0, Math.PI * 2);
            ctx.fill();
          });
          FINGER_TIPS.forEach((tipIndex) => {
            const tip = hand[tipIndex];
            const joint = hand[tipIndex === 4 ? 3 : tipIndex - 2];
            if (tip.y > joint.y + 0.018 && tip.y > 0.48) {
              const index = Math.min(NOTES.length - 1, Math.floor((1 - tip.x) * NOTES.length));
              nextNotes.add(NOTES[index].note);
            }
          });
        });
        nextNotes.forEach((n) => { if (!gestureNotesRef.current.has(n)) playNote(n); });
        gestureNotesRef.current.forEach((n) => { if (!nextNotes.has(n)) stopNote(n); });
        gestureNotesRef.current = nextNotes;
        rafRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      setStatus("Camera unavailable — keyboard mode is still ready");
      setCameraOn(false);
    }
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <main>
      <nav>
        <div className="brand"><span className="brand-mark">M</span> MotionKeys <span>LAB</span></div>
        <div className="nav-status"><i className={cameraOn ? "live" : ""} /> {status}</div>
        <button className="icon-button" aria-label="About MotionKeys">?</button>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span /> YOUR HANDS ARE THE INSTRUMENT</div>
        <h1>Play the air.<br /><em>Hear the motion.</em></h1>
        <p>Turn on your camera, hold your hands above the virtual keys, and tap the air. MediaPipe tracks every fingertip in real time.</p>
        <div className="hero-actions">
          <button className="primary" onClick={cameraOn ? stopCamera : startCamera}>
            <span>{cameraOn ? "■" : "●"}</span> {cameraOn ? "Stop camera" : "Start playing"}
          </button>
          <span className="privacy">Camera stays on your device</span>
        </div>
      </section>

      <section className="studio">
        <div className="camera-panel">
          <video ref={videoRef} muted playsInline />
          <canvas ref={canvasRef} />
          {!cameraOn && (
            <div className="camera-empty">
              <div className="hand-icon">✋</div>
              <strong>Raise your hands to begin</strong>
              <span>Allow camera access, then hover above the keys</span>
            </div>
          )}
          <div className="tracking-badge"><i className={cameraOn ? "live" : ""} /> {cameraOn ? "TRACKING 2 HANDS" : "CAMERA OFF"}</div>
          <div className="frame-corner tl" /><div className="frame-corner tr" />
          <div className="frame-corner bl" /><div className="frame-corner br" />
        </div>

        <div className="control-strip">
          <div><span className="control-label">INSTRUMENT</span><button className="select">Warm Triangle <b>⌄</b></button></div>
          <div className="volume"><span className="control-label">VOLUME</span><span>−</span><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /><span>+</span></div>
          <button className={`sustain ${sustain ? "on" : ""}`} onClick={toggleSustain}><i /> SUSTAIN <kbd>SPACE</kbd></button>
        </div>

        <div className="piano" aria-label="Virtual piano">
          {NOTES.map((item) => (
            <button
              key={item.note}
              className={`key ${item.black ? "black" : "white"} ${activeNotes.has(item.note) ? "active" : ""}`}
              onPointerDown={() => playNote(item.note)}
              onPointerUp={() => stopNote(item.note)}
              onPointerLeave={() => stopNote(item.note)}
              aria-label={`Play ${item.note}`}
            >
              <span className="key-shortcut">{item.key}</span>
              <span className="note-name">{item.note.replace(/[0-9]/, "")}</span>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <span><b>01</b> Allow camera</span><i />
        <span><b>02</b> Raise both hands</span><i />
        <span><b>03</b> Dip a fingertip to play</span>
        <small>Works best in a well-lit room</small>
      </footer>
    </main>
  );
}
