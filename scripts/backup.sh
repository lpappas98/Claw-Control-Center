#!/bin/bash

################################################################################
# Claw Control Center - Backup Script
# 
# Usage: ./scripts/backup.sh [destination_dir] [compress]
#
# Examples:
#   ./scripts/backup.sh                    # Backup to /data/backups
#   ./scripts/backup.sh /mnt/backup        # Backup to /mnt/backup
#   ./scripts/backup.sh /mnt/backup true   # Backup and compress
#
# Backs up:
#   - .clawhub/ directory (all task/agent/project data)
#   - Database backups (if applicable)
#   - Configuration files
#
# Creates timestamped backups in the format:
#   claw-backup-YYYY-MM-DD-HHmmss[.tar.gz]
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${1:-./.clawhub/backups}"
COMPRESS="${2:-false}"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_NAME="claw-backup-${TIMESTAMP}"
CLAWHUB_DIR="./.clawhub"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}🔄 Starting Claw Control Center backup...${NC}"
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Check if .clawhub directory exists
if [ ! -d "$CLAWHUB_DIR" ]; then
    echo -e "${RED}❌ Error: .clawhub directory not found at $CLAWHUB_DIR${NC}"
    exit 1
fi

# Create temporary backup directory
TEMP_BACKUP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_BACKUP_DIR" EXIT

echo "📦 Preparing backup contents..."

# Copy .clawhub directory
cp -r "$CLAWHUB_DIR" "$TEMP_BACKUP_DIR/clawhub"

# Create backup metadata
cat > "$TEMP_BACKUP_DIR/backup-metadata.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "version": "1.0.0",
  "backup_name": "$BACKUP_NAME",
  "clawhub_size": "$(du -sh $CLAWHUB_DIR | cut -f1)",
  "files_count": $(find $CLAWHUB_DIR -type f | wc -l)
}
EOF

echo "✅ Backup contents prepared"

# Create backup archive
if [ "$COMPRESS" = "true" ]; then
    echo "🗜️  Compressing backup..."
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    tar -czf "$BACKUP_PATH" -C "$TEMP_BACKUP_DIR" . 2>/dev/null
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo -e "${GREEN}✅ Backup created and compressed${NC}"
else
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
    cp -r "$TEMP_BACKUP_DIR" "$BACKUP_PATH"
    BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
    echo -e "${GREEN}✅ Backup created${NC}"
fi

echo ""
echo "📊 Backup Summary:"
echo "  Name: $BACKUP_NAME"
echo "  Location: $BACKUP_PATH"
echo "  Size: $BACKUP_SIZE"
echo "  Format: $([ "$COMPRESS" = "true" ] && echo "Compressed (tar.gz)" || echo "Directory")"
echo ""

# List recent backups
echo "📋 Recent backups:"
ls -lhtr "${BACKUP_DIR}" | tail -5

# Cleanup old backups (keep last 7 days)
echo ""
echo "🧹 Cleaning up old backups (keeping 7 days)..."
find "${BACKUP_DIR}" -type f -mtime +7 -name "claw-backup-*" -delete
find "${BACKUP_DIR}" -type d -mtime +7 -name "claw-backup-*" -exec rm -rf {} \; 2>/dev/null || true

echo -e "${GREEN}✅ Backup complete!${NC}"
echo ""
echo "💡 To restore this backup, run:"
echo "   ./scripts/restore.sh ${BACKUP_PATH}"
