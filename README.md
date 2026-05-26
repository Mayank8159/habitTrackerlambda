
# Habit Tracker - Serverless Backend

A high-performance, low-latency serverless backend optimized to run 100% within the **AWS Lambda** using **TypeScript**, **Serverless Framework (v3)**, and **AWS SDK v3**.

---

## 🏗️ Backend Structure

```mermaid
graph TD
    classDef client fill:#0d1117,stroke:#58a6ff,stroke-width:2px,color:#fff;
    classDef cloud fill:#1a1f2c,stroke:#ff9900,stroke-width:2px,color:#fff;
    classDef compute fill:#1f242e,stroke:#f5b041,stroke-width:2px,color:#fff;
    classDef database fill:#1c2833,stroke:#2e4053,stroke-width:2px,color:#fff;

    Client[Mobile Client <br> Expo App]:::client
    Gateway[AWS API Gateway <br> HTTP API]:::cloud
    
    subgraph Lambda_Functions [AWS Lambda ARM64]
        AuthHandler[auth.registerUser]:::compute
        GetHabitsHandler[habits.getHabits]:::compute
        CreateHabitHandler[habits.createHabit]:::compute
        CheckInHandler[habits.checkInHabit]:::compute
    end

    DynamoDB[(DynamoDB <br> HabitsTable)]:::database

    Client -->|HTTPS JSON| Gateway
    Gateway -->|POST /auth/register| AuthHandler
    Gateway -->|GET /habits| GetHabitsHandler
    Gateway -->|POST /habits/create| CreateHabitHandler
    Gateway -->|POST /habits/check-in| CheckInHandler

    AuthHandler -->|PutItem| DynamoDB
    GetHabitsHandler -->|Query| DynamoDB
    CreateHabitHandler -->|PutItem| DynamoDB
    CheckInHandler -->|UpdateItem| DynamoDB

```

---

## 🌐 Live API Endpoints

**Base URL:** `https://hg1iywighj.execute-api.ap-south-1.amazonaws.com`

* 🔗 [`POST` /auth/register](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/auth/register)
* Initial onboarding footprint creation.
* *Payload:* `{ "userId": "usr_7s", "email": "dev@example.com", "timezone": "Asia/Kolkata" }`


* 🔗 [`GET` /habits](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/habits)
* Retrieves all user habits for the masonry layout.
* *Headers:* `Authorization: Bearer <userId>`


* 🔗 [`POST` /habits/create](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/habits/create)
* Appends a new habit card.
* *Payload:* `{ "title": "Gym", "cardHeight": 210, "colors": ["#FF0844", "#FFB199"] }`


* 🔗 [`POST` /habits/check-in](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/habits/check-in)
* Atomic execution update layer handling streaks and progress increments.
* *Payload:* `{ "habitId": "hab_101" }`


* 🔗 [`PATCH` /habits/{habitId}](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/habits/{habitId})
* Update habit metadata (title, cardHeight, colors).
* *Payload (any of):* `{ "title": "New title", "cardHeight": 180, "colors": {"primary":"#FFF","secondary":"#000"} }`

* 🔗 [`DELETE` /habits/{habitId}](https://www.google.com/search?q=https://hg1iywighj.execute-api.ap-south-1.amazonaws.com/habits/{habitId})
* Remove a habit for the given user.
* `userId` must be provided via query param, request body or auth claims.

Example curl commands
```bash
# Patch habit
curl -X PATCH "https://<api>/habits/abc123?userId=550e8400-e29b-41d4-a716-446655440000" \
    -H "Content-Type: application/json" \
    -d '{"title":"Evening Walk","cardHeight":160}'

# Delete habit
curl -X DELETE "https://<api>/habits/abc123?userId=550e8400-e29b-41d4-a716-446655440000"
```



---
