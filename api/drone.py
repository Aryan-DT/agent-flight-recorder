import random

def get_drone_status() -> dict:
    """Check the drone's health before a scan: battery level, altitude, position, and whether the ESP32 WiFi sensor is connected."""
    return{
        "battery_percent": random.randint(55, 100),
        "altitude_m": round(random.uniform(1.5, 3.0), 1),
        "position": "hallway, facing the kitchen wall",
        "esp32_connected": True,

    }