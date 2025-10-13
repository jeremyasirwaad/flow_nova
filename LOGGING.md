# Logging Setup with Loki

This project uses **Loguru** for logging with integration to **Grafana Loki** for centralized log aggregation and visualization.

## Architecture

```
FastAPI App → Loguru → Custom Loki Handler → Loki (port 3100) → Grafana (port 3000)
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Logging configuration
LOKI_URL=http://localhost:3100/loki/api/v1/push
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Default Settings

If not configured, the following defaults are used:
- **LOKI_URL**: `http://localhost:3100/loki/api/v1/push`
- **LOG_LEVEL**: `INFO`

## Features

### 1. Console Logging
All logs are output to the console with color-coded formatting:
```
2025-10-13 15:30:45.123 | INFO     | app.main:lifespan:28 | 🚀 Starting FlowNova
```

### 2. Loki Integration
Logs are automatically sent to Loki with the following labels:
- `app`: Application name (e.g., `flownova`, `flownova_worker`)
- `environment`: Environment (e.g., `dev`, `prod`)
- `level`: Log level (e.g., `info`, `warning`, `error`)
- `logger`: Module name
- `file`: Source file name
- `function`: Function name

### 3. HTTP Request Logging
All HTTP requests are automatically logged with:
- Request method and path
- Client IP address
- Response status code
- Request duration

Example:
```
HTTP GET /api/health -> 200 (0.003s)
```

## Usage

### In FastAPI Routes

```python
from loguru import logger

@router.get("/example")
async def example_endpoint():
    logger.info("Processing example request")

    try:
        # Your code here
        result = some_operation()
        logger.debug(f"Operation result: {result}")
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Error in example endpoint: {e}")
        logger.exception("Full traceback:")  # Includes stack trace
        raise
```

### In Background Workers

The RQ worker is already configured with Loki logging. Just use loguru:

```python
from loguru import logger

def my_task(param):
    logger.info(f"Starting task with param: {param}")

    try:
        # Task logic
        logger.debug("Processing step 1")
        # ...
        logger.info("Task completed successfully")

    except Exception as e:
        logger.error(f"Task failed: {e}")
        raise
```

### Custom Logging with Extra Context

```python
logger.info(
    "User action performed",
    extra={
        "user_id": user.id,
        "action": "login",
        "ip_address": request.client.host,
    }
)
```

## Viewing Logs

### 1. In Grafana

1. Open Grafana: http://localhost:3000
2. Default credentials: `admin` / `admin_password` (check your `.env`)
3. Go to **Explore** (compass icon)
4. Select **Loki** as the data source
5. Use LogQL queries to filter logs:

```logql
# All logs from the app
{app="flownova"}

# Only error logs
{app="flownova"} |= "level=error"

# HTTP requests taking more than 1 second
{app="flownova"} |= "HTTP" | json | duration > 1

# Logs from specific file
{app="flownova", file="tasks.py"}

# Worker logs
{app="flownova_worker"}
```

### 2. Using LogCLI (optional)

```bash
# Install logcli
brew install logcli  # macOS
# or
go install github.com/grafana/loki/cmd/logcli@latest

# Query logs
logcli query '{app="flownova"}'

# Follow logs in real-time
logcli query --tail '{app="flownova"}'
```

## Log Levels

Use appropriate log levels:

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages (default)
- **WARNING**: Warning messages for potentially harmful situations
- **ERROR**: Error messages for failures
- **CRITICAL**: Critical messages for severe failures

```python
logger.debug("Detailed debug info")
logger.info("Normal operation")
logger.warning("Something unexpected happened")
logger.error("An error occurred")
logger.critical("Critical system failure")
```

## Troubleshooting

### Logs not appearing in Loki

1. Check if Loki is running:
```bash
curl http://localhost:3100/ready
```

2. Check Loki logs:
```bash
docker logs flownova_loki
```

3. Verify LOKI_URL in your `.env` or config

4. Test the Loki endpoint directly:
```bash
curl -X POST http://localhost:3100/loki/api/v1/push \
  -H "Content-Type: application/json" \
  -d '{
    "streams": [
      {
        "stream": {"app": "test", "level": "info"},
        "values": [["'$(date +%s)000000000'", "test message"]]
      }
    ]
  }'
```

### High volume of logs

Adjust the log level to reduce noise:
```bash
LOG_LEVEL=WARNING  # Only warnings and errors
```

### Disable Loki (console only)

Set `LOKI_URL` to empty or null:
```bash
LOKI_URL=
```

## Performance

- The Loki handler uses **fire-and-forget** HTTP requests to avoid blocking application code
- Failed log deliveries are silently ignored to prevent cascading failures
- Connection timeout is set to 5 seconds by default

## Docker Compose Integration

When running in Docker, update your service configuration:

```yaml
backend:
  environment:
    - LOKI_URL=http://loki:3100/loki/api/v1/push
  depends_on:
    - loki
```

Note: Use service name (`loki`) instead of `localhost` when running in Docker.
