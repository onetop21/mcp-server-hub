# Deployment Guide

## Task 24: Production Deployment

이 문서는 MCP Hub Router를 프로덕션 환경에 배포하는 방법을 설명합니다.

---

## 🚀 Quick Start with Docker

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/mcp-hub-router.git
cd mcp-hub-router

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start Services

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

### 3. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api-docs
```

---

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│  Load Balancer  │ (Nginx/HAProxy)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌─────────┐
│  API 1  │ │  API 2  │ (MCP Hub Router)
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           │
    ┌──────┴──────┐
    │             │
    ↓             ↓
┌──────────┐  ┌────────┐
│ PostgreSQL│  │ Redis  │
└──────────┘  └────────┘
```

---

## 📦 Deployment Options

### Option 1: Docker Compose (Recommended for Development)

**Pros**:
- ✅ Easy setup
- ✅ All services in one command
- ✅ Isolated environment

**Cons**:
- ❌ Single host limitation
- ❌ Manual scaling

**Usage**:
```bash
docker-compose up -d
```

### Option 2: Kubernetes (Production)

**Pros**:
- ✅ Auto-scaling
- ✅ Self-healing
- ✅ Rolling updates
- ✅ Service discovery

**Cons**:
- ❌ Complex setup
- ❌ Higher resource requirements

**Example Deployment**:
```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-hub-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-hub-api
  template:
    metadata:
      labels:
        app: mcp-hub-api
    spec:
      containers:
      - name: api
        image: your-registry/mcp-hub-router:latest
        ports:
        - containerPort: 3000
        env:
        - name: DB_HOST
          value: postgres-service
        - name: REDIS_HOST
          value: redis-service
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Option 3: Cloud Platforms

#### AWS

**ECS (Elastic Container Service)**:
```bash
# Build and push
docker build -t mcp-hub-router .
docker tag mcp-hub-router:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/mcp-hub-router:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/mcp-hub-router:latest

# Create ECS task definition and service
aws ecs create-service \
  --cluster mcp-hub-cluster \
  --service-name mcp-hub-api \
  --task-definition mcp-hub-task \
  --desired-count 2
```

**RDS + ElastiCache**:
- Use RDS PostgreSQL for database
- Use ElastiCache Redis for caching

#### Google Cloud Platform

**Cloud Run**:
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-hub-router
gcloud run deploy mcp-hub-api \
  --image gcr.io/PROJECT_ID/mcp-hub-router \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Azure

**Container Instances**:
```bash
az container create \
  --resource-group mcp-hub-rg \
  --name mcp-hub-api \
  --image your-registry/mcp-hub-router:latest \
  --dns-name-label mcp-hub-api \
  --ports 3000
```

---

## 🔐 Security Checklist

### Before Deployment

- [ ] Change all default passwords
- [ ] Generate strong JWT secret
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Review environment variables
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy
- [ ] Update dependencies to latest secure versions

### Environment Variables to Update

```bash
# CRITICAL: Change these
JWT_SECRET=your-unique-random-secret-key
DB_PASSWORD=your-secure-database-password
REDIS_PASSWORD=your-secure-redis-password

# Recommended: Configure these
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_ENABLED=true
LOG_LEVEL=warn
```

---

## 🔧 Configuration

### Database Migration

```bash
# Run migrations
docker-compose exec api npm run migrate

# Seed initial data (optional)
docker-compose exec api npm run seed
```

### SSL/TLS Setup

**Using Nginx as Reverse Proxy**:

```nginx
# /etc/nginx/sites-available/mcp-hub
server {
    listen 443 ssl http2;
    server_name api.mcphub.example.com;

    ssl_certificate /etc/letsencrypt/live/api.mcphub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mcphub.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Detailed metrics
curl http://localhost:3000/api/health/metrics
```

### Logging

**View logs**:
```bash
# Docker Compose
docker-compose logs -f api

# Kubernetes
kubectl logs -f deployment/mcp-hub-api
```

**Log aggregation** (Recommended):
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- Datadog
- New Relic

### Metrics

**Prometheus + Grafana**:

```yaml
# docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t mcp-hub-router .
      
      - name: Run tests
        run: docker run mcp-hub-router npm test
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push mcp-hub-router:latest
      
      - name: Deploy to production
        run: |
          # Your deployment commands
          ssh user@server "cd /app && docker-compose pull && docker-compose up -d"
```

---

## 🚨 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs api

# Common issues:
# 1. Database not ready - wait for postgres health check
# 2. Environment variables missing - check .env
# 3. Port already in use - change PORT in .env
```

### Database connection failed

```bash
# Verify database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d mcp_hub
```

### High memory usage

```bash
# Check resource usage
docker stats

# Limit container memory
# docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## 📈 Scaling

### Horizontal Scaling

**Docker Compose**:
```bash
docker-compose up -d --scale api=3
```

**Kubernetes**:
```bash
kubectl scale deployment mcp-hub-api --replicas=5
```

### Load Balancing

**Nginx**:
```nginx
upstream mcp_hub_backend {
    least_conn;
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://mcp_hub_backend;
    }
}
```

---

## 🔄 Backup and Recovery

### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres mcp_hub > backup.sql

# Automated daily backups
0 2 * * * docker-compose exec postgres pg_dump -U postgres mcp_hub > /backups/mcp_hub_$(date +\%Y\%m\%d).sql
```

### Restore

```bash
# Restore from backup
docker-compose exec -T postgres psql -U postgres mcp_hub < backup.sql
```

---

## ✅ Production Checklist

- [ ] All environment variables configured
- [ ] Database migrated and seeded
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on deployment process

---

**Next Steps**: Monitor your deployment, set up alerts, and iterate based on real-world usage patterns.

