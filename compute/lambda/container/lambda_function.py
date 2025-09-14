import json

import requests


def handler(event, context):
    # Coordenadas de Nueva York
    latitude = 40.7128
    longitude = -74.0060

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        f"&current=temperature_2m,weathercode"
    )

    response = requests.get(url, timeout=5)

    if response.status_code == 200:
        data = response.json()
        current = data.get("current", {})

        result = {
            "temperature": current.get("temperature_2m"),
            "weathercode": current.get("weathercode"),
        }

        return {"statusCode": 200, "body": json.dumps(result)}

    else:
        return {
            "statusCode": response.status_code,
            "body": json.dumps({"error": "Failed to fetch weather"}),
        }
