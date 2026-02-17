# ANCAP Safety Ratings API Discovery

## Primary Endpoints

### 1. Search/List All Ratings
**URL:** `https://www.ancap.com.au/api/search`

**Method:** GET

**Query Parameters:**
- `perPage` - Results per page (default: 50, max unknown)
- `page` - Page number (default: 1)
- `query` - Text search (doesn't seem to work for manufacturer filtering)

**Response:**
```json
{
  "meta": {
    "count": 1137,
    "perPage": 50,
    "query": {}
  },
  "results": [...]
}
```

**Result Fields:**
- `id` - Unique rating ID (e.g., "6dbc1f")
- `manufacturerIcon` - Path to manufacturer logo
- `manufacturerAndModel` - Full vehicle name
- `manufacturedFrom` / `manufacturedTo` - Production dates
- `onSaleFrom` / `onSaleTo` - Sale dates
- `variants` - Applicable variants
- `ratingYear` - Year of rating
- `safetyRatingImagePath` - Path to star rating logo
- `energySources` - Fuel/energy type
- `isConventionalOnly` - Boolean
- `isCurrentModel` - Boolean
- `supersededModelCount` - Number
- `tags` - Array of category/body_type/price/seats tags
- `imageUrl` - S3 CDN URL to vehicle image
- `fittedWith.autonomousEmergencyBraking` - "standard" | "optional" | "not_available"
- `fittedWith.laneSupportSystem` - "standard" | "optional" | "not_available"
- `links.self.url` - API link (requires auth: https://api.ancap.com.au/v1/safety-ratings/{id})
- `links.view.url` - Public web link
- `links.manufacturerAndModel.url` - Manufacturer/model page
- `adultOccupantProtection` - Percentage
- `childOccupantProtection` - Percentage
- `pedestrianProtection` - Percentage (Vulnerable Road User)
- `safetyAssist` - Percentage
- `safetyRating` - Star rating (1-5)

### 2. Detailed Rating by ID
**URL:** `https://www.ancap.com.au/api/safety-rating/{id}`

**Method:** GET

**Response:** Full detailed rating including:
- `vehicle` object with manufacturer, model, type, dates, variants, modelHistory, keyFeature
- `testResults` array with nested test scores:
  - Adult Occupant Protection (92%)
    - Frontal Offset, Full Width, Side Impact, Pole Oblique, Far-Side Impact
    - Whiplash Protection (Front/Rear)
    - Rescue & Extrication
  - Child Occupant Protection (91%)
    - Dynamic (Front/Side)
    - Child Restraint Installation
    - On-Board Features
  - Vulnerable Road User Protection (Pedestrian)
  - Safety Assist
- Each test has: name, type, assessed (bool), value, maxValue, units, nested tests

### 3. Other Discovered Endpoints (Untested)
- `/api/config` - Likely site configuration
- `/api/manufacturers-and-models` - Returns HTML (404 or not JSON)
- `/api/peek` - Unknown purpose

## Authenticated API (Not Accessible)
**Base URL:** `https://api.ancap.com.au/v1/`
- Requires API key/secret
- Returns: `{"error": "Invalid API key and/or secret"}`

## Next.js Data Endpoints
**Pattern:** `https://www.ancap.com.au/_next/data/{buildId}/safety-ratings/{path}.json`
- Build ID: `DhF56Un9qcath_Os3dl-v`
- Returns same data as HTML SSR but in JSON format
- Example: `/_next/data/DhF56Un9qcath_Os3dl-v/safety-ratings/toyota.json`

## Data Volume
- Total ratings: **1,137** (as of 2026-02-14)
- Pagination: 50 results per page by default
- All ratings can be fetched via: `/api/search?perPage=100&page=1` etc.

## Scraping Strategy
1. Fetch all ratings via `/api/search` with pagination
2. For each rating ID, fetch detailed data via `/api/safety-rating/{id}`
3. Rate limit: Unknown, but likely generous (Next.js SSR endpoints)
