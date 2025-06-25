#!/bin/bash

# health-check.sh
# Comprehensive health check script for production monitoring
# Can be used by Docker healthcheck, Kubernetes probes, or monitoring systems

set -euo pipefail

# Configuration
APP_URL=${APP_URL:-"http://localhost:3000"}
HEALTH_ENDPOINT="${APP_URL}/api/health"
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-2}
VERBOSE=${VERBOSE:-false}
CHECK_DEPENDENCIES=${CHECK_DEPENDENCIES:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    fi
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

# Health check functions
check_basic_connectivity() {
    log "Checking basic connectivity to $APP_URL"
    
    for attempt in $(seq 1 $MAX_RETRIES); do
        if curl -f -s --max-time $TIMEOUT "$APP_URL" > /dev/null 2>&1; then
            success "Basic connectivity check passed"
            return 0
        else
            if [[ $attempt -lt $MAX_RETRIES ]]; then
                warning "Connectivity check failed (attempt $attempt/$MAX_RETRIES), retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    error "Basic connectivity check failed after $MAX_RETRIES attempts"
    return 1
}

check_health_endpoint() {
    log "Checking health endpoint: $HEALTH_ENDPOINT"
    
    for attempt in $(seq 1 $MAX_RETRIES); do
        response=$(curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" 2>/dev/null || echo "")
        
        if [[ -n "$response" ]]; then
            # Parse JSON response
            status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "unknown")
            
            case "$status" in
                "healthy")
                    success "Health endpoint check passed - status: healthy"
                    
                    if [[ "$VERBOSE" == "true" ]]; then
                        echo "$response" | jq '.' 2>/dev/null || echo "$response"
                    fi
                    
                    return 0
                    ;;
                "degraded")
                    warning "Health endpoint reports degraded status"
                    
                    if [[ "$VERBOSE" == "true" ]]; then
                        echo "$response" | jq '.' 2>/dev/null || echo "$response"
                    fi
                    
                    return 2  # Warning exit code
                    ;;
                "unhealthy")
                    error "Health endpoint reports unhealthy status"
                    
                    if [[ "$VERBOSE" == "true" ]]; then
                        echo "$response" | jq '.services' 2>/dev/null || echo "$response"
                    fi
                    
                    return 1
                    ;;
                *)
                    warning "Health endpoint returned unexpected status: $status"
                    ;;
            esac
        fi
        
        if [[ $attempt -lt $MAX_RETRIES ]]; then
            warning "Health endpoint check failed (attempt $attempt/$MAX_RETRIES), retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    error "Health endpoint check failed after $MAX_RETRIES attempts"
    return 1
}

check_response_time() {
    log "Checking response time"
    
    start_time=$(date +%s.%N)
    
    if curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
        end_time=$(date +%s.%N)
        response_time=$(echo "$end_time - $start_time" | bc -l)
        response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
        
        if [[ $response_time_ms -lt 1000 ]]; then
            success "Response time check passed (${response_time_ms}ms)"
        elif [[ $response_time_ms -lt 3000 ]]; then
            warning "Response time is slow (${response_time_ms}ms)"
            return 2
        else
            error "Response time is too slow (${response_time_ms}ms)"
            return 1
        fi
    else
        error "Failed to measure response time - endpoint unreachable"
        return 1
    fi
}

check_critical_endpoints() {
    log "Checking critical application endpoints"
    
    critical_endpoints=(
        "/"
        "/api/health"
        "/pricing"
    )
    
    failed_endpoints=()
    
    for endpoint in "${critical_endpoints[@]}"; do
        url="${APP_URL}${endpoint}"
        log "Checking endpoint: $url"
        
        if curl -f -s --max-time $TIMEOUT "$url" > /dev/null 2>&1; then
            success "Endpoint $endpoint is accessible"
        else
            error "Endpoint $endpoint is not accessible"
            failed_endpoints+=("$endpoint")
        fi
    done
    
    if [[ ${#failed_endpoints[@]} -eq 0 ]]; then
        success "All critical endpoints are accessible"
        return 0
    else
        error "Failed endpoints: ${failed_endpoints[*]}"
        return 1
    fi
}

check_database_connectivity() {
    if [[ "$CHECK_DEPENDENCIES" != "true" ]]; then
        return 0
    fi
    
    log "Checking database connectivity via health endpoint"
    
    response=$(curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        db_status=$(echo "$response" | jq -r '.services.database.status' 2>/dev/null || echo "unknown")
        
        case "$db_status" in
            "healthy")
                success "Database connectivity check passed"
                return 0
                ;;
            "unhealthy")
                error "Database connectivity check failed"
                
                if [[ "$VERBOSE" == "true" ]]; then
                    db_error=$(echo "$response" | jq -r '.services.database.error' 2>/dev/null || echo "No error details")
                    echo "Database error: $db_error"
                fi
                
                return 1
                ;;
            *)
                warning "Database status unknown or not reported"
                return 2
                ;;
        esac
    else
        error "Could not retrieve database status"
        return 1
    fi
}

check_external_services() {
    if [[ "$CHECK_DEPENDENCIES" != "true" ]]; then
        return 0
    fi
    
    log "Checking external service dependencies"
    
    response=$(curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" 2>/dev/null || echo "")
    
    if [[ -n "$response" ]]; then
        # Check authentication service (Clerk)
        auth_status=$(echo "$response" | jq -r '.services.authentication.status' 2>/dev/null || echo "unknown")
        if [[ "$auth_status" == "healthy" ]]; then
            success "Authentication service is healthy"
        else
            warning "Authentication service status: $auth_status"
        fi
        
        # Check payment service (Stripe)
        payment_status=$(echo "$response" | jq -r '.services.payments.status' 2>/dev/null || echo "unknown")
        if [[ "$payment_status" == "healthy" ]]; then
            success "Payment service is healthy"
        else
            warning "Payment service status: $payment_status"
        fi
        
        # Check AI services
        ai_openai_status=$(echo "$response" | jq -r '.services.ai.openai.status' 2>/dev/null || echo "unknown")
        if [[ "$ai_openai_status" == "configured" ]]; then
            success "OpenAI service is configured"
        else
            warning "OpenAI service status: $ai_openai_status"
        fi
    else
        warning "Could not retrieve external service status"
        return 2
    fi
}

check_memory_usage() {
    log "Checking memory usage"
    
    if command -v free &> /dev/null; then
        # Get memory usage percentage
        memory_usage=$(free | awk 'FNR==2{printf "%.0f", $3/($3+$4)*100}')
        
        if [[ $memory_usage -lt 80 ]]; then
            success "Memory usage is normal (${memory_usage}%)"
        elif [[ $memory_usage -lt 90 ]]; then
            warning "Memory usage is high (${memory_usage}%)"
            return 2
        else
            error "Memory usage is critical (${memory_usage}%)"
            return 1
        fi
    else
        warning "Cannot check memory usage (free command not available)"
        return 2
    fi
}

check_disk_space() {
    log "Checking disk space"
    
    # Check disk usage for root filesystem
    disk_usage=$(df / | awk 'FNR==2{print $5}' | sed 's/%//')
    
    if [[ $disk_usage -lt 80 ]]; then
        success "Disk space is sufficient (${disk_usage}% used)"
    elif [[ $disk_usage -lt 90 ]]; then
        warning "Disk space is running low (${disk_usage}% used)"
        return 2
    else
        error "Disk space is critical (${disk_usage}% used)"
        return 1
    fi
}

check_process_status() {
    log "Checking application process status"
    
    if pgrep -f "node.*server" > /dev/null 2>&1; then
        success "Application process is running"
        
        if [[ "$VERBOSE" == "true" ]]; then
            process_count=$(pgrep -f "node.*server" | wc -l)
            echo "Found $process_count Node.js process(es)"
        fi
    else
        error "Application process not found"
        return 1
    fi
}

# Comprehensive health check
run_comprehensive_check() {
    log "Starting comprehensive health check"
    
    local overall_status=0
    local warning_count=0
    
    # Core functionality checks
    if ! check_basic_connectivity; then
        overall_status=1
    fi
    
    health_result=$(check_health_endpoint; echo $?)
    case $health_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    response_result=$(check_response_time; echo $?)
    case $response_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    if ! check_critical_endpoints; then
        overall_status=1
    fi
    
    # Dependency checks
    db_result=$(check_database_connectivity; echo $?)
    case $db_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    ext_result=$(check_external_services; echo $?)
    case $ext_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    # System resource checks
    mem_result=$(check_memory_usage; echo $?)
    case $mem_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    disk_result=$(check_disk_space; echo $?)
    case $disk_result in
        0) ;;  # Success
        1) overall_status=1 ;;  # Failure
        2) ((warning_count++)) ;;  # Warning
    esac
    
    if ! check_process_status; then
        overall_status=1
    fi
    
    # Summary
    echo ""
    echo "================================"
    if [[ $overall_status -eq 0 ]]; then
        if [[ $warning_count -eq 0 ]]; then
            success "All health checks passed successfully"
        else
            warning "Health checks passed with $warning_count warning(s)"
        fi
    else
        error "One or more critical health checks failed"
    fi
    echo "================================"
    
    return $overall_status
}

# Quick health check (basic connectivity + health endpoint)
run_quick_check() {
    log "Running quick health check"
    
    if check_basic_connectivity && check_health_endpoint; then
        success "Quick health check passed"
        return 0
    else
        error "Quick health check failed"
        return 1
    fi
}

# Usage information
show_usage() {
    echo "Usage: $0 [options] [command]"
    echo ""
    echo "Commands:"
    echo "  quick         Run quick health check (default)"
    echo "  full          Run comprehensive health check"
    echo "  endpoints     Check critical endpoints only"
    echo "  database      Check database connectivity only"
    echo "  system        Check system resources only"
    echo ""
    echo "Options:"
    echo "  --url URL            Application URL (default: http://localhost:3000)"
    echo "  --timeout SECONDS    Request timeout (default: 10)"
    echo "  --retries COUNT      Max retry attempts (default: 3)"
    echo "  --delay SECONDS      Delay between retries (default: 2)"
    echo "  --verbose            Enable verbose output"
    echo "  --no-deps            Skip dependency checks"
    echo "  --help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_URL              Application URL"
    echo "  HEALTH_CHECK_TIMEOUT Request timeout in seconds"
    echo "  MAX_RETRIES          Maximum retry attempts"
    echo "  RETRY_DELAY          Delay between retries in seconds"
    echo "  VERBOSE              Enable verbose output (true/false)"
    echo "  CHECK_DEPENDENCIES   Check external dependencies (true/false)"
    echo ""
    echo "Exit Codes:"
    echo "  0  All checks passed"
    echo "  1  One or more checks failed"
    echo "  2  Checks passed with warnings"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            APP_URL="$2"
            HEALTH_ENDPOINT="${APP_URL}/api/health"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        --delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-deps)
            CHECK_DEPENDENCIES=false
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        quick|full|endpoints|database|system)
            COMMAND="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set default command
COMMAND=${COMMAND:-quick}

# Main execution
case "$COMMAND" in
    "quick")
        run_quick_check
        ;;
    "full")
        run_comprehensive_check
        ;;
    "endpoints")
        check_critical_endpoints
        ;;
    "database")
        check_database_connectivity
        ;;
    "system")
        check_memory_usage && check_disk_space && check_process_status
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac