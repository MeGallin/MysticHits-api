import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Main test configuration
export const options = {
  // Test scenarios
  scenarios: {
    // Constant request rate (excellent for stress tests)
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 50,        // 50 requests per timeUnit
      timeUnit: '1s',  // 50 RPS
      duration: '30s', // Test duration
      preAllocatedVUs: 20, // Initial VUs to allocate
      maxVUs: 100,     // Maximum number of VUs to scale to
    },
    // Ramping VUs (excellent for load tests)
    ramping_vus: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },  // Ramp up to 20 users
        { duration: '30s', target: 20 },  // Stay at 20 for 30 seconds
        { duration: '10s', target: 0 },   // Ramp down to 0 users
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
    errors: ['rate<0.1'],             // Error rate should be less than 10%
  },
};

// Simulated user data
const users = [
  { email: 'test1@example.com', password: 'password123' },
  { email: 'test2@example.com', password: 'password123' },
  { email: 'test3@example.com', password: 'password123' },
];

// Shared data between requests
const sharedData = {
  authTokens: {},
};

// Helper functions
function getRandomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

// Main test function
export default function () {
  const baseUrl = 'http://localhost:8000/api'; // Adjust for your environment
  const user = getRandomUser();
  
  group('Public Endpoints', function () {
    // Health check endpoint - should be lightweight and fast
    {
      const response = http.get(`${baseUrl}/health/status`);
      
      check(response, {
        'status is 200': (r) => r.status === 200,
        'response body has status field': (r) => r.json().status === 'ok',
      }) || errorRate.add(1);
      
      sleep(1);
    }
    
    // Public music charts endpoint
    {
      const response = http.get(`${baseUrl}/charts/top`);
      
      check(response, {
        'charts status is 200': (r) => r.status === 200,
        'charts returns array': (r) => Array.isArray(r.json()),
      }) || errorRate.add(1);
    }
  });
  
  // Authentication flow
  group('Authentication', function () {
    // Login attempt
    const loginPayload = JSON.stringify({
      email: user.email,
      password: user.password,
    });
    
    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const loginResponse = http.post(
      `${baseUrl}/auth/login`,
      loginPayload,
      params
    );
    
    check(loginResponse, {
      'login successful': (r) => r.status === 200,
      'has auth token': (r) => r.json().token !== undefined,
    }) || errorRate.add(1);
    
    // Store the token for authenticated requests
    if (loginResponse.status === 200) {
      const token = loginResponse.json().token;
      sharedData.authTokens[user.email] = token;
      
      // Authenticated request - playlist access
      const authHeaders = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      };
      
      const playlistResponse = http.get(
        `${baseUrl}/playlist/user`,
        authHeaders
      );
      
      check(playlistResponse, {
        'playlist access successful': (r) => r.status === 200,
        'playlist data is array': (r) => Array.isArray(r.json()),
      }) || errorRate.add(1);
    }
  });
  
  // Always sleep between test iterations to simulate real user behavior
  sleep(Math.random() * 3 + 1); // 1-4 second random sleep
}