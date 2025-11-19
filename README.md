# Activity Log Listener Service

A NestJS microservice that listens to activity log events broadcasted via Redis and persists them to both MariaDB database and Elasticsearch. This service is part of a distributed logging system using the `nestjs-session-log` library.

## Description

This listener service subscribes to activity log events emitted by producer applications through Redis pub/sub. It automatically captures and stores user activity data including request URLs, user IDs, HTTP methods, and response times in:
- **MariaDB**: For relational queries and structured storage
- **Elasticsearch**: For full-text search, analytics, and real-time data exploration

## Architecture

```
Producer App(s) → Redis Pub/Sub → Listener App → MariaDB
                 (activity-log-events)        → Elasticsearch
```

This listener service subscribes to activity log events emitted by producer applications through Redis pub/sub. It automatically captures and stores user activity data including request URLs, user IDs, HTTP methods, and response times.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MariaDB/MySQL database server
- Redis server (for event broadcasting)
- Elasticsearch (v7.x for full-text search and analytics)

## Project Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=hanaphi
DB_PASSWORD=your_password_here
DB_NAME=atlas_db

# Redis Configuration (for receiving events)
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch Configuration (for search and analytics)
ELASTICSEARCH_NODE=http://localhost:9200

# Application Port
PORT=3001
```

### 3. Database Setup

The application uses TypeORM with `synchronize: true`, which automatically creates tables. Ensure your MariaDB/MySQL server is running and the database exists:

```sql
CREATE DATABASE IF NOT EXISTS atlas_db;
```

The `activity_logs` table will be created automatically on first run with the following schema:
- `id` (UUID, Primary Key)
- `timestamp` (DateTime)
- `userId` (String)
- `url` (String)
- `processType` (String - HTTP method)
- `responseTimeMs` (Number)

### 4. Redis Setup

#### Local Development (Docker)
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### Kubernetes
Use the provided Redis deployment in your cluster, or ensure the `redis-service` is accessible.

### 5. Elasticsearch Setup

#### Local Development (Docker)
```bash
# Elasticsearch 7.x (compatible with current setup)
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:7.17.10
```

#### Verify Elasticsearch is Running
```bash
curl http://localhost:9200
```

You should see JSON output with Elasticsearch version information.

#### Kubernetes
```yaml
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch-service
spec:
  ports:
    - port: 9200
  selector:
    app: elasticsearch
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elasticsearch-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
        - name: elasticsearch
          image: docker.elastic.co/elasticsearch/elasticsearch:7.17.10
          ports:
            - containerPort: 9200
          env:
            - name: discovery.type
              value: "single-node"
            - name: xpack.security.enabled
              value: "false"
```

## Running the Application

```bash
# Development mode with watch
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The listener will start on port `3001` (or the port specified in your `.env` file).

## Setting Up Producer Applications

To send activity logs to this listener, configure your producer NestJS applications:

### 1. Install Required Packages

```bash
npm install nestjs-session-log @nestjs/event-emitter nestjs-cls ioredis
```

### 2. Configure Producer App Module

```typescript
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { LogModule, ActivityLogInterceptor } from 'nestjs-session-log';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    // Required for CLS context
    ClsModule.forRoot({
      middleware: { mount: true },
    }),
    
    // Required for event emission
    EventEmitterModule.forRoot(),
    
    // Configure LogModule with Redis
    LogModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      broadcast: true, // Enable Redis broadcasting
    }),
    
    // Your other modules...
  ],
  providers: [
    // Auto-logs all HTTP requests
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule {}
```

### 3. Set User Context

Create middleware or guard to set the user ID in CLS:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private readonly clsService: ClsService) {}

  use(req: any, res: any, next: () => void) {
    // Extract userId from JWT, session, or headers
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    
    // Store in CLS for interceptor to use
    this.clsService.set('userId', userId);
    
    next();
  }
}
```

## Architecture

```
Producer App(s) → Redis Pub/Sub → Listener App → MariaDB
                 (activity-log-events channel)
```

### Components

- **ActivityLogListener**: Subscribes to `ACTIVITY_LOG_EVENT` and persists logs to both MariaDB and Elasticsearch
- **SearchModule**: Manages Elasticsearch connection and service
- **LogModule**: Manages Redis subscription and event broadcasting
- **BroadcastlistenerModule**: Contains listener logic and database repository
- **ActivityLog Entity**: TypeORM entity for activity logs table

## Event Payload Structure

```typescript
{
  userId: string;          // User identifier
  url: string;            // Request URL
  processType: string;    // HTTP method (GET, POST, etc.)
  responseTimeMs: number; // Request duration in milliseconds
}
```

## Monitoring

### View Logs
```bash
# Development mode shows all activity
npm run start:dev
```

Expected output when activity is logged:
```
[ActivityLogListener] Caught log event! User: user-123, URL: /api/endpoint
[ActivityLogListener] Saved to MariaDB
[ActivityLogListener] Saved to Elasticsearch
```

### Check MariaDB Database
```sql
-- View recent activity logs
SELECT * FROM activity_logs 
ORDER BY timestamp DESC 
LIMIT 100;

-- View logs by user
SELECT * FROM activity_logs 
WHERE userId = 'user-id-here'
ORDER BY timestamp DESC;
```

### Check Elasticsearch

#### View all activity logs
```bash
curl http://localhost:9200/activity-logs/_search?pretty
```

#### Search by user ID
```bash
curl -X GET "localhost:9200/activity-logs/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "query": {
    "match": {
      "userId": "user-123"
    }
  }
}'
```

#### Search by URL pattern
```bash
curl -X GET "localhost:9200/activity-logs/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "query": {
    "wildcard": {
      "url": "*api*"
    }
  }
}'
```

#### Count total documents
```bash
curl http://localhost:9200/activity-logs/_count?pretty
```

#### Get index information
```bash
curl http://localhost:9200/activity-logs?pretty
```

#### View all indices
```bash
curl http://localhost:9200/_cat/indices?v
```

## Kubernetes Deployment

### 1. Database Deployment

The listener requires access to the MariaDB service defined in your cluster:

```yaml
# Ensure this service is accessible
apiVersion: v1
kind: Service
metadata:
  name: atlas-db-service
spec:
  ports:
    - port: 3306
  selector:
    app: mariadb
```

### 2. Redis Deployment

Ensure Redis is deployed and accessible:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  ports:
    - port: 6379
  selector:
    app: redis
```

### 3. Listener Deployment

Update environment variables in `k8s/listener-deployment.yaml`:

```yaml
env:
  - name: DB_HOST
    value: "atlas-db-service"
  - name: DB_USERNAME
    value: "hanaphi"
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: mariadb-secret
        key: MYSQL_PASSWORD
  - name: DB_NAME
    value: "atlas_db"
  - name: REDIS_HOST
    value: "redis-service"
  - name: REDIS_PORT
    value: "6379"
  - name: ELASTICSEARCH_NODE
    value: "http://elasticsearch-service:9200"
```

Deploy:
```bash
kubectl apply -f k8s/listener-deployment.yaml
```

## Testing

### 1. Verify Listener is Running

```bash
# Check logs for Redis subscription
kubectl logs -f deployment/listener-deployment

# Should see:
# [LogRedisService] 📡 Subscribed to Redis channel: activity-log-events
```

### 2. Make Request to Producer App

```bash
curl http://producer-app-url/api/endpoint
```

### 3. Check Listener Logs

```bash
# Should see:
# [ActivityLogListener] Caught log event! User: user-123, URL: /api/endpoint
```

### 4. Verify Database Entry

```sql
SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 1;
```

### 5. Verify Elasticsearch Entry

```bash
curl http://localhost:9200/activity-logs/_search?pretty
```

## Troubleshooting

### Listener Not Receiving Events

1. **Check Redis connection**: Ensure both producer and listener use the same Redis instance
2. **Verify Redis logs**: `docker logs redis` or `kubectl logs redis-pod`
3. **Check broadcast setting**: Producer must have `broadcast: true` in LogModule config
4. **Network connectivity**: Ensure listener can reach Redis (test with `redis-cli ping`)

### Database Connection Issues

1. **Check credentials**: Verify DB_PASSWORD matches MariaDB secret
2. **Host resolution**: In Kubernetes, use service name `atlas-db-service`, not `localhost`
3. **Port accessibility**: Ensure MariaDB port 3306 is accessible
4. **Database exists**: Manually create database if needed

### Missing Packages

If you see `Cannot find module 'ioredis'`:
```bash
npm install ioredis
```

If you see `Cannot find module 'mysql2'`:
```bash
npm install mysql2
```

If you see `Cannot find module '@elastic/elasticsearch'`:
```bash
npm install @elastic/elasticsearch@7
```

### Elasticsearch Connection Issues

1. **Verify Elasticsearch is running**:
   ```bash
   curl http://localhost:9200
   ```

2. **Check Elasticsearch logs**:
   ```bash
   docker logs elasticsearch
   ```

3. **Ensure correct version**: This app uses Elasticsearch 7.x. Check compatibility:
   ```bash
   npm list @nestjs/elasticsearch @elastic/elasticsearch
   ```

### Elasticsearch Index Issues

If index is read-only or has errors:
```bash
# Unlock read-only indices
curl -X PUT "localhost:9200/_all/_settings?pretty" -H 'Content-Type: application/json' -d'
{
  "index.blocks.read_only_allow_delete": null
}'

# Check disk space watermark
curl -X PUT "localhost:9200/_cluster/settings?pretty" -H 'Content-Type: application/json' -d'
{
  "transient": {
    "cluster.routing.allocation.disk.threshold_enabled": false
  }
}'
```

## Development

```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

```bash
$ npm install
```

## Compile and run the project

# Format code
npm run format
```

## License

This project is [UNLICENSED](LICENSE).

## Support

For issues and questions, please refer to the [NestJS documentation](https://docs.nestjs.com) or raise an issue in the project repository.
