# Deployment Guide

## 🚀 Quick Deploy with Docker

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### 1. Using Docker Compose (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd mcp-hub-router

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

서비스가 시작되면:
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### 2. Using Docker Only

```bash
# Build image
docker build -t mcp-hub-router .

# Run PostgreSQL
docker run -d \
  --name mcp-postgres \
  -e POSTGRES_DB=mcp_hub \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine

# Run API
docker run -d \
  --name mcp-hub-api \
  -p 3000:3000 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=mcp_hub \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  --link mcp-postgres \
  mcp-hub-router
```

## 🔧 Configuration

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=mcp_hub
DB_USER=postgres
DB_PASSWORD=<secure-password>

# Redis (Optional)
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=<your-secret-key>
```

### Custom Configuration

1. Copy `.env.example` to `.env`
2. Edit `.env` with your values
3. Restart services: `docker-compose restart`

## 🏗️ Production Deployment

### 1. Build for Production

```bash
# Build
npm run build

# Test build
node dist/index.js
```

### 2. Deploy to Cloud

#### AWS ECS

```bash
# Push to ECR
aws ecr get-login-password --region region | docker login --username AWS --password-stdin aws_account_id.dkr.ecr.region.amazonaws.com
docker tag mcp-hub-router:latest aws_account_id.dkr.ecr.region.amazonaws.com/mcp-hub-router:latest
docker push aws_account_id.dkr.ecr.region.amazonaws.com/mcp-hub-router:latest
```

#### GCP Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-hub-router
gcloud run deploy mcp-hub-router --image gcr.io/PROJECT_ID/mcp-hub-router --platform managed
```

#### Azure Container Instances

```bash
# Build and push
az acr build --registry <registry-name> --image mcp-hub-router:latest .
az container create --resource-group <rg> --name mcp-hub --image <registry>.azurecr.io/mcp-hub-router:latest
```

### 3. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-hub-router
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-hub-router
  template:
    metadata:
      labels:
        app: mcp-hub-router
    spec:
      containers:
      - name: api
        image: mcp-hub-router:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          value: "postgres-service"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-hub-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: mcp-hub-router
```

## 🔍 Health Checks

### Endpoints
- **Liveness**: `GET /health/live`
- **Readiness**: `GET /health/ready`
- **Full Health**: `GET /health`

### Example

```bash
# Check if service is alive
curl http://localhost:3000/health/live

# Check if service is ready
curl http://localhost:3000/health/ready

# Full health status
curl http://localhost:3000/health
```

## 📊 Monitoring

### Docker Compose Logs

```bash
# All services
docker-compose logs -f

# API only
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api
```

### Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats mcp-hub-router
```

## 🔐 Security

### Best Practices

1. **Change Default Passwords**
   ```bash
   DB_PASSWORD=<strong-password>
   JWT_SECRET=<random-string>
   ```

2. **Use Secrets Management**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

3. **Enable HTTPS**
   - Use reverse proxy (Nginx, Traefik)
   - Let's Encrypt for certificates

4. **Firewall Rules**
   - Only expose port 3000
   - Restrict database access

## 🛠️ Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs api

# Check PostgreSQL connection
docker-compose exec api nc -zv postgres 5432

# Restart services
docker-compose restart
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -d mcp_hub -c "SELECT 1;"
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Increase resources in docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## 🔄 Updates & Rollback

### Update to Latest Version

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose up -d
```

### Rollback

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-commit>

# Rebuild and start
docker-compose build
docker-compose up -d
```

## 📦 Backup & Restore

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres mcp_hub > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres mcp_hub < backup.sql
```

### Full Backup

```bash
# Stop services
docker-compose down

# Backup volumes
docker run --rm -v mcp-hub-router_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Start services
docker-compose up -d
```

## 🎯 Performance Tuning

### PostgreSQL

```yaml
# docker-compose.yml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

### Node.js

```yaml
api:
  environment:
    - NODE_OPTIONS=--max-old-space-size=2048
```

## 📞 Support

- GitHub Issues: [링크]
- Documentation: `/docs`
- Health: `http://localhost:3000/health`

