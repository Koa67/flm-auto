# FLM AUTO API Documentation

**Base URL:** `https://your-domain.vercel.app/api` (or `http://localhost:3000/api` for local dev)

**Version:** 1.0.0

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/brands` | List all brands with stats |
| GET | `/vehicles` | List vehicles with filters |
| GET | `/vehicles/{id}` | Get vehicle details |
| GET | `/search` | Search vehicles |
| GET | `/compare` | Compare 2-4 vehicles |
| GET | `/screen-cars` | Top vehicles in films/games |

---

## GET /brands

List all available brands with model and generation counts.

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "BMW",
      "slug": "bmw",
      "country": "Germany",
      "logo_url": null,
      "stats": {
        "models": 65,
        "generations": 171
      }
    }
  ]
}
```

---

## GET /vehicles

List vehicles with optional filters and pagination.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `brand` | string | - | Filter by brand name (partial match) |
| `model` | string | - | Filter by model name (partial match) |
| `generation` | string | - | Filter by generation code |
| `limit` | integer | 20 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |

### Example Request

```
GET /api/vehicles?brand=BMW&limit=10
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "brand": "BMW",
      "brand_slug": "bmw",
      "model": "M3",
      "model_slug": "m3",
      "generation": "E46",
      "generation_slug": "e46",
      "year_start": 1999,
      "year_end": 2006
    }
  ],
  "pagination": {
    "total": 171,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

---

## GET /vehicles/{id}

Get full details for a specific vehicle generation.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | uuid | Generation ID |

### Response

```json
{
  "data": {
    "id": "uuid",
    "brand": {
      "id": "uuid",
      "name": "BMW",
      "slug": "bmw"
    },
    "model": {
      "id": "uuid",
      "name": "3 Series",
      "slug": "3-series"
    },
    "generation": {
      "id": "uuid",
      "name": "E46",
      "slug": "e46",
      "internal_code": "E46",
      "chassis_code": "E46",
      "year_start": 1999,
      "year_end": 2006
    },
    "variants": [
      {
        "id": "uuid",
        "name": "BMW E46 3 Series Coupe M3 CSL",
        "engine_code": "S54B32",
        "fuel_type": "essence",
        "displacement_cc": 3246,
        "power_hp": 360,
        "power_kw": 265,
        "torque_nm": 370,
        "transmission": "manual",
        "drivetrain": "RWD",
        "acceleration_0_100": 4.9,
        "top_speed_kmh": 250
      }
    ],
    "variants_count": 82,
    "safety": {
      "rating": 5,
      "test_year": 2019,
      "adult_occupant": 97,
      "child_occupant": 87,
      "pedestrian": 87,
      "safety_assist": 76,
      "source_url": "https://euroncap.com/..."
    },
    "screen_appearances": {
      "films": [
        {
          "title": "The Transporter",
          "year": 2002,
          "type": "movie",
          "role": "star"
        }
      ],
      "games": [
        {
          "title": "Need for Speed: Most Wanted",
          "year": 2005,
          "playable": true
        }
      ]
    }
  }
}
```

### Error Response (404)

```json
{
  "error": "Vehicle not found"
}
```

---

## GET /search

Search vehicles by query string across brand, model, and generation.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | **required** | Search query (min 2 chars) |
| `limit` | integer | 20 | Max results (1-50) |

### Example Request

```
GET /api/search?q=M3&limit=10
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "label": "BMW M3 E46",
      "brand": "BMW",
      "model": "M3",
      "generation": "E46",
      "slug": "bmw/m3/e46",
      "year_start": 1999,
      "year_end": 2006
    }
  ],
  "query": "M3",
  "count": 5
}
```

### Error Response (400)

```json
{
  "error": "Query must be at least 2 characters"
}
```

---

## GET /compare

Compare 2-4 vehicles side by side with insights.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | string | **required** Comma-separated generation UUIDs (2-4) |

### Example Request

```
GET /api/compare?ids=uuid1,uuid2,uuid3
```

### Response

```json
{
  "data": {
    "vehicles": [
      {
        "id": "uuid",
        "brand": "BMW",
        "model": "M3",
        "generation": "E46",
        "years": "1999-2006",
        "top_spec": {
          "name": "M3 CSL",
          "power_hp": 360,
          "torque_nm": 370,
          "displacement_cc": 3246,
          "acceleration_0_100": 4.9,
          "top_speed_kmh": 250
        },
        "base_spec": {
          "name": "318i",
          "power_hp": 118
        },
        "power_range": {
          "min": 118,
          "max": 360
        },
        "variants_count": 82,
        "safety": {
          "rating": 5,
          "year": 2019
        }
      }
    ],
    "insights": [
      "🏆 Most powerful: Lamborghini Aventador (770 HP)",
      "⚡ Fastest 0-100: Lamborghini Aventador (2.9s)",
      "🚀 Top speed: Lamborghini Aventador (350 km/h)"
    ]
  }
}
```

### Error Responses

```json
// Missing IDs
{ "error": "Missing ids parameter" }

// Not enough IDs
{ "error": "Need at least 2 vehicles to compare" }

// Vehicle not found
{ "error": "Could not find all vehicles" }
```

---

## GET /screen-cars

Get vehicles with the most film/TV/game appearances.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `all` | Filter: `movies`, `games`, or `all` |
| `brand` | string | - | Filter by brand name |
| `limit` | integer | 20 | Max results (1-100) |

### Example Request

```
GET /api/screen-cars?type=games&limit=5
```

### Response

```json
{
  "data": [
    {
      "generation_id": "uuid",
      "brand": "Lamborghini",
      "model": "Aventador",
      "generation": "LP700-4",
      "stats": {
        "total_appearances": 40,
        "movies_count": 0,
        "games_count": 7,
        "star_roles": 40
      },
      "notable_titles": [
        { "title": "Forza Motorsport", "year": 2023, "type": "video_game" },
        { "title": "Gran Turismo 7", "year": 2022, "type": "video_game" }
      ]
    }
  ],
  "summary": {
    "total_appearances": 539,
    "unique_movies": 0,
    "unique_games": 23,
    "vehicles_count": 5
  }
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting implemented. Will be added in production.

---

## Data Sources

| Source | Data Type | Coverage |
|--------|-----------|----------|
| UltimateSpecs | Vehicle specs | BMW, Mercedes, Lamborghini |
| IMCDB | Film/TV appearances | 10,164 entries |
| IGCD | Video game appearances | 539 entries |
| Euro NCAP | Safety ratings | 18 ratings |

---

## Changelog

### v1.0.0 (2026-01-27)
- Initial API release
- 6 endpoints
- 87% data health score
- Edge case hardening complete
