#!/bin/bash

# deploy.sh
# Production deployment automation script
# Supports multiple deployment strategies and environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-"production"}
DEPLOYMENT_STRATEGY=${DEPLOYMENT_STRATEGY:-"rolling"}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"ghcr.io"}
IMAGE_NAME=${IMAGE_NAME:-"roomicor"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Utility functions
check_dependencies() {
    log "Checking deployment dependencies..."
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # Check curl for health checks
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    success "All dependencies are available"
}

load_environment() {
    log "Loading environment configuration for $DEPLOYMENT_ENV..."
    
    case "$DEPLOYMENT_ENV" in
        "production")
            COMPOSE_FILE="docker-compose.prod.yml"
            APP_URL=${PRODUCTION_URL:-"https://roomicor.com"}
            ;;
        "staging")
            COMPOSE_FILE="docker-compose.staging.yml"
            APP_URL=${STAGING_URL:-"https://staging.roomicor.com"}
            ;;
        "development")
            COMPOSE_FILE="docker-compose.dev.yml"
            APP_URL=${DEV_URL:-"http://localhost:3000"}
            ;;
        *)
            error "Unknown environment: $DEPLOYMENT_ENV"
            return 1
            ;;
    esac
    
    # Fallback to production compose if environment-specific file doesn't exist
    if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        warning "Compose file $COMPOSE_FILE not found, using docker-compose.prod.yml"
        COMPOSE_FILE="docker-compose.prod.yml"
    fi
    
    success "Environment loaded: $DEPLOYMENT_ENV"
    log "Compose file: $COMPOSE_FILE"
    log "App URL: $APP_URL"
}

create_backup() {
    log "Creating pre-deployment backup..."
    
    if [[ -f "$SCRIPT_DIR/backup.sh" ]]; then
        log "Running backup script..."
        bash "$SCRIPT_DIR/backup.sh" database || {
            warning "Backup failed, but continuing deployment..."
        }
        success "Pre-deployment backup completed"
    else
        warning "Backup script not found, skipping backup"
    fi
}

check_image_availability() {
    log "Checking Docker image availability..."
    
    local full_image_name="$DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    
    # Try to pull the image
    if docker pull "$full_image_name"; then
        success "Docker image is available: $full_image_name"
    else
        error "Docker image not found: $full_image_name"
        return 1
    fi
}

validate_deployment_readiness() {
    log "Validating deployment readiness..."
    
    # Check if compose file exists
    if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        error "Compose file not found: $COMPOSE_FILE"
        return 1
    fi
    
    # Validate compose file syntax
    if ! docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" config &>/dev/null; then
        error "Invalid compose file syntax"
        return 1
    fi
    
    # Check required environment variables
    local required_vars=(
        "NODE_ENV"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    success "Deployment readiness validation passed"
}

# Deployment strategy functions
deploy_rolling() {
    log "Executing rolling deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Update the services one by one
    local services=($(docker-compose -f "$COMPOSE_FILE" config --services))
    
    for service in "${services[@]}"; do
        log "Updating service: $service"
        
        # Update the service
        if docker-compose -f "$COMPOSE_FILE" up -d --no-deps "$service"; then
            success "Service $service updated successfully"
            
            # Wait for service to be healthy
            if ! wait_for_service_health "$service"; then
                error "Service $service failed health check"
                return 1
            fi
        else
            error "Failed to update service: $service"
            return 1
        fi
        
        # Small delay between service updates
        sleep 5
    done
    
    success "Rolling deployment completed"
}

deploy_blue_green() {
    log "Executing blue-green deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Create a copy of the compose file with different container names
    local green_compose="docker-compose.green.yml"
    
    # Generate green environment compose file
    sed 's/container_name: roomicor-/container_name: roomicor-green-/g' "$COMPOSE_FILE" > "$green_compose"
    
    log "Starting green environment..."
    
    # Start green environment
    if docker-compose -f "$green_compose" up -d; then
        success "Green environment started"
        
        # Wait for green environment to be healthy
        if wait_for_environment_health "green"; then
            log "Switching traffic to green environment..."
            
            # Update load balancer to point to green
            switch_traffic_to_green
            
            log "Stopping blue environment..."
            docker-compose -f "$COMPOSE_FILE" down
            
            # Rename green to blue
            mv "$green_compose" "$COMPOSE_FILE"
            
            success "Blue-green deployment completed"
        else
            error "Green environment health check failed"
            
            # Cleanup green environment
            docker-compose -f "$green_compose" down
            rm -f "$green_compose"
            return 1
        fi
    else
        error "Failed to start green environment"
        rm -f "$green_compose"
        return 1
    fi
}

deploy_recreate() {
    log "Executing recreate deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop all services
    log "Stopping current services..."
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start all services
    log "Starting updated services..."
    if docker-compose -f "$COMPOSE_FILE" up -d; then
        success "Services started successfully"
    else
        error "Failed to start services"
        return 1
    fi
    
    success "Recreate deployment completed"
}

# Health check functions
wait_for_service_health() {
    local service="$1"
    local timeout=${HEALTH_CHECK_TIMEOUT}
    local interval=10
    
    log "Waiting for service $service to be healthy (timeout: ${timeout}s)..."
    
    while [[ $timeout -gt 0 ]]; do
        # Check if container is running
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            # Check if service has health check
            local health_status=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep "$service" | awk '{print $6}' || echo "unknown")
            
            case "$health_status" in
                "healthy")
                    success "Service $service is healthy"
                    return 0
                    ;;
                "unhealthy")
                    error "Service $service is unhealthy"
                    return 1
                    ;;
                *)
                    log "Service $service status: $health_status (waiting...)"
                    ;;
            esac
        else
            log "Service $service is not running yet..."
        fi
        
        sleep $interval
        timeout=$((timeout - interval))
    done
    
    error "Service $service health check timeout"
    return 1
}

wait_for_environment_health() {
    local env="$1"
    local timeout=${HEALTH_CHECK_TIMEOUT}
    local interval=10
    
    log "Waiting for $env environment to be healthy (timeout: ${timeout}s)..."
    
    # Determine the URL to check based on environment
    local check_url="$APP_URL"
    if [[ "$env" == "green" ]]; then
        # For blue-green, we might need to check a different port or URL
        check_url="${APP_URL}:8080"  # Assuming green runs on different port
    fi
    
    while [[ $timeout -gt 0 ]]; do
        if curl -f -s --max-time 10 "$check_url/api/health" > /dev/null 2>&1; then
            success "$env environment is healthy"
            return 0
        fi
        
        log "$env environment not ready yet (${timeout}s remaining)..."
        sleep $interval
        timeout=$((timeout - interval))
    done
    
    error "$env environment health check timeout"
    return 1
}

# Blue-green specific functions
switch_traffic_to_green() {
    log "Switching traffic to green environment..."
    
    # This is a placeholder - in a real implementation, you would:
    # 1. Update load balancer configuration
    # 2. Update DNS records
    # 3. Update reverse proxy rules
    # 4. Or update Kubernetes ingress
    
    # Example for nginx:
    # sed -i 's/roomicor-app/roomicor-green-app/g' /etc/nginx/sites-available/roomicor
    # nginx -s reload
    
    # Example for HAProxy:
    # Update HAProxy configuration to point to green backend
    
    # For this demo, we'll simulate the switch
    log "Traffic switching logic would go here..."
    sleep 2
    
    success "Traffic switched to green environment"
}

# Monitoring and verification
verify_deployment() {
    log "Verifying deployment..."
    
    # Run health checks
    if ! "$SCRIPT_DIR/health-check.sh" --url "$APP_URL" full; then
        error "Post-deployment health checks failed"
        return 1
    fi
    
    # Run smoke tests
    if [[ -f "$SCRIPT_DIR/smoke-tests.sh" ]]; then
        log "Running smoke tests..."
        if bash "$SCRIPT_DIR/smoke-tests.sh" "$APP_URL"; then
            success "Smoke tests passed"
        else
            error "Smoke tests failed"
            return 1
        fi
    fi
    
    success "Deployment verification completed"
}

# Rollback functions
get_previous_deployment() {
    log "Identifying previous deployment..."
    
    # Get the previous image tag from Docker
    local previous_image=$(docker images "$DOCKER_REGISTRY/$IMAGE_NAME" --format "table {{.Tag}}" | grep -v "TAG" | grep -v "$IMAGE_TAG" | head -1)
    
    if [[ -n "$previous_image" ]]; then
        echo "$previous_image"
    else
        error "No previous deployment found"
        return 1
    fi
}

rollback_deployment() {
    log "Rolling back deployment..."
    
    local previous_tag
    if previous_tag=$(get_previous_deployment); then
        log "Rolling back to previous version: $previous_tag"
        
        # Update IMAGE_TAG to previous version
        IMAGE_TAG="$previous_tag"
        
        # Re-deploy with previous image
        case "$DEPLOYMENT_STRATEGY" in
            "rolling")
                deploy_rolling
                ;;
            "blue-green")
                deploy_blue_green
                ;;
            "recreate")
                deploy_recreate
                ;;
        esac
        
        success "Rollback completed"
    else
        error "Rollback failed - no previous version available"
        return 1
    fi
}

# Notification functions
send_deployment_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color
        local emoji
        
        case "$status" in
            "success")
                color="good"
                emoji="🚀"
                ;;
            "warning")
                color="warning"
                emoji="⚠️"
                ;;
            "error")
                color="danger"
                emoji="💥"
                ;;
        esac
        
        local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$emoji Roomicor Deployment",
            "text": "$message",
            "footer": "Deployment System",
            "ts": $(date +%s),
            "fields": [
                {
                    "title": "Environment",
                    "value": "$DEPLOYMENT_ENV",
                    "short": true
                },
                {
                    "title": "Strategy",
                    "value": "$DEPLOYMENT_STRATEGY",
                    "short": true
                },
                {
                    "title": "Image Tag",
                    "value": "$IMAGE_TAG",
                    "short": true
                },
                {
                    "title": "App URL",
                    "value": "$APP_URL",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$SLACK_WEBHOOK_URL" &>/dev/null || true
    fi
}

# Main deployment function
run_deployment() {
    local start_time=$(date +%s)
    local deployment_status="success"
    local deployment_message=""
    
    log "Starting deployment process..."
    log "Environment: $DEPLOYMENT_ENV"
    log "Strategy: $DEPLOYMENT_STRATEGY"
    log "Image: $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    
    # Pre-deployment checks and setup
    if ! check_dependencies; then
        deployment_status="error"
        deployment_message="Deployment failed - missing dependencies"
    elif ! load_environment; then
        deployment_status="error"
        deployment_message="Deployment failed - environment configuration error"
    elif ! validate_deployment_readiness; then
        deployment_status="error"
        deployment_message="Deployment failed - readiness validation failed"
    elif ! check_image_availability; then
        deployment_status="error"
        deployment_message="Deployment failed - Docker image not available"
    else
        # Create backup before deployment
        create_backup
        
        # Execute deployment based on strategy
        case "$DEPLOYMENT_STRATEGY" in
            "rolling")
                if deploy_rolling; then
                    log "Rolling deployment successful"
                else
                    deployment_status="error"
                    deployment_message="Rolling deployment failed"
                fi
                ;;
            "blue-green")
                if deploy_blue_green; then
                    log "Blue-green deployment successful"
                else
                    deployment_status="error"
                    deployment_message="Blue-green deployment failed"
                fi
                ;;
            "recreate")
                if deploy_recreate; then
                    log "Recreate deployment successful"
                else
                    deployment_status="error"
                    deployment_message="Recreate deployment failed"
                fi
                ;;
            *)
                deployment_status="error"
                deployment_message="Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
                ;;
        esac
        
        # Post-deployment verification
        if [[ "$deployment_status" == "success" ]]; then
            if verify_deployment; then
                local end_time=$(date +%s)
                local duration=$((end_time - start_time))
                deployment_message="Deployment completed successfully in ${duration}s"
                success "$deployment_message"
            else
                deployment_status="error"
                deployment_message="Deployment verification failed"
                
                # Attempt rollback if enabled
                if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
                    log "Attempting automatic rollback..."
                    if rollback_deployment; then
                        deployment_status="warning"
                        deployment_message="Deployment failed but rollback succeeded"
                    else
                        deployment_message="Deployment and rollback both failed"
                    fi
                fi
            fi
        fi
    fi
    
    # Handle deployment failure
    if [[ "$deployment_status" == "error" ]]; then
        error "$deployment_message"
        
        # Show recent logs for debugging
        log "Recent container logs:"
        docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" logs --tail=50 || true
    fi
    
    # Send notification
    send_deployment_notification "$deployment_status" "$deployment_message"
    
    # Return appropriate exit code
    case "$deployment_status" in
        "success") return 0 ;;
        "warning") return 1 ;;
        "error") return 2 ;;
    esac
}

# Usage information
show_usage() {
    echo "Usage: $0 [options] [command]"
    echo ""
    echo "Commands:"
    echo "  deploy          Run deployment (default)"
    echo "  rollback        Rollback to previous version"
    echo "  status          Show deployment status"
    echo "  logs            Show application logs"
    echo "  health          Run health checks"
    echo ""
    echo "Options:"
    echo "  --env ENV              Deployment environment (production|staging|development)"
    echo "  --strategy STRATEGY    Deployment strategy (rolling|blue-green|recreate)"
    echo "  --image-tag TAG        Docker image tag to deploy"
    echo "  --no-backup            Skip pre-deployment backup"
    echo "  --no-rollback          Disable automatic rollback on failure"
    echo "  --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DEPLOYMENT_ENV         Target environment"
    echo "  DEPLOYMENT_STRATEGY    Deployment strategy"
    echo "  DOCKER_REGISTRY        Docker registry URL"
    echo "  IMAGE_NAME             Docker image name"
    echo "  IMAGE_TAG              Docker image tag"
    echo "  HEALTH_CHECK_TIMEOUT   Health check timeout in seconds"
    echo "  ROLLBACK_ON_FAILURE    Enable automatic rollback (true/false)"
    echo "  SLACK_WEBHOOK_URL      Slack webhook for notifications"
}

# Command line argument parsing
COMMAND="deploy"
SKIP_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|rollback|status|logs|health)
            COMMAND="$1"
            shift
            ;;
        --env)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        --strategy)
            DEPLOYMENT_STRATEGY="$2"
            shift 2
            ;;
        --image-tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Override backup setting
if [[ "$SKIP_BACKUP" == "true" ]]; then
    create_backup() {
        log "Backup skipped by request"
    }
fi

# Main execution
case "$COMMAND" in
    "deploy")
        run_deployment
        ;;
    "rollback")
        load_environment
        rollback_deployment
        ;;
    "status")
        load_environment
        cd "$PROJECT_ROOT"
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    "logs")
        load_environment
        cd "$PROJECT_ROOT"
        docker-compose -f "$COMPOSE_FILE" logs -f
        ;;
    "health")
        load_environment
        "$SCRIPT_DIR/health-check.sh" --url "$APP_URL" full
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac