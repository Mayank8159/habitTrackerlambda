API Payload Guide

Base URL (deployed):
- https://hg1iywighj.execute-api.ap-south-1.amazonaws.com

Notes:
- The API requires `userId` for most habit operations. `POST /auth/register` returns a `userId` you can use.
- For local development use `npm run local` (Serverless Offline). Writes require AWS credentials or a local dev fallback.

1) POST /auth/register
- URL: `/auth/register`
- Method: POST
- Headers: `Content-Type: application/json`
- Body JSON:
  {
    "username": "string",
    "email": "user@example.com"
  }
- Expected success response (201):
  {
    "userId": "<uuid>",
    "username": "string",
    "email": "user@example.com",
    "createdAt": "ISO8601"
  }
- Observed when testing: deployed endpoint returned a valid `userId` for new user registrations.

2) GET /habits
- URL: `/habits?userId=<userId>`
- Method: GET
- Headers: none required (Content-Type not needed)
- Query params: `userId` (required)
- Expected success response (200):
  {
    "habits": [ /* array of habit objects */ ],
    "count": 0
  }
- Observed when testing: newly-registered users returned an empty array (`{"habits":[],"count":0}`).

3) POST /habits/create
- URL: `/habits/create`
- Method: POST
- Headers: `Content-Type: application/json`
- Body JSON (required):
  {
    "userId": "<userId>",
    "title": "My habit title",
    "cardHeight": 180,
    "colors": { "primary": "#RRGGBB", "secondary": "#RRGGBB" }
  }
- Expected success response (201):
  {
    "habitId": "<id>",
    "title": "My habit title",
    "cardHeight": 180,
    "colors": { "primary": "#...", "secondary": "#..." },
    "progress": 0.0,
    "streakCount": 0,
    "lastCheckIn": null,
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
- Observed when testing: deployed API sometimes returned an empty JSON object `{}` for create. If you run locally, ensure DynamoDB is reachable or use a local fallback. Validation errors return 400 with messages.

4) POST /habits/check-in
- URL: `/habits/check-in`
- Method: POST
- Headers: `Content-Type: application/json`
- Body JSON:
  {
    "userId": "<userId>",
    "habitId": "<habitId>"
  }
- Expected success response (200):
  {
    "habitId": "<habitId>",
    "progress": 0.25,
    "streakCount": 1,
    "lastCheckIn": "ISO8601",
    "completed": false,
    "updatedAt": "ISO8601"
  }
- Observed: if habit not found returns 404. Ensure `habitId` exists (from create or Get).

5) PATCH /habits/{habitId}
- URL: `/habits/{habitId}`
- Method: PATCH
- Headers: `Content-Type: application/json`
- Path param: `habitId` (required)
- Body JSON (at least one updatable field):
  {
    "userId": "<userId>",
    "title": "New title",          // optional
    "cardHeight": 200,             // optional
    "colors": {"primary":"#...","secondary":"#..."} // optional
  }
- Expected success response (200): returns updated habit object.

6) DELETE /habits/{habitId}
- URL: `/habits/{habitId}`
- Method: DELETE
- Headers: `Content-Type: application/json`
- Path param: `habitId` (required)
- Body JSON (or query):
  { "userId": "<userId>" }
- Expected success response (200): { "success": true }

CORS / OPTIONS
- Each handler exports an `options` handler to respond to preflight. The API is configured with permissive CORS in `serverless.yml`.

Frontend examples (fetch):
Register:
```js
await fetch(`${BASE}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'alice', email: 'alice@example.com' })
})
```

Create habit:
```js
await fetch(`${BASE}/habits/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, title: 'Read', cardHeight: 180, colors: { primary: '#111', secondary: '#eee' } })
})
```

Troubleshooting notes:
- If `POST /habits/create` returns `{}` or create succeeds but `GET /habits` returns empty, likely causes:
  - Deployed Lambda lacks permissions to write to DynamoDB.
  - DynamoDB table missing or named differently than environment variable `HABITS_TABLE`.
  - Writes succeed but are not returning expected payload (check CloudWatch logs).
- For local testing, run:
```bash
npm ci
npm run local
```
Then use the same fetch requests against `http://localhost:3000` (serverless offline default when using `npm run local`).

If you want, I can implement a lightweight local in-memory fallback so frontend development works without AWS credentials — say if you want that, reply 'implement local fallback' and I'll add it and re-run tests locally.
