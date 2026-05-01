"""
Market prices tool - provides indicative fish market prices.

Uses static seed data for the hackathon; in production this would
query a real market-prices API or scraped data source.
"""
from __future__ import annotations
from typing import Optional
from langchain_core.tools import tool


# ── Seed data (INR per kg, indicative) ──────────────────────────────────────

MARKET_DATA = {
    "Mumbai": {
        "Pomfret (Paplet)": 800,
        "Bombay Duck (Bombil)": 250,
        "Surmai (Seer Fish)": 700,
        "Rawas (Indian Salmon)": 600,
        "Prawns (Jhinga)": 500,
        "Mackerel (Bangda)": 200,
        "Hilsa (Ilish)": 1200,
    },
    "Kochi": {
        "Karimeen (Pearl Spot)": 800,
        "King Fish (Neymeen)": 600,
        "Prawns": 450,
        "Sardine (Mathi)": 150,
        "Tuna (Choora)": 350,
        "Mackerel (Ayala)": 180,
        "Seer Fish (Neymeen)": 650,
    },
    "Chennai": {
        "Seer Fish (Vanjiram)": 700,
        "Pomfret (Vavval)": 750,
        "Prawns (Eral)": 480,
        "Sardine (Mathi)": 130,
        "Tuna": 300,
        "Crab (Nandu)": 400,
    },
    "Visakhapatnam": {
        "Pomfret": 700,
        "Prawns": 420,
        "Mackerel": 180,
        "Sardine": 120,
        "Tuna": 280,
        "Seer Fish": 650,
    },
    "Mangalore": {
        "Mackerel (Bangude)": 200,
        "Sardine (Bhoothai)": 100,
        "Pomfret": 750,
        "Prawns": 450,
        "Seer Fish (Anjal)": 680,
        "Lady Fish (Kane)": 350,
    },
    "Porbandar": {
        "Pomfret (Paplet)": 850,
        "Surmai": 720,
        "Lobster": 1500,
        "Prawns": 500,
        "Mackerel": 190,
    },
}

ALL_PORTS = list(MARKET_DATA.keys())


@tool
async def get_market_prices(
    port_name: Optional[str] = None,
    fish_species: Optional[str] = None,
) -> str:
    """
    Get current fish market prices at Indian fishing ports.
    Provide port_name to see prices at a specific port, or fish_species to find
    where that fish is sold and at what price.

    Args:
        port_name: Name of the port/city (e.g. 'Mumbai', 'Kochi')
        fish_species: Name of a fish species to look up across all ports
    """
    print(f"💰  [TOOL] get_market_prices called → port={port_name!r}, species={fish_species!r}")
    lines: list[str] = []

    if port_name:
        # Fuzzy match port
        key = None
        for p in ALL_PORTS:
            if port_name.lower() in p.lower() or p.lower() in port_name.lower():
                key = p
                break

        if key and key in MARKET_DATA:
            lines.append(f"💰 **Fish Prices at {key}** (per kg):")
            for species, price in sorted(MARKET_DATA[key].items(), key=lambda x: -x[1]):
                lines.append(f"  • {species}: ₹{price}")
        else:
            lines.append(f"No price data for '{port_name}'. Available ports: {', '.join(ALL_PORTS)}")

    elif fish_species:
        # Search across all ports
        q = fish_species.lower()
        found = []
        for port, species_map in MARKET_DATA.items():
            for species, price in species_map.items():
                if q in species.lower():
                    found.append((port, species, price))

        if found:
            lines.append(f"💰 **Prices for '{fish_species}' across ports:**")
            for port, species, price in sorted(found, key=lambda x: x[2]):
                lines.append(f"  • {port}: {species} - ₹{price}/kg")
        else:
            lines.append(f"No price data for '{fish_species}'. Try a broader search.")
    else:

        lines.append("💰 **Available Fish Markets:**")
        for port in ALL_PORTS:
            count = len(MARKET_DATA[port])
            lines.append(f"  • {port} ({count} species tracked)")
        lines.append("\nAsk about a specific port or fish species for detailed prices.")

    return "\n".join(lines)
