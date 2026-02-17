#!/usr/bin/env python3
"""
Convertit les données collectées (open source + DB export) en format ChatML JSONL.
Merge, deduplicate, shuffle, et split en train/val/test.

Usage : python3 slm/scripts/prepare-training.py
"""

import json
import os
import random
import hashlib

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "open-source")
SPLITS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "splits")

SYSTEM = (
    "Tu es ALAIN, assistant automobile expert de FLM AUTO. "
    "Tu réponds en français, de manière concise et technique."
)


def convert_wikidata() -> list:
    """Convertit les données Wikidata en Q&A."""
    examples = []
    path = os.path.join(RAW_DIR, "wikidata-vehicles.json")
    if not os.path.exists(path):
        print("   ⚠️ wikidata-vehicles.json not found, skipping")
        return examples

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    for item in data.get("results", {}).get("bindings", []):
        car_name = item.get("carLabel", {}).get("value", "")
        manufacturer = item.get("manufacturerLabel", {}).get("value", "")

        if not car_name or not manufacturer:
            continue
        # Skip generic Wikidata IDs
        if car_name.startswith("Q") and car_name[1:].isdigit():
            continue
        if manufacturer.startswith("Q") and manufacturer[1:].isdigit():
            continue

        facts = []
        if "inception" in item:
            year = item["inception"]["value"][:4]
            facts.append(f"lancée en {year}")
        if "engineDisplacement" in item:
            disp = item["engineDisplacement"]["value"]
            try:
                disp_f = float(disp)
                facts.append(f"cylindrée de {disp_f:.1f}L")
            except ValueError:
                pass
        if "maxSpeed" in item:
            speed = item["maxSpeed"]["value"]
            try:
                facts.append(f"vitesse max de {int(float(speed))} km/h")
            except ValueError:
                pass
        if "length" in item:
            length_val = item["length"]["value"]
            try:
                facts.append(f"longueur de {int(float(length_val) * 1000)} mm")
            except ValueError:
                pass

        if len(facts) >= 1:
            examples.append({
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Qu'est-ce que la {manufacturer} {car_name} ?"},
                    {
                        "role": "assistant",
                        "content": f"La **{manufacturer} {car_name}** : {', '.join(facts)}.",
                    },
                ]
            })

    return examples


def convert_us_models() -> list:
    """Convertit le dataset US car models en Q&A."""
    examples = []
    path = os.path.join(RAW_DIR, "us-car-models.json")
    if not os.path.exists(path):
        print("   ⚠️ us-car-models.json not found, skipping")
        return examples

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # Group by make
    by_make: dict[str, set[str]] = {}
    for item in data:
        make = item.get("make", "")
        model = item.get("model", "")
        if make and model:
            if make not in by_make:
                by_make[make] = set()
            by_make[make].add(model)

    for make, models in by_make.items():
        if len(models) >= 3:
            model_list = sorted(list(models))[:10]
            examples.append({
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Quels modèles fait {make} ?"},
                    {
                        "role": "assistant",
                        "content": f"**{make}** produit notamment : {', '.join(model_list)}.",
                    },
                ]
            })

    return examples


def deduplicate(examples: list) -> list:
    """Remove exact duplicates based on user message content hash."""
    seen = set()
    unique = []
    for ex in examples:
        # Hash the user message content
        user_msg = next(
            (m["content"] for m in ex["messages"] if m["role"] == "user"), ""
        )
        h = hashlib.md5(user_msg.encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(ex)
    return unique


def main():
    print("🔄 Préparation des données d'entraînement...\n")

    all_examples: list = []

    # 1. Load DB export (from export-db.ts)
    db_qa_path = os.path.join(PROCESSED_DIR, "all-qa.jsonl")
    if os.path.exists(db_qa_path):
        with open(db_qa_path, encoding="utf-8") as f:
            db_examples = [json.loads(line) for line in f if line.strip()]
        print(f"   📊 DB export: {len(db_examples)} exemples")
        all_examples.extend(db_examples)
    else:
        print("   ⚠️ all-qa.jsonl not found — run export-db.ts first")

    # 2. Open source: Wikidata
    wiki = convert_wikidata()
    print(f"   🌐 Wikidata: {len(wiki)} exemples")
    all_examples.extend(wiki)

    # 3. Open source: US models
    us = convert_us_models()
    print(f"   🇺🇸 US models: {len(us)} exemples")
    all_examples.extend(us)

    # Deduplicate
    before = len(all_examples)
    all_examples = deduplicate(all_examples)
    after = len(all_examples)
    if before > after:
        print(f"\n   🔁 Deduplication: {before} → {after} ({before - after} removed)")

    print(f"\n   📝 Total unique: {len(all_examples)} exemples")

    # Shuffle
    random.seed(42)  # Reproducible
    random.shuffle(all_examples)

    # Split 90/5/5
    train_end = int(len(all_examples) * 0.9)
    val_end = int(len(all_examples) * 0.95)

    os.makedirs(SPLITS_DIR, exist_ok=True)

    train_data = all_examples[:train_end]
    val_data = all_examples[train_end:val_end]
    test_data = all_examples[val_end:]

    with open(os.path.join(SPLITS_DIR, "train.jsonl"), "w", encoding="utf-8") as f:
        for ex in train_data:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(os.path.join(SPLITS_DIR, "val.jsonl"), "w", encoding="utf-8") as f:
        for ex in val_data:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(os.path.join(SPLITS_DIR, "test.jsonl"), "w", encoding="utf-8") as f:
        for ex in test_data:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    # Also save merged open-source only
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    open_source = wiki + us
    with open(
        os.path.join(PROCESSED_DIR, "open-source-qa.jsonl"), "w", encoding="utf-8"
    ) as f:
        for ex in open_source:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"\n📂 Splits:")
    print(f"   Train: {len(train_data)} exemples")
    print(f"   Val:   {len(val_data)} exemples")
    print(f"   Test:  {len(test_data)} exemples")
    print(f"\n✅ Écrit dans {SPLITS_DIR}/")


if __name__ == "__main__":
    main()
