"""
Synthetic Crime Heatmap Generator for SafeRoute Hyderabad
Uses official 2025 crime totals + Gaussian clustering across 4 major zones.
"""

import json
import random
import math

random.seed(2025)

# ── Official 2025 Crime Totals (base volume) ──────────────────────────
CRIME_TOTALS = {
    "Murder":              69,
    "Attempt to Murder":  176,
    "Robbery":            116,
    "House Breaking":     464,
    "Automobile Theft":  1501,
    "Rape":               405,
    "Kidnapping":         166,
    "Crime Against Women":2625,
    "Cybercrime":        3735,
    "Minor Theft":       1800,  # estimated from non-grave property offences
}

SEVERITY = {
    "Murder": 10,
    "Attempt to Murder": 9,
    "Robbery": 8,
    "House Breaking": 6,
    "Automobile Theft": 5,
    "Rape": 10,
    "Kidnapping": 9,
    "Crime Against Women": 9,
    "Cybercrime": 4,
    "Minor Theft": 3,
}

# ── Area Definitions ──────────────────────────────────────────────────
AREAS = {
    "Charminar": {
        "center": (17.3616, 78.4747),
        "std_dev": 0.008,           # tighter clustering – dense old city
        "weight": 0.30,             # 30% of total points
        "crime_profile": {          # relative bias for this area
            "Minor Theft": 3.0,
            "Robbery": 1.5,
            "Crime Against Women": 1.2,
            "House Breaking": 1.0,
            "Murder": 1.1,
            "Attempt to Murder": 1.0,
            "Kidnapping": 0.8,
            "Automobile Theft": 0.7,
            "Cybercrime": 0.3,
            "Rape": 0.8,
        },
    },
    "Banjara Hills": {
        "center": (17.4123, 78.4489),
        "std_dev": 0.010,
        "weight": 0.22,
        "crime_profile": {
            "Robbery": 2.5,
            "Cybercrime": 3.0,
            "Automobile Theft": 2.0,
            "House Breaking": 1.5,
            "Crime Against Women": 1.0,
            "Minor Theft": 1.0,
            "Murder": 0.5,
            "Attempt to Murder": 0.6,
            "Kidnapping": 0.7,
            "Rape": 0.6,
        },
    },
    "Secunderabad": {
        "center": (17.4399, 78.4983),
        "std_dev": 0.009,
        "weight": 0.28,
        "crime_profile": {
            "Minor Theft": 1.5,
            "Robbery": 1.2,
            "Automobile Theft": 1.3,
            "Crime Against Women": 1.5,
            "House Breaking": 1.2,
            "Murder": 1.0,
            "Attempt to Murder": 1.2,
            "Kidnapping": 1.0,
            "Cybercrime": 1.0,
            "Rape": 1.0,
        },
    },
    "LB Nagar": {
        "center": (17.3457, 78.5520),
        "std_dev": 0.009,
        "weight": 0.20,
        "crime_profile": {
            "House Breaking": 2.5,
            "Automobile Theft": 1.8,
            "Crime Against Women": 1.3,
            "Minor Theft": 1.2,
            "Murder": 0.9,
            "Attempt to Murder": 1.1,
            "Robbery": 0.8,
            "Kidnapping": 1.2,
            "Cybercrime": 0.5,
            "Rape": 0.9,
        },
    },
}

TARGET_POINTS = 250

def gaussian_jitter(center_lat, center_lng, std_dev):
    """Generate a lat/lng with Gaussian spread around center."""
    lat = random.gauss(center_lat, std_dev)
    lng = random.gauss(center_lng, std_dev * 1.1)  # slight lng stretch
    return round(lat, 6), round(lng, 6)


def pick_crime_type(profile):
    """Weighted random selection of crime type based on area profile."""
    types = list(profile.keys())
    weights = [profile[t] for t in types]
    total = sum(weights)
    r = random.uniform(0, total)
    cumulative = 0
    for t, w in zip(types, weights):
        cumulative += w
        if r <= cumulative:
            return t
    return types[-1]


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


# ── Generate ─────────────────────────────────────────────────────────
points = []
point_id = 1

for area_name, area in AREAS.items():
    n_points = round(TARGET_POINTS * area["weight"])
    center_lat, center_lng = area["center"]

    for _ in range(n_points):
        crime_type = pick_crime_type(area["crime_profile"])
        sev = SEVERITY[crime_type]
        intensity = clamp(round(sev / 10, 2), 0.2, 1.0)
        lat, lng = gaussian_jitter(center_lat, center_lng, area["std_dev"])

        points.append({
            "id": point_id,
            "crime_type": crime_type,
            "lat": lat,
            "lng": lng,
            "severity_weight": sev,
            "intensity": intensity,
            "area_name": area_name,
        })
        point_id += 1

# Shuffle for realism
random.shuffle(points)
# Re-index after shuffle
for i, p in enumerate(points, 1):
    p["id"] = i

# ── Write JSON ────────────────────────────────────────────────────────
with open(r"d:\safe-route-hyderabad\data\crime-zones.json", "w", encoding="utf-8") as f:
    json.dump(points, f, indent=2, ensure_ascii=False)

# ── Summary Stats ────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  SYNTHETIC CRIME HEATMAP — SUMMARY")
print(f"{'='*60}")
print(f"  Total data points generated: {len(points)}")
print()

# Per-area stats
from collections import Counter, defaultdict

area_counts = Counter()
area_severity = defaultdict(list)
area_types = defaultdict(lambda: Counter())

for p in points:
    area_counts[p["area_name"]] += 1
    area_severity[p["area_name"]].append(p["severity_weight"])
    area_types[p["area_name"]][p["crime_type"]] += 1

print(f"  {'Area':<18} {'Points':>7} {'Share':>7} {'Avg Sev':>8}")
print(f"  {'-'*42}")
for area in AREAS:
    count = area_counts[area]
    avg = sum(area_severity[area]) / count if count else 0
    share = count / len(points) * 100
    print(f"  {area:<18} {count:>7} {share:>6.1f}% {avg:>8.2f}")

print(f"\n  Crime Type Distribution per Area:")
print(f"  {'-'*60}")
for area in AREAS:
    print(f"\n  [{area}]")
    for ct, n in area_types[area].most_common():
        print(f"    {ct:<22} {n:>4}")

print(f"\n{'='*60}")
print("  Output: data/crime-zones.json")
print(f"{'='*60}\n")
