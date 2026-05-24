# System Architecture Diagram

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["🌐 Web Browser"]
        MOBILE["📱 Mobile App"]
        DESKTOP["🖥️ Desktop App"]
    end

    subgraph "API Layer"
        APIGW["⚡ API Gateway<br/>HTTP API"]
    end

    subgraph "Compute Layer"
        LB1["🔷 Lambda: registerUser<br/>POST /auth/register"]
        LB2["🔷 Lambda: getHabits<br/>GET /habits"]
        LB3["🔷 Lambda: createHabit<br/>POST /habits/create"]
        LB4["🔷 Lambda: checkInHabit<br/>POST /habits/check-in"]
    end

    subgraph "Database Layer"
        DB["🗄️ DynamoDB<br/>Single-Table Design<br/>On-Demand Billing"]
        GSI["📑 Global Secondary Index<br/>usernameIndex"]
    end

    subgraph "Monitoring"
        LOGS["📊 CloudWatch Logs"]
        METRICS["📈 CloudWatch Metrics"]
    end

    WEB -->|HTTPS| APIGW
    MOBILE -->|HTTPS| APIGW
    DESKTOP -->|HTTPS| APIGW

    APIGW -->|POST /auth/register| LB1
    APIGW -->|GET /habits| LB2
    APIGW -->|POST /habits/create| LB3
    APIGW -->|POST /habits/check-in| LB4

    LB1 -->|GetItem, Query, PutItem| DB
    LB2 -->|Query| DB
    LB3 -->|PutItem| DB
    LB4 -->|UpdateItem| DB

    DB -->|Query by username| GSI

    LB1 -->|Log| LOGS
    LB2 -->|Log| LOGS
    LB3 -->|Log| LOGS
    LB4 -->|Log| LOGS

    LOGS -->|Metrics| METRICS

    style WEB fill:#e1f5ff
    style MOBILE fill:#e1f5ff
    style DESKTOP fill:#e1f5ff
    style APIGW fill:#fff3e0
    style LB1 fill:#f3e5f5
    style LB2 fill:#f3e5f5
    style LB3 fill:#f3e5f5
    style LB4 fill:#f3e5f5
    style DB fill:#e8f5e9
    style GSI fill:#e8f5e9
    style LOGS fill:#fce4ec
    style METRICS fill:#fce4ec
```

---

## Data Flow - User Registration

```mermaid
sequenceDiagram
    participant Client as Client App
    participant APIGW as API Gateway
    participant Lambda as registerUser Handler
    participant DDB as DynamoDB
    participant CW as CloudWatch

    Client->>APIGW: POST /auth/register<br/>{username, email}
    APIGW->>Lambda: Invoke with body
    Lambda->>Lambda: Validate email format
    Lambda->>DDB: Query GSI by username
    DDB-->>Lambda: Not found (unique)
    Lambda->>Lambda: Generate userId (UUID)
    Lambda->>DDB: PutItem<br/>PK=USER#{userId}<br/>SK=PROFILE
    DDB-->>Lambda: Success
    Lambda->>CW: Log success
    Lambda-->>APIGW: {userId, username, email, createdAt}
    APIGW-->>Client: 201 Created
```

---

## Data Flow - Habit Creation

```mermaid
sequenceDiagram
    participant Client as Client App
    participant APIGW as API Gateway
    participant Lambda as createHabit Handler
    participant DDB as DynamoDB
    participant CW as CloudWatch

    Client->>APIGW: POST /habits/create<br/>{userId, title, cardHeight, colors}
    APIGW->>Lambda: Invoke with body
    Lambda->>Lambda: Validate all fields
    Lambda->>Lambda: Generate habitId
    Lambda->>DDB: PutItem<br/>PK=USER#{userId}<br/>SK=HABIT#{habitId}<br/>progress=0, streak=0
    DDB-->>Lambda: Success
    Lambda->>CW: Log habit created
    Lambda-->>APIGW: {habitId, title, progress, streakCount, ...}
    APIGW-->>Client: 201 Created
```

---

## Data Flow - Get Habits

```mermaid
sequenceDiagram
    participant Client as Client App
    participant APIGW as API Gateway
    participant Lambda as getHabits Handler
    participant DDB as DynamoDB
    participant CW as CloudWatch

    Client->>APIGW: GET /habits?userId={userId}
    APIGW->>Lambda: Invoke with query params
    Lambda->>Lambda: Extract userId
    Lambda->>DDB: Query<br/>PK=USER#{userId}<br/>SK begins_with HABIT#
    DDB-->>Lambda: [habit1, habit2, habit3, ...]
    Lambda->>CW: Log query success
    Lambda-->>APIGW: {habits: [...], count: N}
    APIGW-->>Client: 200 OK
```

---

## Data Flow - Check-In (Atomic Operation)

```mermaid
sequenceDiagram
    participant Client as Client App
    participant APIGW as API Gateway
    participant Lambda as checkInHabit Handler
    participant DDB as DynamoDB
    participant CW as CloudWatch

    Client->>APIGW: POST /habits/check-in<br/>{userId, habitId}
    APIGW->>Lambda: Invoke with body
    Lambda->>Lambda: Validate inputs
    Lambda->>DDB: GetItem to fetch habit
    DDB-->>Lambda: {progress, streakCount, lastCheckIn, ...}
    
    Lambda->>Lambda: Check 48-hour gap
    alt Gap > 48 hours
        Lambda->>Lambda: Reset streakCount = 1
    end
    
    Lambda->>Lambda: Calculate new progress<br/>progress += 0.25
    alt Progress >= 1.0
        Lambda->>Lambda: Reset progress = 0<br/>Increment streakCount++
    end
    
    Lambda->>DDB: UpdateCommand (ATOMIC)<br/>SET progress, streakCount, lastCheckIn
    DDB-->>Lambda: {Updated attributes}
    
    Lambda->>CW: Log check-in success
    Lambda-->>APIGW: {habitId, progress, streakCount, completed, ...}
    APIGW-->>Client: 200 OK
```

---

## DynamoDB Single-Table Design

```mermaid
graph LR
    subgraph "HabitsTable"
        subgraph "User Items"
            U1["PK: USER#550e8400<br/>SK: PROFILE<br/>userId, username, email<br/>createdAt, updatedAt"]
        end
        
        subgraph "Habit Items"
            H1["PK: USER#550e8400<br/>SK: HABIT#abc123<br/>habitId, title, colors<br/>progress, streakCount<br/>lastCheckIn, timestamps"]
            H2["PK: USER#550e8400<br/>SK: HABIT#xyz789<br/>habitId, title, colors<br/>progress, streakCount<br/>lastCheckIn, timestamps"]
        end
        
        subgraph "Global Secondary Index"
            GSI1["Index: usernameIndex<br/>PK: username<br/>Projection: ALL<br/>For username lookups"]
        end
    end

    U1 -.->|Query by username| GSI1
    style U1 fill:#c8e6c9
    style H1 fill:#a5d6a7
    style H2 fill:#a5d6a7
    style GSI1 fill:#81c784
```

---

## Lambda Function Interaction

```mermaid
graph TB
    subgraph "AWS Lambda Container (Shared)"
        INIT["🔄 Initialization<br/>- Load DynamoDB client<br/>- Load AWS SDK<br/>- Import helpers"]
        
        subgraph "Handlers"
            AUTH["🔑 auth.ts<br/>registerUser"]
            HABITS["📋 habits.ts<br/>getHabits<br/>createHabit<br/>checkInHabit"]
        end
        
        subgraph "Utilities"
            UTILS["⚙️ dynamodb.ts<br/>- dynamodbClient<br/>- generateId()<br/>- Database operations<br/>- Response helpers"]
            TYPES["📝 types/index.ts<br/>- User interface<br/>- Habit interface<br/>- Request/Response types"]
        end
    end

    INIT -->|Uses| UTILS
    AUTH -->|Uses| UTILS
    HABITS -->|Uses| UTILS
    AUTH -->|Implements| TYPES
    HABITS -->|Implements| TYPES
    UTILS -->|References| TYPES

    style INIT fill:#fff9c4
    style AUTH fill:#f3e5f5
    style HABITS fill:#f3e5f5
    style UTILS fill:#e0f2f1
    style TYPES fill:#f1f8e9
```

---

## Deployment Pipeline

```mermaid
graph LR
    subgraph "Local Development"
        CODE["💻 Code Changes<br/>src/handlers/<br/>src/utils/<br/>src/types/"]
        TEST["🧪 Testing<br/>npm run type-check<br/>npm run lint"]
    end

    subgraph "Git Repository"
        GIT["🔗 GitHub<br/>Commit & Push<br/>to main branch"]
    end

    subgraph "CI/CD Pipeline"
        CI["⚙️ GitHub Actions<br/>- Checkout<br/>- Setup Node.js<br/>- npm ci<br/>- Configure AWS<br/>- Deploy"]
    end

    subgraph "AWS Infrastructure"
        SLS["📦 Serverless Framework<br/>serverless deploy --stage prod"]
        CFN["☁️ CloudFormation<br/>Create/Update Stack"]
        LAMBDA["🔷 AWS Lambda<br/>4 Functions"]
        APIGW2["⚡ API Gateway<br/>HTTP API"]
        DDB2["🗄️ DynamoDB<br/>HabitsTable"]
    end

    CODE -->|Commit| TEST
    TEST -->|Push| GIT
    GIT -->|Trigger| CI
    CI -->|Execute| SLS
    SLS -->|Deploy via| CFN
    CFN -->|Create/Update| LAMBDA
    CFN -->|Create/Update| APIGW2
    CFN -->|Create/Update| DDB2

    style CODE fill:#e3f2fd
    style TEST fill:#f3e5f5
    style GIT fill:#fce4ec
    style CI fill:#fff3e0
    style SLS fill:#e0f2f1
    style CFN fill:#c8e6c9
    style LAMBDA fill:#f3e5f5
    style APIGW2 fill:#fff3e0
    style DDB2 fill:#c8e6c9
```

---

## Request/Response CORS Flow

```mermaid
graph TB
    CLIENT["Client Application<br/>(Web/Mobile/Desktop)"]
    
    CLIENT -->|HTTP OPTIONS<br/>Preflight Request| APIGW["API Gateway<br/>HTTP API"]
    
    APIGW -->|CORS Headers<br/>Access-Control-Allow-*| CLIENT
    
    CLIENT -->|HTTP POST/GET<br/>with body/params| APIGW
    
    APIGW -->|Invoke Lambda<br/>with event| LAMBDA["Lambda Function<br/>Execution"]
    
    LAMBDA -->|Process Request<br/>Validate & Query DynamoDB| LAMBDA
    
    LAMBDA -->|Return Response<br/>with CORS Headers| APIGW
    
    APIGW -->|HTTP 200/201/400/500<br/>+ CORS Headers| CLIENT
    
    style CLIENT fill:#e1f5ff
    style APIGW fill:#fff3e0
    style LAMBDA fill:#f3e5f5
```

---

## Error Handling Flow

```mermaid
graph TD
    REQ["Client Request"]
    
    REQ -->|Parse JSON| PARSE{Valid JSON?}
    
    PARSE -->|No| ERR400["400 Bad Request<br/>Invalid JSON"]
    PARSE -->|Yes| VALIDATE{Validate Fields}
    
    VALIDATE -->|No| ERR400B["400 Bad Request<br/>Missing/Invalid fields"]
    VALIDATE -->|Yes| QUERY{Query DynamoDB}
    
    QUERY -->|Error| ERR500["500 Server Error<br/>Database error"]
    QUERY -->|Not Found| ERR404["404 Not Found<br/>Resource not found"]
    QUERY -->|Found| SUCCESS["200 OK<br/>Return data"]
    
    ERR400 -->|CORS Headers| RESPONSE["Response to Client"]
    ERR400B -->|CORS Headers| RESPONSE
    ERR500 -->|CORS Headers| RESPONSE
    ERR404 -->|CORS Headers| RESPONSE
    SUCCESS -->|CORS Headers| RESPONSE
    
    RESPONSE -->|Log Event| LOGS["CloudWatch Logs"]
    
    style REQ fill:#e3f2fd
    style PARSE fill:#e3f2fd
    style VALIDATE fill:#e3f2fd
    style QUERY fill:#e3f2fd
    style ERR400 fill:#ffcdd2
    style ERR400B fill:#ffcdd2
    style ERR404 fill:#ffcdd2
    style ERR500 fill:#b71c1c
    style SUCCESS fill:#c8e6c9
    style RESPONSE fill:#fff3e0
    style LOGS fill:#fce4ec
```

---

## Infrastructure Components

```mermaid
graph TB
    subgraph "AWS Account"
        subgraph "Compute"
            LAMBDA1["Lambda: registerUser<br/>512MB, 30s timeout"]
            LAMBDA2["Lambda: getHabits<br/>512MB, 30s timeout"]
            LAMBDA3["Lambda: createHabit<br/>512MB, 30s timeout"]
            LAMBDA4["Lambda: checkInHabit<br/>512MB, 30s timeout"]
        end
        
        subgraph "Networking"
            APIGW["API Gateway (HTTP)<br/>Base: api.{region}.amazonaws.com<br/>CORS: Enabled"]
        end
        
        subgraph "Storage"
            DDB["DynamoDB Table: HabitsTable<br/>Billing: On-Demand<br/>Replication: Single Region"]
        end
        
        subgraph "Security & Identity"
            IAM["IAM Role<br/>Allow: DynamoDB Query/Get/Put/Update/Delete<br/>Deny: Everything else"]
        end
        
        subgraph "Monitoring"
            CW["CloudWatch<br/>Logs: /aws/lambda/...<br/>Metrics: Function invocations/duration/errors"]
        end
    end

    APIGW -->|Invoke| LAMBDA1
    APIGW -->|Invoke| LAMBDA2
    APIGW -->|Invoke| LAMBDA3
    APIGW -->|Invoke| LAMBDA4

    LAMBDA1 -->|Assume Role| IAM
    LAMBDA2 -->|Assume Role| IAM
    LAMBDA3 -->|Assume Role| IAM
    LAMBDA4 -->|Assume Role| IAM

    LAMBDA1 -->|Query/Put| DDB
    LAMBDA2 -->|Query| DDB
    LAMBDA3 -->|Put| DDB
    LAMBDA4 -->|Update| DDB

    LAMBDA1 -->|Write Logs| CW
    LAMBDA2 -->|Write Logs| CW
    LAMBDA3 -->|Write Logs| CW
    LAMBDA4 -->|Write Logs| CW

    style LAMBDA1 fill:#f3e5f5
    style LAMBDA2 fill:#f3e5f5
    style LAMBDA3 fill:#f3e5f5
    style LAMBDA4 fill:#f3e5f5
    style APIGW fill:#fff3e0
    style DDB fill:#c8e6c9
    style IAM fill:#ffe0b2
    style CW fill:#fce4ec
```

---

**Architecture Version**: 1.0.0  
**Generated**: May 2024
