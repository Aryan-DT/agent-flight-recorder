import random
import time
from dataclasses import dataclass, field
from typing import Literal

from pydantic_ai import ModelRetry, RunContext

MOTION_THRESHOLD = 3.5  # Variance threshold for detecting motion through the wall
METERS_TO_FEET = 3.281

Fault = Literal["sensor_timeout", "malformed_data", "wrong_units", "low_battery"]


@dataclass
class DroneDeps:
    faults: list[Fault] = field(default_factory=list)


def get_drone_status(ctx: RunContext[DroneDeps]) -> dict:
    """Check the drone's health before a scan: battery level, altitude,
    position, and whether the ESP32 WiFi sensor is connected."""
    if "low_battery" in ctx.deps.faults:
        battery = 8
    else:
        battery = random.randint(55, 100)

    return {
        "battery_percent": battery,
        "altitude_m": round(random.uniform(1.5, 3.0), 1),
        "position": "hallway, facing the kitchen wall",
        "esp32_connected": True,
    }


def read_wifi_csi(ctx: RunContext[DroneDeps], duration_seconds: int = 5) -> dict:
    """Record WiFi Channel State Information (CSI) through the wall using the
    drone's ESP32 sensor. Returns a summary of the signal readings. Pass the
    amplitude_variance to detect_motion_through_wall to analyze it."""
    duration_seconds = max(1, min(duration_seconds, 10))

    if "sensor_timeout" in ctx.deps.faults:
        time.sleep(2)
        raise ModelRetry("ESP32 sensor timed out after 2 seconds with no CSI data.")

    person_present = random.random() < 0.6
    if person_present:
        variance = round(random.uniform(4.0, 12.0), 2)
    else:
        variance = round(random.uniform(0.2, 1.5), 2)

    return {
        "duration_seconds": duration_seconds,
        "sample_rate_hz": 100,
        "samples": duration_seconds * 100,
        "subcarriers": 64,
        "mean_amplitude_db": round(random.uniform(-62.0, -48.0), 1),
        "amplitude_variance": variance,
    }


def detect_motion_through_wall(
    ctx: RunContext[DroneDeps], amplitude_variance: float
) -> dict | str:
    """Analyze CSI amplitude_variance (from read_wifi_csi) to detect human
    motion behind the wall. Returns whether motion was detected, a confidence
    score, the estimated number of people, and their distance."""
    if "malformed_data" in ctx.deps.faults:
        return '{"motion_detected": tru, "confidence": 0.9, "estimated_peo'

    variance = max(0.0, amplitude_variance)
    motion = variance > MOTION_THRESHOLD
    confidence = round(min(0.99, 0.5 + abs(variance - MOTION_THRESHOLD) / 10), 2)

    if not motion:
        people = 0
    elif variance < 8.0:
        people = 1
    else:
        people = 2

    distance_m = round(random.uniform(1.5, 5.0), 1) if motion else None
    if distance_m is not None and "wrong_units" in ctx.deps.faults:
        distance_m = round(distance_m * METERS_TO_FEET, 1)

    return {
        "motion_detected": motion,
        "confidence": confidence,
        "estimated_people": people,
        "distance_m": distance_m,
    }
