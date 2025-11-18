# Docker Deployment Guide

## Overview

This guide provides instructions for deploying the Tree-sitter API server using Docker. The project includes a multi-stage Dockerfile optimized for production deployment.

## Prerequisites

- Docker (v20.10+)
- Docker Compose (v1.29+)
- 2GB+ available disk space
- 1GB+ available RAM

## Quick Start

### Build the Docker Image

```bash
docker build -t tree-sitter-api:latest .
```

### Run as a Container

```bash
docker run -d \
  --name tree-sitter-api \
  -p 4001:4001 \
  -e NODE_ENV=production \
  -e MAX_MEMORY_MB=512 \
  tree-sitter-api:latest
```

### Using Docker Compose

The easiest way to deploy is using Docker Compose:

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f tree-sitter-api

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

All environment variables from `.env.example` can be passed when running the container:

**Server Configuration:**
- `PORT` (default: 4001) - Server port
- `HOST` (default: 0.0.0.0) - Server host
- `NODE_ENV` (default: development) - Environment mode

**Memory Configuration:**
- `MAX_MEMORY_MB` (default: 512) - Maximum memory in MB
- `MEMORY_WARNING_THRESHOLD` (default: 300) - Warning threshold
- `MEMORY_CRITICAL_THRESHOLD` (default: 450) - Critical threshold

**Request Configuration:**
- `REQUEST_TIMEOUT` (default: 30000) - Request timeout in ms
- `MAX_REQUEST_SIZE` (default: 5mb) - Maximum request body size
- `MAX_CONCURRENT_REQUESTS` (default: 10) - Max concurrent requests

**Logging Configuration:**
- `LOG_LEVEL` (default: info) - Log level (debug, info, warn, error, fatal)
- `ENABLE_LOG_TIMESTAMP` (default: true) - Enable timestamps in logs
- `ENABLE_LOG_MODULE` (default: true) - Enable module names in logs

**Security:**
- `ENABLE_RATE_LIMITING` (default: true) - Enable rate limiting
- `CORS_ORIGIN` (default: *) - CORS allowed origins
- `ENABLE_HELMET` (default: true) - Enable Helmet security headers
- `TRUST_PROXY` (default: false) - Trust proxy headers

**Parser Configuration:**
- `PARSER_POOL_SIZE` (default: 3) - Number of parser instances
- `MAX_CODE_LENGTH` (default: 102400) - Maximum code length
- `QUERY_TIMEOUT` (default: 30000) - Query timeout in ms

### Using Environment Files

Create a `.env` file with your configuration:

```bash
docker-compose --env-file .env up -d
```

Or pass individual variables:

```bash
docker run -d \
  --name tree-sitter-api \
  -p 4001:4001 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=debug \
  -e MAX_MEMORY_MB=1024 \
  tree-sitter-api:latest
```

## Docker Compose Configuration

The `docker-compose.yml` includes:

- **Service Container**: Main application service
- **Port Mapping**: Port 4001 exposed to host
- **Health Checks**: Automated health monitoring
- **Resource Limits**: CPU and memory constraints
- **Logging Configuration**: Structured logging with rotation
- **Auto-restart Policy**: Automatic container restart on failure

### Resource Limits

The default configuration sets:
- **CPU Limit**: 2 cores
- **Memory Limit**: 1GB
- **Memory Reservation**: 512MB

Adjust these values in `docker-compose.yml` based on your infrastructure:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'           # Adjust CPU cores
      memory: 2G          # Adjust memory limit
    reservations:
      cpus: '2'
      memory: 1G
```

## Health Checks

The container includes a health check endpoint at `/health`:

```bash
# Check container health
docker ps | grep tree-sitter-api

# View health status details
docker inspect --format='{{json .State.Health}}' tree-sitter-api | jq
```

## Managing Containers

### View Logs

```bash
# Real-time logs
docker-compose logs -f tree-sitter-api

# Last 100 lines
docker-compose logs --tail=100 tree-sitter-api

# Logs with timestamps
docker-compose logs -t tree-sitter-api
```

### Execute Commands

```bash
# Interactive shell
docker exec -it tree-sitter-api sh

# Run a command
docker exec tree-sitter-api npm run test
```

### Update Service

```bash
# Rebuild image
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build tree-sitter-api
```

### Stop and Remove

```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove unused images
docker image prune
```

## Production Deployment

### 1. Build Production Image

```bash
docker build --target=production -t tree-sitter-api:v1.0.0 .
```

### 2. Tag for Registry

```bash
docker tag tree-sitter-api:v1.0.0 your-registry/tree-sitter-api:v1.0.0
docker push your-registry/tree-sitter-api:v1.0.0
```

### 3. Security Best Practices

- Run as non-root user (already configured)
- Use read-only root filesystem when possible
- Set resource limits appropriately
- Enable security scanning: `docker scan tree-sitter-api:latest`
- Keep Docker and images updated regularly

### 4. Production Docker Compose

```yaml
version: '3.9'

services:
  tree-sitter-api:
    image: your-registry/tree-sitter-api:v1.0.0
    restart: always
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    ports:
      - "127.0.0.1:4001:4001"  # Bind to localhost only
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs tree-sitter-api

# Check image
docker inspect tree-sitter-api:latest

# Verify port availability
netstat -an | grep 4001  # Windows: netstat -ano | findstr :4001
```

### High Memory Usage

1. Check memory limits: `docker stats`
2. Reduce `MAX_MEMORY_MB` or `PARSER_POOL_SIZE`
3. Increase host memory allocation

### Slow Performance

1. Check CPU limits: `docker stats`
2. Verify network connectivity
3. Check application logs: `docker-compose logs tree-sitter-api`
4. Profile with `--expose-gc` (already enabled)

### Health Check Failures

```bash
# Manual health check
curl http://localhost:4001/health

# Check health status
docker inspect --format='{{.State.Health.Status}}' tree-sitter-api
```

## Integration with Kubernetes

For Kubernetes deployment, create a deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tree-sitter-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tree-sitter-api
  template:
    metadata:
      labels:
        app: tree-sitter-api
    spec:
      containers:
      - name: tree-sitter-api
        image: your-registry/tree-sitter-api:v1.0.0
        ports:
        - containerPort: 4001
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 4001
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Useful Commands

```bash
# Build and start in background
docker-compose up -d --build

# View all containers
docker ps -a

# View image size
docker images tree-sitter-api

# Security scanning
docker scan tree-sitter-api:latest

# Remove dangling images
docker image prune -f

# Monitor resource usage
docker stats tree-sitter-api

# View network details
docker network inspect tree-sitter-api_default
```

## Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
