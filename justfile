# FlowNova Development Commands

# List all available commands
default:
    @just --list

# Start all services with Docker Compose
up:
    docker-compose up -d

# Stop all services
down:
    docker-compose down¯

# View logs from all services
logs:
    docker-compose logs -f

# View logs from specific service
logs-service service:
    docker-compose logs -f {{service}}

# Run the backend server
run-backend:
    cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations - create new migration
migrate-create name:
    cd backend && alembic revision --autogenerate -m "{{name}}"

# Database migrations - run pending migrations
migrate:
    cd backend && alembic upgrade head

# Database migrations - rollback one migration
migrate-rollback:
    cd backend && alembic downgrade -1

# Database migrations - show current version
migrate-current:
    cd backend && alembic current

# Database migrations - show history
migrate-history:
    cd backend && alembic history





