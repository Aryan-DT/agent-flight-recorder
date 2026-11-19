import random

def get_drone_status() -> dict:
    """Check the drone's health before a scan: battery level, altitude, position, and whether the ESP32 WiFi sensor is connected."""
    return{
        "battery_percent": random.randint(55, 100),
        "altitude_m": round(random.uniform(1.5, 3.0), 1),
        "position": "hallway, facing the kitchen wall",
        "esp32_connected": True,

    }

def read_wifi_csi(duration_seconds: int = 5) -> dict:
    """Record WiFi Channel State Information (CSI) through the wall using the
    drone's ESP32 sensor. Returns a summary of the signal readings. Pass the
    amplitude_variance to detect_motion_through_wall to analyze it."""
    duration_seconds = max(1, min(duration_seconds, 10))

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
