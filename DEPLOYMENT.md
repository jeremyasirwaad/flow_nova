# FlowNova Deployment Guide

This guide will help you deploy FlowNova using Docker Compose with a single command.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Git

## Quick Start

### 1. Clone the Repository (if not already done)

```bash
git clone <your-repo-url>
cd flow_nova
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and replace all `changeme_*` values with secure passwords and keys:

```bash
# Use your preferred text editor
nano .env
# or
vim .env
```

**Important Security Notes:**
- Generate strong random passwords for all credentials
- Never commit your `.env` file to version control
- Change all default passwords before deploying to production

### 3. Start All Services

Start all services with a single command:

```bash
docker compose up -d
```

This will start:
- **PostgreSQL** - Database server
- **Redis** - Cache and queue backend
- **Loki** - Log aggregation
- **Grafana** - Monitoring dashboard
- **LiteLLM** - LLM proxy service
- **Backend** - FastAPI application
- **4x Workers** - Background job processors
- **Frontend** - React application

### 4. Verify Services

Check that all services are running:

```bash
docker compose ps
```

View logs for all services:

```bash
docker compose logs -f
```

View logs for a specific service:

```bash
docker compose logs -f backend
docker compose logs -f worker-1
docker compose logs -f frontend
```

## Access Points

Once all services are running, you can access:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3001 | - |
| Backend API | http://localhost:8000 | - |
| API Docs | http://localhost:8000/docs | - |
| Grafana | http://localhost:3000 | See `.env` |
| LiteLLM UI | http://localhost:4000 | See `.env` |

## Database Migrations

Run database migrations after the first startup:

```bash
# Option 1: Using just
just migrate

# Option 2: Using docker compose exec
docker compose exec backend alembic upgrade head
```

## Managing Services

### Stop All Services

```bash
docker compose down
```

### Stop and Remove Volumes (⚠️ This will delete all data)

```bash
docker compose down -v
```

### Restart a Specific Service

```bash
docker compose restart backend
docker compose restart worker-1
```

### Rebuild and Restart After Code Changes

```bash
docker compose up -d --build
```

### Scale Workers

To run more or fewer workers, edit `docker-compose.yml` and add/remove worker services, or use:

```bash
# This will start 8 workers
docker compose up -d --scale worker-1=8
```

## Monitoring

### Health Checks

Check service health:

```bash
# Backend health
curl http://localhost:8000/api/health

# LiteLLM health
curl http://localhost:4001/health/readiness
```

### View Real-time Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Multiple services
docker compose logs -f backend worker-1 worker-2
```

## Troubleshooting

### Services Not Starting

1. Check logs for errors:
   ```bash
   docker compose logs backend
   ```

2. Verify environment variables are set correctly:
   ```bash
   cat .env
   ```

3. Ensure ports are not already in use:
   ```bash
   lsof -i :8000  # Backend
   lsof -i :3001  # Frontend
   lsof -i :5432  # PostgreSQL
   ```

### Database Connection Issues

1. Check PostgreSQL is healthy:
   ```bash
   docker compose ps postgres
   ```

2. Test database connection:
   ```bash
   docker compose exec postgres psql -U flownova_admin -d flownova_app_db
   ```

### Worker Not Processing Jobs

1. Check worker logs:
   ```bash
   docker compose logs -f worker-1
   ```

2. Verify Redis connection:
   ```bash
   docker compose exec redis redis-cli ping
   ```

### Frontend Not Loading

1. Check frontend logs:
   ```bash
   docker compose logs frontend
   ```

2. Verify backend is accessible:
   ```bash
   curl http://localhost:8000/api/health
   ```

3. Check VITE_API_URL in `.env` is correct

## Production Deployment

For production deployment:

1. **Update Environment Variables:**
   - Set `ENVIRONMENT=production`
   - Set `DEBUG=false`
   - Use strong, unique passwords
   - Configure proper CORS origins in backend

2. **Enable HTTPS:**
   - Use a reverse proxy (nginx, traefik, etc.)
   - Configure SSL certificates
   - Update VITE_API_URL to use HTTPS

3. **Database Backups:**
   - Set up automated PostgreSQL backups
   - Store backups off-site

4. **Monitoring:**
   - Configure Grafana dashboards
   - Set up alerts for critical issues
   - Monitor disk space and resource usage

5. **Security:**
   - Restrict network access
   - Use Docker secrets for sensitive data
   - Keep all services updated
   - Regular security audits

## Useful Commands

```bash
# Using just (if available)
just up              # Start all services
just down            # Stop all services
just logs            # View all logs
just logs-service backend  # View backend logs
just migrate         # Run database migrations

# Using docker compose directly
docker compose up -d                # Start services
docker compose down                 # Stop services
docker compose ps                   # List services
docker compose logs -f              # View logs
docker compose exec backend bash    # Access backend shell
docker compose restart backend      # Restart backend
```

## Architecture

```
┌─────────────┐
│  Frontend   │ :3001
│  (React)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│  PostgreSQL │ :5432
│  (FastAPI)  │     └─────────────┘
└──────┬──────┘
       │           ┌─────────────┐
       ├──────────▶│    Redis    │ :6379
       │           └─────────────┘
       │           ┌─────────────┐
       └──────────▶│   LiteLLM   │ :4000
                   └─────────────┘
┌─────────────┐
│  Worker 1-4 │
│    (RQ)     │
└─────────────┘
       │           ┌─────────────┐
       └──────────▶│    Loki     │ :3100
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │   Grafana   │ :3000
                   └─────────────┘
```

## Support

For issues and questions:
1. Check the logs: `docker compose logs -f`
2. Review this documentation
3. Check GitHub issues
4. Contact the development team
