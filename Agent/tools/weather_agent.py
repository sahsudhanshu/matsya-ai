from typing import Optional
import httpx
import os
from dotenv import load_dotenv
from pathlib import Path
import asyncio
load_dotenv(Path(__file__).parent.parent.parent / ".env")


BEAUFORT_DESCRIPTIONS = [
    (0, 0.2, "शांत (Calm)", "Mirror-smooth sea"),
    (0.3, 1.5, "हल्की हवा (Light air)", "Small ripples"),
    (1.6, 3.3, "हल्की बयार (Light breeze)", "Small wavelets"),
    (3.4, 5.4, "मंद बयार (Gentle breeze)", "Large wavelets, some crests"),
    (5.5, 7.9, "तेज़ बयार (Moderate breeze)", "Small waves, frequent whitecaps"),
    (8.0, 10.7, "ताज़ा हवा (Fresh breeze)", "Moderate waves - be cautious!"),
    (10.8, 13.8, "तेज़ हवा (Strong breeze)", "Large waves - avoid deep sea!"),
    (13.9, 17.1, "भारी हवा (Near gale)", "⚠️ Dangerous - return to shore!"),
    (17.2, 100, "तूफ़ान (Gale+)", "🚨 DANGER - DO NOT GO TO SEA!"),
]

def _wind_advisory(speed_ms: float) -> str:
    for low, high, label, desc in BEAUFORT_DESCRIPTIONS:
        if low <= speed_ms <= high:
            return f"{label} - {desc}"
    return "Unknown"



async def weather_agent(lat:float,long:float,place:Optional[str]=None) -> str:

    print("--> weather tool called")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": long,
                    "appid": os.getenv("OPENWEATHERMAP_API_KEY"),
                    "units": "metric",
                },
            )
            response.raise_for_status()
            response_json=response.json()

            # print("response_json Weather:")
            # print(response_json)

            forecast_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "lat": lat,
                    "lon": long,
                    "appid": os.getenv("OPENWEATHERMAP_API_KEY"),
                    "units": "metric",
                    "cnt": 4,
                },
            )
            forecast_resp.raise_for_status()
            forecast_json=forecast_resp.json()

            # print("Weather Forecast:")
            # print(forecast_json)

    except httpx.RequestError as err:
        return f"Couln't fetche weather , reason :{err}"

    wind_speed = response_json.get("wind", {}).get("speed", 0)
    wind_deg = response_json.get("wind",{}).get("deg",0)
    temp = response_json.get("main",{}).get("temp",0)
    humidity = response_json.get("main",{}).get("humidity",0)
    description = response_json.get("weather", [{}])[0].get("description", "").title()
    clouds = response_json.get("clouds", {}).get("all", 0)
    rain_1h = response_json.get("rain", {}).get("1h", 0)
    visibility = response_json.get("visibility", 10000) / 1000 #to convert in km

    label=place or f"{lat:.2f}°N, {long:.2f}°E"

    advisory= _wind_advisory(wind_speed)

    final_output=[
        f"📍 **{label}** - Current Conditions",
        f"  🌤️ {description}",
        f"  🌡️ Temperature: {temp:.0f}°C | Humidity: {humidity}%",
        f"  💨 Wind: {wind_speed:.1f} m/s ({wind_deg}°) - {advisory}",
        f"  ☁️ Cloud cover: {clouds}% | Visibility: {visibility:.1f} km",
    ]

    if rain_1h > 0:
        final_output.append(f"  🌧️ Rain (last 1h): {rain_1h} mm")

    # ── Forecast ─────────────────────────────────────────────────────────
    final_output.append("\n📅 **Next 12-Hour Forecast**:")
    for entry in forecast_json.get("list", []):
        dt_txt = entry.get("dt_txt", "")
        f_temp = entry["main"]["temp"]
        f_wind = entry["wind"]["speed"]
        f_desc = entry["weather"][0]["description"].title()
        f_rain = entry.get("rain", {}).get("3h", 0)
        adv = _wind_advisory(f_wind)
        line = f"  {dt_txt[-8:-3]} - {f_desc}, {f_temp:.0f}°C, Wind {f_wind:.1f}m/s ({adv})"
        if f_rain > 0:
            line += f", Rain {f_rain}mm"
        final_output.append(line)

    print("Final Weather Output:")
    print("\n".join(final_output))
    return "\n".join(final_output)


