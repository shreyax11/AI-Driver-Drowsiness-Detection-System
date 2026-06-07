from __future__ import annotations

import asyncio
import json
import math
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Deque, Generator, Optional

import numpy as np
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

try:
    import cv2
except Exception:  # pragma: no cover - optional runtime dependency
    cv2 = None

try:
    import mediapipe as mp
except Exception:  # pragma: no cover - optional runtime dependency
    mp = None


EYE_LEFT = [33, 160, 158, 133, 153, 144]
EYE_RIGHT = [362, 385, 387, 263, 373, 380]
MOUTH = [13, 14, 78, 308]


@dataclass
class Alert:
    level: str
    title: str
    message: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class DriverMetrics:
    risk_score: int = 14
    state: str = "attentive"
    ear: float = 0.29
    mar: float = 0.18
    blink_rate: int = 12
    yawn_count: int = 0
    head_tilt: float = 0.0
    attention: int = 96
    fps: float = 0.0
    alerts_today: int = 0
    trip_minutes: int = 0
    source: str = "simulated"
    alert_level: str = "normal"


class DrowsinessMonitor:
    def __init__(self) -> None:
        self.metrics = DriverMetrics()
        self.alerts: Deque[Alert] = deque(maxlen=80)
        self._blink_window: Deque[float] = deque(maxlen=60)
        self._eye_closed_since: Optional[float] = None
        self._last_yawn_at = 0.0
        self._start_time = time.time()
        self._last_frame_time = time.time()
        self._frame_index = 0

        self.face_mesh = None
        if mp is not None:
            self.face_mesh = mp.solutions.face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

    def snapshot(self) -> dict:
        payload = asdict(self.metrics)
        payload["alerts"] = [asdict(alert) for alert in list(self.alerts)[-8:]][::-1]
        return payload

    def synthetic_tick(self) -> dict:
        self._frame_index += 1
        t = self._frame_index / 12
        pulse = (math.sin(t / 2.5) + 1) / 2
        micro_sleep = 1 if 18 < (t % 34) < 23 else 0
        yawn = 1 if 9 < (t % 51) < 13 else 0

        ear = max(0.12, 0.31 - micro_sleep * 0.12 - pulse * 0.025)
        mar = 0.18 + yawn * 0.32 + pulse * 0.04
        attention = int(96 - micro_sleep * 27 - yawn * 9 - pulse * 7)
        head_tilt = round(math.sin(t / 3.2) * 9 + micro_sleep * 8, 1)
        risk = int(max(5, min(96, 18 + micro_sleep * 58 + yawn * 22 + pulse * 15)))

        self.metrics = DriverMetrics(
            risk_score=risk,
            state=self._state_for(risk),
            ear=round(ear, 3),
            mar=round(mar, 3),
            blink_rate=int(12 + pulse * 8 + micro_sleep * 10),
            yawn_count=self.metrics.yawn_count + (1 if yawn and self._frame_index % 44 == 0 else 0),
            head_tilt=head_tilt,
            attention=attention,
            fps=24.0,
            alerts_today=len(self.alerts),
            trip_minutes=int((time.time() - self._start_time) / 60),
            source="simulated",
            alert_level=self._level_for(risk),
        )
        self._maybe_alert(risk, self.metrics.state)
        return self.snapshot()

    def process_frame(self, frame: np.ndarray) -> tuple[np.ndarray, dict]:
        if cv2 is None or self.face_mesh is None:
            return self._draw_simulated_frame(frame), self.synthetic_tick()

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.face_mesh.process(rgb)
        now = time.time()
        fps = 1 / max(now - self._last_frame_time, 0.001)
        self._last_frame_time = now

        if not result.multi_face_landmarks:
            self.metrics.attention = max(0, self.metrics.attention - 4)
            self.metrics.risk_score = min(100, self.metrics.risk_score + 6)
            self.metrics.state = "face not detected"
            self.metrics.source = "webcam"
            self.metrics.fps = round(fps, 1)
            self._maybe_alert(self.metrics.risk_score, "Driver face not detected")
            return self._overlay(frame), self.snapshot()

        landmarks = result.multi_face_landmarks[0].landmark
        h, w = frame.shape[:2]
        points = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]

        left_ear = self._eye_aspect_ratio(points, EYE_LEFT)
        right_ear = self._eye_aspect_ratio(points, EYE_RIGHT)
        ear = (left_ear + right_ear) / 2
        mar = self._mouth_aspect_ratio(points)
        head_tilt = self._head_tilt(points)
        risk = self._risk_score(ear, mar, head_tilt)

        if ear < 0.21:
            if self._eye_closed_since is None:
                self._eye_closed_since = now
            if now - self._eye_closed_since > 0.25:
                self._blink_window.append(now)
        else:
            self._eye_closed_since = None

        if mar > 0.58 and now - self._last_yawn_at > 2.2:
            self.metrics.yawn_count += 1
            self._last_yawn_at = now

        minute_ago = now - 60
        while self._blink_window and self._blink_window[0] < minute_ago:
            self._blink_window.popleft()

        for idx in EYE_LEFT + EYE_RIGHT + MOUTH:
            cv2.circle(frame, points[idx], 2, (42, 245, 255), -1)

        self.metrics = DriverMetrics(
            risk_score=risk,
            state=self._state_for(risk),
            ear=round(ear, 3),
            mar=round(mar, 3),
            blink_rate=len(self._blink_window),
            yawn_count=self.metrics.yawn_count,
            head_tilt=round(head_tilt, 1),
            attention=max(0, min(100, 100 - risk + 12)),
            fps=round(fps, 1),
            alerts_today=len(self.alerts),
            trip_minutes=int((time.time() - self._start_time) / 60),
            source="webcam",
            alert_level=self._level_for(risk),
        )
        self._maybe_alert(risk, self.metrics.state)
        return self._overlay(frame), self.snapshot()

    def _eye_aspect_ratio(self, points: list[tuple[int, int]], ids: list[int]) -> float:
        p = [np.array(points[i]) for i in ids]
        vertical = np.linalg.norm(p[1] - p[5]) + np.linalg.norm(p[2] - p[4])
        horizontal = 2 * np.linalg.norm(p[0] - p[3])
        return float(vertical / horizontal) if horizontal else 0.0

    def _mouth_aspect_ratio(self, points: list[tuple[int, int]]) -> float:
        top, bottom, left, right = [np.array(points[i]) for i in MOUTH]
        width = np.linalg.norm(left - right)
        return float(np.linalg.norm(top - bottom) / width) if width else 0.0

    def _head_tilt(self, points: list[tuple[int, int]]) -> float:
        left_eye = np.mean([points[i] for i in EYE_LEFT], axis=0)
        right_eye = np.mean([points[i] for i in EYE_RIGHT], axis=0)
        radians = math.atan2(right_eye[1] - left_eye[1], right_eye[0] - left_eye[0])
        return math.degrees(radians)

    def _risk_score(self, ear: float, mar: float, head_tilt: float) -> int:
        score = 10
        score += max(0, int((0.25 - ear) * 220))
        score += max(0, int((mar - 0.42) * 120))
        score += max(0, int((abs(head_tilt) - 8) * 2.4))
        if self._eye_closed_since and time.time() - self._eye_closed_since > 1.2:
            score += 28
        return max(0, min(100, score))

    def _level_for(self, risk: int) -> str:
        if risk >= 70:
            return "critical"
        if risk >= 45:
            return "warning"
        return "normal"

    def _state_for(self, risk: int) -> str:
        if risk >= 70:
            return "drowsy"
        if risk >= 45:
            return "fatigue warning"
        return "attentive"

    def _maybe_alert(self, risk: int, state: str) -> None:
        if risk < 55:
            return
        now = time.time()
        if self.alerts and now - self.alerts[-1].timestamp < 4:
            return
        level = "critical" if risk >= 75 else "warning"
        title = "Wake-up alert" if level == "critical" else "Fatigue pattern detected"
        self.alerts.append(Alert(level=level, title=title, message=f"{state.title()} | risk {risk}%"))

    def _overlay(self, frame: np.ndarray) -> np.ndarray:
        if cv2 is None:
            return frame
        color = (80, 255, 120) if self.metrics.risk_score < 45 else (0, 180, 255)
        if self.metrics.risk_score >= 70:
            color = (60, 60, 255)
        cv2.rectangle(frame, (18, 18), (390, 126), (10, 14, 24), -1)
        cv2.putText(frame, f"State: {self.metrics.state}", (32, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)
        cv2.putText(frame, f"Risk: {self.metrics.risk_score}%  EAR: {self.metrics.ear}", (32, 88), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (230, 244, 255), 2)
        return frame

    def _draw_simulated_frame(self, frame: np.ndarray) -> np.ndarray:
        if cv2 is None:
            return frame
        frame[:] = (8, 11, 18)
        h, w = frame.shape[:2]
        cv2.circle(frame, (w // 2, h // 2 - 20), 120, (32, 42, 64), 4)
        cv2.circle(frame, (w // 2 - 42, h // 2 - 38), 12, (76, 224, 255), -1)
        cv2.circle(frame, (w // 2 + 42, h // 2 - 38), 12, (76, 224, 255), -1)
        cv2.ellipse(frame, (w // 2, h // 2 + 36), (40, 18), 0, 0, 180, (142, 93, 255), 3)
        return self._overlay(frame)


monitor = DrowsinessMonitor()
app = FastAPI(title="AI Driver Drowsiness Detection API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "online", "camera_ready": cv2 is not None, "mediapipe_ready": mp is not None}


@app.get("/metrics")
def metrics() -> dict:
    return monitor.synthetic_tick() if monitor.metrics.source == "simulated" else monitor.snapshot()


@app.get("/alerts")
def alerts() -> dict:
    return {"alerts": [asdict(alert) for alert in list(monitor.alerts)[::-1]]}


def frame_stream() -> Generator[bytes, None, None]:
    cap = cv2.VideoCapture(0) if cv2 is not None else None
    try:
        while True:
            if cap is not None and cap.isOpened():
                ok, frame = cap.read()
                if not ok:
                    frame = np.zeros((480, 720, 3), dtype=np.uint8)
            else:
                frame = np.zeros((480, 720, 3), dtype=np.uint8)

            frame, _ = monitor.process_frame(frame)
            ok, buffer = cv2.imencode(".jpg", frame) if cv2 is not None else (False, None)
            if ok:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            time.sleep(1 / 24)
    finally:
        if cap is not None:
            cap.release()


@app.get("/video-feed")
def video_feed() -> StreamingResponse:
    return StreamingResponse(frame_stream(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.websocket("/ws")
async def websocket_metrics(websocket: WebSocket) -> None:
    await websocket.accept()
    while True:
        await websocket.send_text(json.dumps(monitor.snapshot()))
        await asyncio.sleep(0.5)
