# Client-Side Implementation Guidelines

## Preventing Excessive Database Writes

To ensure optimal performance and prevent database flooding, please follow these guidelines when implementing client-side audio players:

### 1. Throttle Play Event Logging

```javascript
// Example implementation
let lastPlayEventTime = 0;
const PLAY_EVENT_THROTTLE = 10000; // 10 seconds minimum between play events

function logPlayEvent(trackData) {
  const now = Date.now();

  // Only send play events every 10 seconds at most
  if (now - lastPlayEventTime < PLAY_EVENT_THROTTLE) {
    console.log('Throttled play event logging');
    return Promise.resolve({ throttled: true });
  }

  lastPlayEventTime = now;

  // Send the play event to the API
  return fetch('/api/playlist/plays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(trackData),
  }).then((res) => res.json());
}
```

### 2. Batch Progress Updates

Instead of sending progress updates continuously, collect them and send in batches:

```javascript
// Example implementation
const progressUpdates = [];
let updateTimer = null;
const UPDATE_INTERVAL = 30000; // Send updates every 30 seconds

function trackProgress(playEventId, progress) {
  // Store the update
  progressUpdates.push({
    playEventId,
    progress,
    timestamp: Date.now(),
  });

  // Schedule a batch update if not already scheduled
  if (!updateTimer) {
    updateTimer = setTimeout(sendBatchUpdates, UPDATE_INTERVAL);
  }
}

function sendBatchUpdates() {
  // Clear the timer
  updateTimer = null;

  // Don't send if no updates
  if (progressUpdates.length === 0) return;

  // Take a copy and clear the original
  const updates = [...progressUpdates];
  progressUpdates.length = 0;

  // Only send the latest update per playEventId
  const latestUpdates = {};
  updates.forEach((update) => {
    latestUpdates[update.playEventId] = update;
  });

  // Send the batch update
  fetch('/api/playlist/plays/batch-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      playEvents: Object.values(latestUpdates),
    }),
  });
}
```

### 3. Send Completion Events Only Once

Only send completion events when a track is actually finished:

```javascript
function handlePlaybackComplete(playEventId, trackId) {
  // Send a single completion event
  fetch(`/api/playlist/plays/${playEventId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      completed: true,
      endTimestamp: new Date().toISOString(),
    }),
  });
}
```

### 4. Handle Application Lifecycle Events

Make sure to send final updates when the user is navigating away:

```javascript
window.addEventListener('beforeunload', () => {
  // Synchronously send any pending updates
  if (progressUpdates.length > 0) {
    const updates = [...progressUpdates];
    navigator.sendBeacon(
      '/api/playlist/plays/batch-update',
      JSON.stringify({ playEvents: updates }),
    );
  }
});
```

By following these guidelines, you'll help ensure the API performs optimally without excessive database writes.
