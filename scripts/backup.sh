#!/bin/bash

# backup.sh
# Automated backup script for production database and application data
# Supports multiple backup strategies and retention policies

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR=${BACKUP_DIR:-"/opt/roomicor/backups"}
TEMP_DIR=${TEMP_DIR:-"/tmp/roomicor-backup"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
COMPRESSION=${COMPRESSION:-true}
ENCRYPTION=${ENCRYPTION:-false}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-""}
S3_BACKUP=${S3_BACKUP:-false}
S3_BUCKET=${S3_BUCKET:-""}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}

# Database configuration
DB_BACKUP_ENABLED=${DB_BACKUP_ENABLED:-true}
SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF:-""}
DATABASE_URL=${DATABASE_URL:-""}

# Application data configuration
APP_DATA_BACKUP=${APP_DATA_BACKUP:-true}
CONFIG_BACKUP=${CONFIG_BACKUP:-true}

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
create_backup_dirs() {
    log "Creating backup directories..."
    
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/app-data"
    mkdir -p "$BACKUP_DIR/config"
    mkdir -p "$TEMP_DIR"
    
    success "Backup directories created"
}

generate_timestamp() {
    date +"%Y%m%d_%H%M%S"
}

cleanup_temp() {
    if [[ -d "$TEMP_DIR" ]]; then
        log "Cleaning up temporary files..."
        rm -rf "$TEMP_DIR"
        success "Temporary files cleaned up"
    fi
}

compress_file() {
    local source_file="$1"
    local compressed_file="${source_file}.gz"
    
    if [[ "$COMPRESSION" == "true" ]]; then
        log "Compressing $source_file..."
        gzip "$source_file"
        echo "$compressed_file"
    else
        echo "$source_file"
    fi
}

encrypt_file() {
    local source_file="$1"
    local encrypted_file="${source_file}.enc"
    
    if [[ "$ENCRYPTION" == "true" && -n "$ENCRYPTION_KEY" ]]; then
        log "Encrypting $source_file..."
        openssl enc -aes-256-cbc -salt -in "$source_file" -out "$encrypted_file" -k "$ENCRYPTION_KEY"
        rm "$source_file"
        echo "$encrypted_file"
    else
        echo "$source_file"
    fi
}

# Database backup functions
backup_supabase_database() {
    if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
        warning "SUPABASE_PROJECT_REF not set, skipping Supabase backup"
        return 1
    fi
    
    log "Backing up Supabase database..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/supabase_backup_${timestamp}.sql"
    
    # Use Supabase CLI to create backup
    if command -v supabase &> /dev/null; then
        log "Creating Supabase database backup..."
        supabase db dump --linked --file "$backup_file" || {
            error "Supabase backup failed"
            return 1
        }
    else
        error "Supabase CLI not found"
        return 1
    fi
    
    # Process the backup file
    local final_file="$BACKUP_DIR/database/supabase_backup_${timestamp}.sql"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "Supabase database backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_postgresql_database() {
    if [[ -z "$DATABASE_URL" ]]; then
        warning "DATABASE_URL not set, skipping PostgreSQL backup"
        return 1
    fi
    
    log "Backing up PostgreSQL database..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/postgres_backup_${timestamp}.sql"
    
    # Create database dump
    if command -v pg_dump &> /dev/null; then
        log "Creating PostgreSQL database backup..."
        pg_dump "$DATABASE_URL" > "$backup_file" || {
            error "PostgreSQL backup failed"
            return 1
        }
    else
        error "pg_dump not found"
        return 1
    fi
    
    # Process the backup file
    local final_file="$BACKUP_DIR/database/postgres_backup_${timestamp}.sql"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "PostgreSQL database backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_database() {
    if [[ "$DB_BACKUP_ENABLED" != "true" ]]; then
        log "Database backup disabled, skipping..."
        return 0
    fi
    
    log "Starting database backup..."
    
    local backup_files=()
    
    # Try Supabase backup first
    if backup_file=$(backup_supabase_database 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    # Try PostgreSQL backup
    if backup_file=$(backup_postgresql_database 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        error "No database backups were created"
        return 1
    fi
    
    success "Database backup completed (${#backup_files[@]} file(s))"
    printf '%s\n' "${backup_files[@]}"
}

# Application data backup functions
backup_uploaded_files() {
    log "Backing up uploaded files..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/uploads_backup_${timestamp}.tar"
    
    # Common upload directories to backup
    local upload_dirs=(
        "public/uploads"
        "uploads"
        "storage/app/public"
        "var/uploads"
    )
    
    local found_dirs=()
    for dir in "${upload_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            found_dirs+=("$dir")
        fi
    done
    
    if [[ ${#found_dirs[@]} -eq 0 ]]; then
        warning "No upload directories found to backup"
        return 1
    fi
    
    log "Found upload directories: ${found_dirs[*]}"
    
    # Create tar archive
    tar -cf "$backup_file" "${found_dirs[@]}" 2>/dev/null || {
        error "Failed to create uploads backup"
        return 1
    }
    
    # Process the backup file
    local final_file="$BACKUP_DIR/app-data/uploads_backup_${timestamp}.tar"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "Uploads backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_logs() {
    log "Backing up application logs..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/logs_backup_${timestamp}.tar"
    
    # Common log directories
    local log_dirs=(
        "logs"
        "var/log"
        "/var/log/roomicor"
        "/opt/roomicor/logs"
    )
    
    local log_files=(
        "*.log"
        "npm-debug.log*"
        "yarn-debug.log*"
        "yarn-error.log*"
    )
    
    local found_items=()
    
    # Find log directories
    for dir in "${log_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            found_items+=("$dir")
        fi
    done
    
    # Find log files in current directory
    for pattern in "${log_files[@]}"; do
        for file in $pattern; do
            if [[ -f "$file" ]]; then
                found_items+=("$file")
            fi
        done 2>/dev/null
    done
    
    if [[ ${#found_items[@]} -eq 0 ]]; then
        warning "No log files found to backup"
        return 1
    fi
    
    log "Found log items: ${found_items[*]}"
    
    # Create tar archive
    tar -cf "$backup_file" "${found_items[@]}" 2>/dev/null || {
        error "Failed to create logs backup"
        return 1
    }
    
    # Process the backup file
    local final_file="$BACKUP_DIR/app-data/logs_backup_${timestamp}.tar"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "Logs backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_app_data() {
    if [[ "$APP_DATA_BACKUP" != "true" ]]; then
        log "Application data backup disabled, skipping..."
        return 0
    fi
    
    log "Starting application data backup..."
    
    local backup_files=()
    
    # Backup uploads
    if backup_file=$(backup_uploaded_files 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    # Backup logs
    if backup_file=$(backup_logs 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        warning "No application data backups were created"
    else
        success "Application data backup completed (${#backup_files[@]} file(s))"
    fi
    
    printf '%s\n' "${backup_files[@]}"
}

# Configuration backup functions
backup_environment_config() {
    log "Backing up environment configuration..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/env_config_${timestamp}.tar"
    
    # Configuration files to backup
    local config_files=(
        ".env.example"
        "package.json"
        "package-lock.json"
        "pnpm-lock.yaml"
        "next.config.ts"
        "tailwind.config.ts"
        "tsconfig.json"
        "docker-compose.prod.yml"
        "Dockerfile"
    )
    
    local found_files=()
    for file in "${config_files[@]}"; do
        if [[ -f "$file" ]]; then
            found_files+=("$file")
        fi
    done
    
    if [[ ${#found_files[@]} -eq 0 ]]; then
        warning "No configuration files found to backup"
        return 1
    fi
    
    log "Found configuration files: ${found_files[*]}"
    
    # Create tar archive
    tar -cf "$backup_file" "${found_files[@]}" 2>/dev/null || {
        error "Failed to create configuration backup"
        return 1
    }
    
    # Process the backup file
    local final_file="$BACKUP_DIR/config/env_config_${timestamp}.tar"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "Configuration backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_docker_config() {
    log "Backing up Docker configuration..."
    
    local timestamp=$(generate_timestamp)
    local backup_file="$TEMP_DIR/docker_config_${timestamp}.tar"
    
    # Docker configuration files
    local docker_files=(
        "Dockerfile"
        "Dockerfile.dev"
        "docker-compose.yml"
        "docker-compose.dev.yml"
        "docker-compose.prod.yml"
        ".dockerignore"
        "nginx/"
        "k8s/"
    )
    
    local found_items=()
    for item in "${docker_files[@]}"; do
        if [[ -f "$item" || -d "$item" ]]; then
            found_items+=("$item")
        fi
    done
    
    if [[ ${#found_items[@]} -eq 0 ]]; then
        warning "No Docker configuration found to backup"
        return 1
    fi
    
    log "Found Docker items: ${found_items[*]}"
    
    # Create tar archive
    tar -cf "$backup_file" "${found_items[@]}" 2>/dev/null || {
        error "Failed to create Docker configuration backup"
        return 1
    }
    
    # Process the backup file
    local final_file="$BACKUP_DIR/config/docker_config_${timestamp}.tar"
    cp "$backup_file" "$final_file"
    
    final_file=$(compress_file "$final_file")
    final_file=$(encrypt_file "$final_file")
    
    success "Docker configuration backup created: $(basename "$final_file")"
    echo "$final_file"
}

backup_config() {
    if [[ "$CONFIG_BACKUP" != "true" ]]; then
        log "Configuration backup disabled, skipping..."
        return 0
    fi
    
    log "Starting configuration backup..."
    
    local backup_files=()
    
    # Backup environment configuration
    if backup_file=$(backup_environment_config 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    # Backup Docker configuration
    if backup_file=$(backup_docker_config 2>/dev/null); then
        backup_files+=("$backup_file")
    fi
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        warning "No configuration backups were created"
    else
        success "Configuration backup completed (${#backup_files[@]} file(s))"
    fi
    
    printf '%s\n' "${backup_files[@]}"
}

# Cloud storage functions
upload_to_s3() {
    if [[ "$S3_BACKUP" != "true" || -z "$S3_BUCKET" ]]; then
        return 0
    fi
    
    log "Uploading backups to S3..."
    
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found"
        return 1
    fi
    
    local backup_files=("$@")
    local uploaded_count=0
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local s3_key="roomicor/$(date +%Y/%m/%d)/$(basename "$file")"
            
            log "Uploading $(basename "$file") to s3://$S3_BUCKET/$s3_key"
            
            if aws s3 cp "$file" "s3://$S3_BUCKET/$s3_key"; then
                success "Uploaded $(basename "$file")"
                ((uploaded_count++))
            else
                error "Failed to upload $(basename "$file")"
            fi
        fi
    done
    
    success "Uploaded $uploaded_count files to S3"
}

# Cleanup functions
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    local deleted_count=0
    
    # Clean up database backups
    if [[ -d "$BACKUP_DIR/database" ]]; then
        while IFS= read -r -d '' file; do
            rm "$file"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR/database" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    fi
    
    # Clean up app data backups
    if [[ -d "$BACKUP_DIR/app-data" ]]; then
        while IFS= read -r -d '' file; do
            rm "$file"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR/app-data" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    fi
    
    # Clean up config backups
    if [[ -d "$BACKUP_DIR/config" ]]; then
        while IFS= read -r -d '' file; do
            rm "$file"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR/config" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    fi
    
    if [[ $deleted_count -gt 0 ]]; then
        success "Deleted $deleted_count old backup files"
    else
        log "No old backup files to delete"
    fi
}

# Notification functions
send_slack_notification() {
    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        return 0
    fi
    
    local status="$1"
    local message="$2"
    local backup_files=("${@:3}")
    
    local color
    local emoji
    
    case "$status" in
        "success")
            color="good"
            emoji="✅"
            ;;
        "warning")
            color="warning"
            emoji="⚠️"
            ;;
        "error")
            color="danger"
            emoji="❌"
            ;;
    esac
    
    local files_list=""
    if [[ ${#backup_files[@]} -gt 0 ]]; then
        files_list="\n\n*Backup Files:*\n"
        for file in "${backup_files[@]}"; do
            files_list+="• $(basename "$file")\n"
        done
    fi
    
    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "$emoji Roomicor Backup Report",
            "text": "$message$files_list",
            "footer": "Roomicor Backup System",
            "ts": $(date +%s),
            "fields": [
                {
                    "title": "Environment",
                    "value": "${NODE_ENV:-production}",
                    "short": true
                },
                {
                    "title": "Backup Count",
                    "value": "${#backup_files[@]}",
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
}

# Main backup function
run_backup() {
    local start_time=$(date +%s)
    log "Starting backup process..."
    
    # Setup
    create_backup_dirs
    
    # Cleanup handler
    trap cleanup_temp EXIT
    
    local all_backup_files=()
    local backup_status="success"
    local backup_message=""
    
    # Run backups
    if backup_files=$(backup_database); then
        readarray -t db_files <<< "$backup_files"
        all_backup_files+=("${db_files[@]}")
        success "Database backup completed"
    else
        warning "Database backup failed or skipped"
        backup_status="warning"
    fi
    
    if backup_files=$(backup_app_data); then
        readarray -t app_files <<< "$backup_files"
        all_backup_files+=("${app_files[@]}")
        success "Application data backup completed"
    else
        warning "Application data backup failed or skipped"
        backup_status="warning"
    fi
    
    if backup_files=$(backup_config); then
        readarray -t config_files <<< "$backup_files"
        all_backup_files+=("${config_files[@]}")
        success "Configuration backup completed"
    else
        warning "Configuration backup failed or skipped"
        backup_status="warning"
    fi
    
    # Upload to cloud storage
    if [[ ${#all_backup_files[@]} -gt 0 ]]; then
        upload_to_s3 "${all_backup_files[@]}"
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Generate summary
    if [[ ${#all_backup_files[@]} -gt 0 ]]; then
        backup_message="Backup completed successfully in ${duration}s with ${#all_backup_files[@]} files created."
        success "$backup_message"
        
        # Calculate total size
        local total_size=0
        for file in "${all_backup_files[@]}"; do
            if [[ -f "$file" ]]; then
                size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
                total_size=$((total_size + size))
            fi
        done
        
        local size_mb=$((total_size / 1024 / 1024))
        log "Total backup size: ${size_mb}MB"
        
    else
        backup_status="error"
        backup_message="Backup failed - no backup files were created."
        error "$backup_message"
    fi
    
    # Send notification
    send_slack_notification "$backup_status" "$backup_message" "${all_backup_files[@]}"
    
    # Return appropriate exit code
    case "$backup_status" in
        "success") return 0 ;;
        "warning") return 1 ;;
        "error") return 2 ;;
    esac
}

# Restore functions
list_backups() {
    log "Listing available backups..."
    
    echo ""
    echo "Database Backups:"
    if [[ -d "$BACKUP_DIR/database" ]]; then
        ls -la "$BACKUP_DIR/database" | tail -n +2
    else
        echo "  No database backups found"
    fi
    
    echo ""
    echo "Application Data Backups:"
    if [[ -d "$BACKUP_DIR/app-data" ]]; then
        ls -la "$BACKUP_DIR/app-data" | tail -n +2
    else
        echo "  No app data backups found"
    fi
    
    echo ""
    echo "Configuration Backups:"
    if [[ -d "$BACKUP_DIR/config" ]]; then
        ls -la "$BACKUP_DIR/config" | tail -n +2
    else
        echo "  No configuration backups found"
    fi
}

restore_database() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    warning "This will restore the database from backup and may overwrite existing data!"
    echo "Backup file: $backup_file"
    echo "Press Ctrl+C to cancel or any key to continue..."
    read -n 1
    
    log "Restoring database from $backup_file..."
    
    # Decrypt if needed
    local working_file="$backup_file"
    if [[ "$backup_file" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            error "Backup is encrypted but ENCRYPTION_KEY is not set"
            return 1
        fi
        
        working_file="${backup_file%.enc}"
        openssl enc -d -aes-256-cbc -in "$backup_file" -out "$working_file" -k "$ENCRYPTION_KEY" || {
            error "Failed to decrypt backup file"
            return 1
        }
    fi
    
    # Decompress if needed
    if [[ "$working_file" == *.gz ]]; then
        gunzip -c "$working_file" > "${working_file%.gz}"
        working_file="${working_file%.gz}"
    fi
    
    # Restore database
    if [[ -n "${DATABASE_URL:-}" ]] && command -v psql &> /dev/null; then
        log "Restoring PostgreSQL database..."
        psql "$DATABASE_URL" < "$working_file" || {
            error "Database restore failed"
            return 1
        }
    else
        error "Cannot restore database - PostgreSQL tools not available or DATABASE_URL not set"
        return 1
    fi
    
    success "Database restore completed"
}

# Usage information
show_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  backup          Run full backup (default)"
    echo "  database        Backup database only"
    echo "  app-data        Backup application data only"
    echo "  config          Backup configuration only"
    echo "  list            List available backups"
    echo "  restore-db FILE Restore database from backup file"
    echo "  cleanup         Clean up old backups only"
    echo ""
    echo "Options:"
    echo "  --backup-dir DIR       Backup directory (default: /opt/roomicor/backups)"
    echo "  --retention-days DAYS  Retention period in days (default: 30)"
    echo "  --no-compression       Disable compression"
    echo "  --encrypt              Enable encryption (requires ENCRYPTION_KEY)"
    echo "  --s3                   Upload to S3 (requires S3_BUCKET)"
    echo "  --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_DIR            Backup directory path"
    echo "  RETENTION_DAYS        Backup retention in days"
    echo "  COMPRESSION           Enable compression (true/false)"
    echo "  ENCRYPTION            Enable encryption (true/false)"
    echo "  ENCRYPTION_KEY        Encryption key for backup files"
    echo "  S3_BACKUP             Enable S3 upload (true/false)"
    echo "  S3_BUCKET             S3 bucket name"
    echo "  DATABASE_URL          PostgreSQL connection string"
    echo "  SUPABASE_PROJECT_REF  Supabase project reference"
    echo "  SLACK_WEBHOOK_URL     Slack webhook for notifications"
}

# Parse command line arguments
COMMAND="backup"

while [[ $# -gt 0 ]]; do
    case $1 in
        backup|database|app-data|config|list|cleanup)
            COMMAND="$1"
            shift
            ;;
        restore-db)
            COMMAND="restore-db"
            RESTORE_FILE="$2"
            shift 2
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --retention-days)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --no-compression)
            COMPRESSION=false
            shift
            ;;
        --encrypt)
            ENCRYPTION=true
            shift
            ;;
        --s3)
            S3_BACKUP=true
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

# Main execution
case "$COMMAND" in
    "backup")
        run_backup
        ;;
    "database")
        create_backup_dirs
        trap cleanup_temp EXIT
        backup_database
        ;;
    "app-data")
        create_backup_dirs
        trap cleanup_temp EXIT
        backup_app_data
        ;;
    "config")
        create_backup_dirs
        trap cleanup_temp EXIT
        backup_config
        ;;
    "list")
        list_backups
        ;;
    "restore-db")
        if [[ -z "${RESTORE_FILE:-}" ]]; then
            error "Please specify backup file to restore"
            echo "Usage: $0 restore-db <backup_file>"
            exit 1
        fi
        restore_database "$RESTORE_FILE"
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    *)
        error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac