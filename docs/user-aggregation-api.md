# User Aggregation API Endpoints

## Overview

These endpoints provide statistical data about user activity and content popularity, useful for the admin dashboard and insights section.

## Endpoints

### Daily and Weekly Active Users

```
GET /api/admin/stats/dau
```

Returns daily active users (DAU) and weekly active users (WAU) statistics.

**Authentication Required**: Yes (Admin only)  
**Rate Limiting**: Standard admin rate limit applies

#### Response

```json
{
  "dau": 42, // Number of unique users active in the last 24 hours
  "wau": 156, // Number of unique users active in the last 7 days
  "updated": "2025-05-09T12:34:56.789Z" // Timestamp of when the stats were calculated
}
```

#### Caching

Results are cached for 10 minutes for performance.

### Top Tracks

```
GET /api/admin/top-tracks
GET /api/admin/stats/top-tracks
```

Returns the most played tracks within a specified time period.

**Authentication Required**: Yes (Admin only)  
**Rate Limiting**: Standard admin rate limit applies

#### Query Parameters

- **days** (optional): Number of days to look back (default: 7, min: 1, max: 30)
- **limit** (optional): Maximum number of tracks to return (default: 10, max: 50)

#### Example Request

```
GET /api/admin/top-tracks?days=14&limit=20
```

#### Response

```json
[
  {
    "trackUrl": "https://example.com/track1.mp3",
    "title": "Top Hit Song",
    "plays": 87
  },
  {
    "trackUrl": "https://example.com/track2.mp3",
    "title": "Another Popular Track",
    "plays": 65
  },
  ...
]
```

#### Caching

Results are cached for 30 minutes using a cache key based on the days and limit parameters.

## Implementation Details

### DAU/WAU Calculation

The DAU/WAU statistics are calculated using MongoDB aggregation pipelines:

1. For DAU: Count distinct userIds in LoginEvent collection where login timestamp is within the last 24 hours
2. For WAU: Count distinct userIds in LoginEvent collection where login timestamp is within the last 7 days

### Top Tracks Calculation

Top tracks are determined by:

1. Filtering PlayEvent records to the specified timeframe (e.g., last 7 days)
2. Grouping by trackUrl
3. Counting occurrences (plays) for each track
4. Sorting by play count in descending order
5. Limiting to the requested number of results

## Model Indexes

These endpoints rely on optimized indexes for efficient queries:

- `LoginEvent`: Compound index on `{ userId: 1, at: 1 }` for efficient user activity queries
- `PlayEvent`: Compound index on `{ userId: 1, startedAt: 1 }` for efficient track play queries

## Testing

These endpoints can be tested using the Postman collection available in `API/tickets/MystickHits-User-Aggregation.postman_collection.json`.
