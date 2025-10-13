# FlowNova Backend

FastAPI backend with PostgreSQL, SQLAlchemy, RQ, and RQ-dashboard.

## Architecture

- **FastAPI**: Modern async web framework
- **SQLAlchemy**: ORM with async support
- **PostgreSQL**: Database
- **Redis**: Cache and message broker
- **RQ**: Background job queue
- **RQ-Dashboard**: Web UI for monitoring jobs
- **Alembic**: Database migrations

## Project Structure

```
backend/
├── app/
│   ├── core/           # Core configuration
│   │   ├── config.py   # Settings management
│   │   ├── database.py # Database setup
│   │   └── queue.py    # RQ queue configuration
│   ├── models/         # SQLAlchemy models
│   │   └── task.py     # Example Task model
│   ├── routes/         # API endpoints
│   │   ├── health.py   # Health checks
│   │   └── tasks.py    # Task management
│   ├── schemas/        # Pydantic schemas
│   │   └── task.py     # Task schemas
│   ├── workers/        # Background jobs
│   │   └── example_tasks.py
│   └── main.py         # FastAPI app
├── alembic/           # Database migrations
└── alembic.ini        # Alembic config

## Getting Started

### 1. Start Services

```bash
# Start PostgreSQL and Redis
just up
```

### 2. Run Backend

```bash
# Start FastAPI server
just run-backend
```

The API will be available at http://localhost:8000

### 3. Run Background Workers

```bash
# Start RQ worker in another terminal
just run-worker

# Or start all workers (default, high, low priority)
just run-workers
```

### 4. Monitor Jobs (Optional)

```bash
# Start RQ Dashboard in another terminal
just run-rq-dashboard
```

RQ Dashboard will be available at http://localhost:9181

### 5. Run Everything

```bash
# Start all services at once (API + Worker + Dashboard)
just dev-backend-full
```

## API Endpoints

### Health Checks
- `GET /` - Root endpoint
- `GET /api/health` - Basic health check
- `GET /api/health/ready` - Readiness check (DB + Redis)

### Tasks
- `POST /api/tasks` - Create a new task (enqueues background job)
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/{id}` - Get specific task
- `DELETE /api/tasks/{id}` - Delete task

### Interactive Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database Migrations

```bash
# Create a new migration
just migrate-create "migration_name"

# Run migrations
just migrate

# Rollback one migration
just migrate-rollback
```

## Development Commands

```bash
# Format code
just fmt-backend

# Lint code
just lint-backend

# Run tests
just test-backend

# Database shell
just db-shell

# Redis shell
just redis-shell
```

## Environment Variables

Configuration is loaded from `.env` in the project root:

- `POSTGRES_SUPERUSER` - PostgreSQL admin user
- `POSTGRES_SUPERPASS` - PostgreSQL admin password
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)
- `APP_DB` - Application database name
- `APP_DB_PASSWORD` - Application database password
- `REDIS_PORT` - Redis port (default: 6379)

## Example: Creating a Background Task

```python
from app.core.queue import get_queue

# Enqueue a job
queue = get_queue("default")
job = queue.enqueue(
    my_function,
    arg1="value",
    job_timeout="5m"
)

# Check job status
job.get_status()  # 'queued', 'started', 'finished', 'failed'
```

## Queues

Three priority queues are available:
- `high` - High priority jobs
- `default` - Normal priority jobs
- `low` - Low priority jobs

Start workers for specific queues:
```bash
just run-worker high
just run-worker default
just run-worker low
```
