# FlowNova Development Commands

# List all available commands
default:
    @just --list

# Initial project setup
setup:
    @echo "Setting up FlowNova project..."
    @just setup-backend
    @just setup-frontend
    @echo "✓ Setup complete!"

# Setup backend
setup-backend:
    @echo "Setting up backend..."
    @mkdir -p backend
    @echo "✓ Backend directory ready"

# Setup frontend
setup-frontend:
    @echo "Setting up frontend..."
    @mkdir -p frontend
    @cd frontend && npm init -y 2>/dev/null || true
    @echo "✓ Frontend directory ready"

# Start all services with Docker Compose
up:
    docker-compose up -d

# Stop all services
down:
    docker-compose down

# View logs from all services
logs:
    docker-compose logs -f

# View logs from specific service
logs-service service:
    docker-compose logs -f {{service}}

# Start backend development server
dev-backend:
    cd backend && uvicorn {{MODULE_PATH}} --reload --host 0.0.0.0 --port {{APP_PORT}}

# Start frontend development server
dev-frontend:
    cd frontend && npm run dev

# Start both backend and frontend in development mode
dev:
    @echo "Starting development environment..."
    @just up
    @echo "Services started. Run 'just dev-backend' and 'just dev-frontend' in separate terminals"

# Run backend tests
test-backend:
    cd backend && pytest -v

# Run frontend tests
test-frontend:
    cd frontend && npm test

# Run all tests
test:
    @just test-backend
    @just test-frontend

# Format backend code
fmt-backend:
    cd backend && black . && ruff check --fix .

# Format frontend code
fmt-frontend:
    cd frontend && npm run format || echo "Add format script to package.json"

# Format all code
fmt:
    @just fmt-backend
    @just fmt-frontend

# Lint backend code
lint-backend:
    cd backend && black --check . && ruff check . && mypy .

# Lint frontend code
lint-frontend:
    cd frontend && npm run lint || echo "Add lint script to package.json"

# Lint all code
lint:
    @just lint-backend
    @just lint-frontend

# Database migrations - create new migration
migrate-create name:
    cd backend && alembic revision --autogenerate -m "{{name}}"

# Database migrations - run pending migrations
migrate:
    cd backend && alembic upgrade head

# Database migrations - rollback one migration
migrate-rollback:
    cd backend && alembic downgrade -1

# Connect to PostgreSQL database
db-shell:
    PGPASSWORD={{POSTGRES_SUPERPASS}} psql -h localhost -p {{POSTGRES_PORT}} -U {{POSTGRES_SUPERUSER}} -d postgres

# Connect to Redis
redis-shell:
    redis-cli -p {{REDIS_PORT}}

# Clean up Docker volumes and containers
clean:
    docker-compose down -v
    @echo "✓ Cleaned up Docker resources"

# Clean up all generated files and caches
clean-all: clean
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
    find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    @echo "✓ Cleaned up all caches"

# View Grafana dashboard
grafana:
    @echo "Opening Grafana at http://localhost:3000"
    @echo "Username: {{GRAFANA_ADMIN_USER}}"
    @echo "Password: {{GRAFANA_ADMIN_PASSWORD}}"
    @open http://localhost:3000 || xdg-open http://localhost:3000 || true

# View LiteLLM UI
litellm:
    @echo "Opening LiteLLM at http://localhost:4000"
    @echo "Username: {{LITELLM_UI_USERNAME}}"
    @echo "Password: {{LITELLM_UI_PASSWORD}}"
    @open http://localhost:4000 || xdg-open http://localhost:4000 || true

# Check service health
health:
    @echo "Checking service health..."
    @curl -s http://localhost:4001/health/readiness > /dev/null && echo "✓ LiteLLM: healthy" || echo "✗ LiteLLM: unhealthy"
    @curl -s http://localhost:3000/api/health > /dev/null && echo "✓ Grafana: healthy" || echo "✗ Grafana: unhealthy"
    @curl -s http://localhost:3100/ready > /dev/null && echo "✓ Loki: healthy" || echo "✗ Loki: unhealthy"
    @PGPASSWORD={{POSTGRES_SUPERPASS}} pg_isready -h localhost -p {{POSTGRES_PORT}} -U {{POSTGRES_SUPERUSER}} > /dev/null && echo "✓ PostgreSQL: healthy" || echo "✗ PostgreSQL: unhealthy"
    @redis-cli -p {{REDIS_PORT}} ping > /dev/null && echo "✓ Redis: healthy" || echo "✗ Redis: unhealthy"
