# API Load Testing with k6

This directory contains k6 load testing scripts for the Mystic Hits API.

## Requirements

- [k6](https://k6.io/docs/getting-started/installation/) installed on your system
- Running API server (local or remote)

## Running Tests

To run a load test:

```bash
# Basic test with default settings
k6 run api-load-test.js

# Run with specific duration
k6 run --duration 60s api-load-test.js

# Run with specific number of virtual users
k6 run --vus 50 api-load-test.js

# Run with both duration and virtual users
k6 run --vus 50 --duration 60s api-load-test.js
```

## Configuration

You can modify the test configuration in the script under the `options` object:

- `scenarios`: Define different testing scenarios
- `thresholds`: Set performance thresholds (e.g., response time, error rate)

## Example Test Scenarios

The script includes multiple test scenarios:

1. **Constant Request Rate**: Maintains a steady rate of requests regardless of response times
2. **Ramping VUs**: Gradually increases and decreases the number of virtual users

## Interpreting Results

After running a test, k6 will output detailed metrics including:

- Request duration statistics (min, max, average, p90, p95)
- Request rates
- Error rates
- Custom metrics defined in the script

Look for failed thresholds in the output to identify performance issues.

## Adding More Tests

To create additional test scenarios:

1. Create a new .js file in this directory
2. Import the necessary k6 modules
3. Define your test configuration and scenarios
4. Run with `k6 run your-new-test.js`