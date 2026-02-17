#!/usr/bin/env python3
"""
Collecte des datasets automobiles open source pour fine-tuning.
Sources : GitHub (us-car-models), Wikidata SPARQL.

Usage : python3 slm/scripts/collect-open-source.py
"""

import json
import os
import urllib.request
import urllib.parse

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "open-source")
os.makedirs(DATA_DIR, exist_ok=True)


def fetch_json(url: str, dest: str, label: str) -> bool:
    """Download a JSON file, return True on success."""
    print(f"📥 {label}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FLM-AUTO-SLM/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(dest, "wb") as f:
            f.write(data)
        size_kb = len(data) / 1024
        print(f"   ✅ Downloaded ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False


def collect_github_us_models():
    """GitHub: n8barr/automotive-model-year-data — year/make/model for US market."""
    url = "https://raw.githubusercontent.com/n8barr/automotive-model-year-data/master/data.json"
    fetch_json(url, os.path.join(DATA_DIR, "us-car-models.json"), "GitHub: us-car-models-data")


def collect_wikidata_vehicles():
    """Wikidata SPARQL: automobile models with specs."""
    sparql_query = """
SELECT ?car ?carLabel ?manufacturer ?manufacturerLabel ?inception
       ?engineDisplacement ?maxSpeed ?length ?width ?height
WHERE {
  ?car wdt:P31/wdt:P279* wd:Q3231690.
  ?car wdt:P176 ?manufacturer.
  OPTIONAL { ?car wdt:P571 ?inception. }
  OPTIONAL { ?car wdt:P2234 ?engineDisplacement. }
  OPTIONAL { ?car wdt:P8285 ?maxSpeed. }
  OPTIONAL { ?car wdt:P2043 ?length. }
  OPTIONAL { ?car wdt:P2049 ?width. }
  OPTIONAL { ?car wdt:P2048 ?height. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 10000
"""
    encoded = urllib.parse.quote(sparql_query)
    url = f"https://query.wikidata.org/sparql?query={encoded}&format=json"
    fetch_json(url, os.path.join(DATA_DIR, "wikidata-vehicles.json"), "Wikidata SPARQL: vehicles with specs")


def collect_github_fuel_economy():
    """GitHub EPA fuel economy data (if available)."""
    url = "https://raw.githubusercontent.com/datasets/fueleconomy/main/data/vehicles.csv"
    dest = os.path.join(DATA_DIR, "epa-fuel-economy.csv")
    print("📥 GitHub: EPA fuel economy...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FLM-AUTO-SLM/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        with open(dest, "wb") as f:
            f.write(data)
        size_kb = len(data) / 1024
        print(f"   ✅ Downloaded ({size_kb:.0f} KB)")
    except Exception as e:
        print(f"   ⚠️ Skipped: {e}")


def main():
    print("🚗 Collecte datasets automobiles open source\n")

    collect_github_us_models()
    collect_wikidata_vehicles()
    collect_github_fuel_economy()

    print("\n✅ Collection terminée.")
    print("   Convertir en Q&A avec : python3 slm/scripts/prepare-training.py")


if __name__ == "__main__":
    main()
