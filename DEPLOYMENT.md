# Roomicor Production Deployment Guide

This guide covers the complete production-ready Docker setup and CI/CD pipeline for the Roomicor project.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Docker Configuration](#docker-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Scripts](#production-scripts)
- [Monitoring & Security](#monitoring--security)
- [Troubleshooting](#troubleshooting)

## 🔄 Overview

The Roomicor deployment system includes:

- **Multi-stage Docker builds** with optimized images
- **Docker Compose** for local development and production
- **GitHub Actions** CI/CD pipeline with automated testing, security scanning, and deployment
- **Kubernetes manifests** for scalable container orchestration
- **Production scripts** for health checks, backups, and migrations
- **Comprehensive monitoring** and alerting

## 📋 Prerequisites

### Required Tools

```bash
# Docker & Docker Compose
docker --version  # >= 20.10
docker-compose --version  # >= 2.0

# Node.js & pnpm
node --version  # >= 20.0
pnpm --version  # >= 8.0

# Kubernetes (optional)
kubectl version  # >= 1.25

# Monitoring Tools (optional)
curl --version
jq --version
```

### Required Services

1. **GitHub Repository** with Actions enabled
2. **Container Registry** (GitHub Container Registry recommended)
3. **Hosting Platform** (Vercel, AWS, GCP, etc.)
4. **External Services**:
   - Clerk (Authentication)
   - Supabase (Database)
   - Stripe (Payments)
   - OpenAI (AI Services)

## 🐳 Docker Configuration

### Development Environment

```bash
# Start development environment
pnpm run docker:dev

# Or manually:
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Production Environment

```bash
# Build and start production environment
pnpm run docker:prod

# Or manually:
docker-compose -f docker-compose.prod.yml up -d

# Health check
curl http://localhost:3000/api/health
```

### Docker Images

The project includes optimized multi-stage Docker builds:

- **Dependencies stage**: Installs only production dependencies
- **Build stage**: Compiles the Next.js application
- **Runtime stage**: Minimal production image with non-root user

#### Build Arguments

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://roomicor.com \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... \
  --build-arg NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL=/api/copilotkit \
  -t roomicor:latest .
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

The project includes several automated workflows:

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

- **Code Quality**: TypeScript checks, linting, testing
- **Security Scanning**: Dependency audit, secret detection
- **Docker Testing**: Build and test Docker images
- **Performance**: Lighthouse audits, bundle analysis

#### 2. Deployment Pipeline (`.github/workflows/deploy.yml`)

- **Multi-environment**: Staging and production deployments
- **Health Checks**: Automated post-deployment verification
- **Rollback**: Automatic rollback on failure
- **Notifications**: Slack integration for deployment status

#### 3. Security Workflow (`.github/workflows/security.yml`)

- **Dependency Scanning**: pnpm audit, CodeQL analysis
- **Container Security**: Trivy and Snyk scanning
- **Secret Detection**: TruffleHog and GitLeaks
- **License Compliance**: Automated license checking

#### 4. Release Management (`.github/workflows/release.yml`)

- **Automated Versioning**: Semantic version bumps
- **Release Notes**: Auto-generated changelogs
- **Docker Images**: Multi-platform builds and publishing
- **Asset Management**: Release artifacts and checksums

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

```bash
# Container Registry
DOCKER_USERNAME=your_username
DOCKER_PASSWORD=your_token

# Deployment
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id

# Environment URLs
PRODUCTION_URL=https://roomicor.com
STAGING_URL=https://staging.roomicor.com

# Public Environment Variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## ☸️ Kubernetes Deployment

### Quick Start

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n roomicor
kubectl get services -n roomicor
kubectl get ingress -n roomicor
```

### Deployment Components

#### 1. Namespaces (`k8s/namespace.yaml`)
- `roomicor`: Production environment
- `roomicor-staging`: Staging environment

#### 2. Configuration (`k8s/configmap.yaml`, `k8s/secret.yaml`)
- Environment-specific configuration
- Secure secret management
- **Important**: Update `secret.yaml` with actual values

#### 3. Application (`k8s/deployment.yaml`)
- Multi-replica deployment with rolling updates
- Resource limits and health checks
- Security contexts and non-root containers

#### 4. Services (`k8s/service.yaml`)
- ClusterIP services for internal communication
- Prometheus metrics endpoints

#### 5. Ingress (`k8s/ingress.yaml`)
- SSL termination with Let's Encrypt
- Security headers and rate limiting
- Monitoring access control

#### 6. Scaling (`k8s/hpa.yaml`)
- Horizontal Pod Autoscaler
- CPU, memory, and custom metrics scaling

#### 7. Cache (`k8s/redis.yaml`)
- Redis deployment with persistence
- Production-optimized configuration

#### 8. Monitoring (`k8s/monitoring.yaml`)
- Prometheus ServiceMonitor
- Grafana dashboards
- Alert rules and notifications

### Secrets Management

Create actual secrets (don't commit to git):

```bash
# Create secret for production
kubectl create secret generic roomicor-secrets \
  --namespace=roomicor \
  --from-literal=CLERK_SECRET_KEY=sk_live_... \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=... \
  --from-literal=STRIPE_SECRET_KEY=sk_live_... \
  --from-literal=OPENAI_API_KEY=sk-proj-...

# Create secret for public environment variables
kubectl create secret generic roomicor-public-config \
  --namespace=roomicor \
  --from-literal=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --from-literal=NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 🛠️ Production Scripts

### Migration and Startup (`scripts/migrate-and-start.sh`)

Handles database migrations and application startup:

```bash
# Run migrations and start app
./scripts/migrate-and-start.sh

# Run migrations only
./scripts/migrate-and-start.sh migrate-only

# Check readiness
./scripts/migrate-and-start.sh check
```

### Health Checks (`scripts/health-check.sh`)

Comprehensive health monitoring:

```bash
# Quick health check
./scripts/health-check.sh quick

# Full health check
./scripts/health-check.sh full

# Check specific components
./scripts/health-check.sh database
./scripts/health-check.sh system
```

### Backup System (`scripts/backup.sh`)

Automated backup and restore:

```bash
# Run full backup
./scripts/backup.sh backup

# Database backup only
./scripts/backup.sh database

# List available backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore-db /path/to/backup.sql.gz
```

### Deployment Automation (`scripts/deploy.sh`)

Production deployment management:

```bash
# Deploy to production
./scripts/deploy.sh --env production --strategy rolling

# Deploy to staging
./scripts/deploy.sh --env staging --strategy blue-green

# Rollback deployment
./scripts/deploy.sh rollback

# Check deployment status
./scripts/deploy.sh status
```

## 📊 Monitoring & Security

### Health Endpoints

- **Application Health**: `GET /api/health`
- **Detailed Status**: Includes database, external services, and system metrics
- **Metrics**: Prometheus metrics at `/api/metrics`

### Security Features

1. **Container Security**:
   - Non-root user execution
   - Read-only root filesystem
   - Minimal attack surface

2. **Network Security**:
   - Security headers (CSP, HSTS, etc.)
   - Rate limiting
   - CORS protection

3. **Secret Management**:
   - Environment-based configuration
   - No secrets in images
   - Rotation capabilities

4. **Monitoring**:
   - Application performance metrics
   - Error tracking and alerting
   - Security event monitoring

### Monitoring Stack

- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Loki**: Log aggregation (optional)

## 🔧 Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check Docker build logs
docker build --no-cache .

# Verify dependencies
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
```

#### 2. Health Check Failures

```bash
# Check application logs
docker logs container_name

# Manual health check
curl -v http://localhost:3000/api/health

# Check environment variables
./scripts/health-check.sh --verbose
```

#### 3. Database Connection Issues

```bash
# Test database connectivity
./scripts/health-check.sh database

# Check migrations
./scripts/migrate-and-start.sh check

# Manual connection test
psql $DATABASE_URL -c "SELECT 1;"
```

#### 4. Kubernetes Issues

```bash
# Check pod status
kubectl describe pod -n roomicor

# View pod logs
kubectl logs -f deployment/roomicor-app -n roomicor

# Check ingress
kubectl describe ingress -n roomicor
```

### Performance Optimization

1. **Image Size**: Multi-stage builds reduce image size by ~70%
2. **Caching**: Docker layer caching and Redis for application cache
3. **Scaling**: HPA automatically scales based on load
4. **CDN**: Use CDN for static assets in production

### Security Scanning

The CI pipeline includes automated security scanning:

- **Dependencies**: `pnpm audit` and Snyk
- **Containers**: Trivy for vulnerability scanning
- **Code**: CodeQL for static analysis
- **Secrets**: TruffleHog and GitLeaks for secret detection

## 📞 Support

For deployment issues:

1. Check the [health endpoint](http://localhost:3000/api/health)
2. Review application logs
3. Run the health check script with `--verbose`
4. Check GitHub Actions workflow logs
5. Consult the troubleshooting section above

---

**Note**: This deployment guide assumes familiarity with Docker, Kubernetes, and CI/CD concepts. Adjust configurations based on your specific infrastructure requirements.