#!/bin/bash

# migrate-and-start.sh
# Production script to run database migrations and start the application
# This script ensures database is up-to-date before starting the application

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Configuration
DB_CONNECTION_TIMEOUT=${DB_CONNECTION_TIMEOUT:-30}
MIGRATION_TIMEOUT=${MIGRATION_TIMEOUT:-300}
APP_START_TIMEOUT=${APP_START_TIMEOUT:-60}

# Functions
check_environment() {
    log "Checking environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "CLERK_SECRET_KEY"
        "STRIPE_SECRET_KEY"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    log "All required environment variables are set"
}

wait_for_database() {
    log "Waiting for database connection..."
    
    # Extract database details from Supabase URL if using Supabase
    if [[ "${NEXT_PUBLIC_SUPABASE_URL:-}" =~ ^https://([^.]+)\.supabase\.co$ ]]; then
        DB_HOST="${BASH_REMATCH[1]}.supabase.co"
        DB_PORT=5432
    elif [[ -n "${DATABASE_URL:-}" ]]; then
        # Parse DATABASE_URL for direct PostgreSQL connection
        if [[ "${DATABASE_URL}" =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
            DB_HOST="${BASH_REMATCH[4]}"
            DB_PORT="${BASH_REMATCH[5]}"
        fi
    else
        warn "No database connection details found, skipping database wait"
        return 0
    fi
    
    log "Checking database connectivity to $DB_HOST:$DB_PORT"
    
    # Wait for database to be ready
    timeout=$DB_CONNECTION_TIMEOUT
    while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
        if [[ $timeout -le 0 ]]; then
            error "Database connection timeout after ${DB_CONNECTION_TIMEOUT}s"
            exit 1
        fi
        
        warn "Database not ready, waiting... (${timeout}s remaining)"
        sleep 2
        ((timeout-=2))
    done
    
    log "Database connection established"
}

run_migrations() {
    log "Running database migrations..."
    
    # Create a backup before running migrations
    if [[ "${SKIP_BACKUP:-false}" != "true" ]]; then
        log "Creating pre-migration backup..."
        if command -v pg_dump &> /dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
            backup_file="/tmp/pre-migration-backup-$(date +%Y%m%d-%H%M%S).sql"
            if pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null; then
                log "Backup created: $backup_file"
            else
                warn "Failed to create backup, continuing anyway..."
            fi
        else
            warn "pg_dump not available or DATABASE_URL not set, skipping backup"
        fi
    fi
    
    # Run Supabase migrations if using Supabase
    if command -v supabase &> /dev/null && [[ -f "supabase/config.toml" ]]; then
        log "Running Supabase migrations..."
        timeout $MIGRATION_TIMEOUT supabase db push --linked || {
            error "Supabase migrations failed"
            exit 1
        }
    # Run custom SQL migrations
    elif [[ -d "migrations" ]]; then
        log "Running custom SQL migrations..."
        for migration in migrations/*.sql; do
            if [[ -f "$migration" ]]; then
                log "Applying migration: $(basename "$migration")"
                if [[ -n "${DATABASE_URL:-}" ]]; then
                    psql "$DATABASE_URL" < "$migration" || {
                        error "Migration failed: $migration"
                        exit 1
                    }
                fi
            fi
        done
    # Run Prisma migrations if using Prisma
    elif [[ -f "prisma/schema.prisma" ]] && command -v prisma &> /dev/null; then
        log "Running Prisma migrations..."
        timeout $MIGRATION_TIMEOUT npx prisma migrate deploy || {
            error "Prisma migrations failed"
            exit 1
        }
    else
        warn "No migration system detected, skipping migrations"
    fi
    
    log "Database migrations completed successfully"
}

seed_database() {
    if [[ "${RUN_SEEDS:-false}" == "true" ]]; then
        log "Running database seeds..."
        
        if [[ -f "scripts/seed.js" ]]; then
            node scripts/seed.js || {
                error "Database seeding failed"
                exit 1
            }
        elif [[ -f "scripts/seed.sql" ]] && [[ -n "${DATABASE_URL:-}" ]]; then
            psql "$DATABASE_URL" < scripts/seed.sql || {
                error "Database seeding failed"
                exit 1
            }
        else
            warn "No seed script found, skipping seeding"
        fi
        
        log "Database seeding completed"
    fi
}

verify_deployment() {
    log "Verifying deployment readiness..."
    
    # Check if build artifacts exist
    if [[ ! -d ".next" ]]; then
        error "Build artifacts not found. Please run 'pnpm build' first."
        exit 1
    fi
    
    # Verify package.json exists
    if [[ ! -f "package.json" ]]; then
        error "package.json not found"
        exit 1
    fi
    
    # Check Node.js version
    node_version=$(node --version)
    log "Node.js version: $node_version"
    
    # Verify dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        error "node_modules not found. Please run 'pnpm install' first."
        exit 1
    fi
    
    log "Deployment verification passed"
}

start_application() {
    log "Starting application..."
    
    # Set production environment
    export NODE_ENV=production
    export PORT=${PORT:-3000}
    
    # Start the application with timeout
    if [[ -f ".next/standalone/server.js" ]]; then
        log "Starting standalone Next.js server..."
        exec node .next/standalone/server.js
    elif [[ -f "server.js" ]]; then
        log "Starting custom server..."
        exec node server.js
    else
        log "Starting Next.js application..."
        exec pnpm start
    fi
}

# Graceful shutdown handler
cleanup() {
    log "Received shutdown signal, cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill
    exit 0
}

# Signal handlers
trap cleanup SIGTERM SIGINT

# Health check endpoint setup
setup_health_check() {
    log "Setting up health check monitoring..."
    
    # Start background health check monitor
    (
        sleep $APP_START_TIMEOUT
        while true; do
            if curl -f -s "http://localhost:${PORT:-3000}/api/health" > /dev/null 2>&1; then
                log "Health check passed"
            else
                warn "Health check failed"
            fi
            sleep 30
        done
    ) &
}

# Main execution
main() {
    log "Starting Roomicor deployment process..."
    log "Environment: ${NODE_ENV:-development}"
    log "Port: ${PORT:-3000}"
    
    # Execution steps
    check_environment
    verify_deployment
    wait_for_database
    run_migrations
    seed_database
    setup_health_check
    
    log "Pre-start checks completed successfully"
    log "Starting application server..."
    
    start_application
}

# Command line argument handling
case "${1:-start}" in
    "migrate-only")
        log "Running migrations only..."
        check_environment
        wait_for_database
        run_migrations
        log "Migrations completed"
        ;;
    "check")
        log "Running deployment checks only..."
        check_environment
        verify_deployment
        wait_for_database
        log "All checks passed"
        ;;
    "start"|"")
        main
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start         Run migrations and start application (default)"
        echo "  migrate-only  Run database migrations only"
        echo "  check         Run deployment checks only"
        echo "  help          Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DB_CONNECTION_TIMEOUT  Timeout for database connection (default: 30s)"
        echo "  MIGRATION_TIMEOUT      Timeout for migrations (default: 300s)"
        echo "  APP_START_TIMEOUT      Timeout for app startup (default: 60s)"
        echo "  RUN_SEEDS             Run database seeds (default: false)"
        echo "  SKIP_BACKUP           Skip pre-migration backup (default: false)"
        echo "  PORT                  Application port (default: 3000)"
        ;;
    *)
        error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac