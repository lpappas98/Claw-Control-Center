#!/bin/bash

################################################################################
# Claw Control Center - Restore Script
#
# Usage: ./scripts/restore.sh <backup_path> [--force]
#
# Examples:
#   ./scripts/restore.sh /data/backups/claw-backup-2024-02-14-120000
#   ./scripts/restore.sh /data/backups/claw-backup-2024-02-14-120000.tar.gz
#   ./scripts/restore.sh /data/backups/claw-backup-2024-02-14-120000 --force
#
# Restores the .clawhub directory from a backup.
# Creates a backup of current data before restoring.
# By default, aborts if current .clawhub directory exists (use --force to override).
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_PATH="${1:-.}"
FORCE="${2:-false}"
CLAWHUB_DIR="./.clawhub"
RESTORE_TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
RECOVERY_DIR="./.clawhub.recovery-${RESTORE_TIMESTAMP}"

# Validate input
if [ -z "$BACKUP_PATH" ] || [ "$BACKUP_PATH" = "." ]; then
    echo -e "${RED}❌ Error: Backup path required${NC}"
    echo "Usage: ./scripts/restore.sh <backup_path> [--force]"
    exit 1
fi

if [ "$FORCE" = "--force" ]; then
    FORCE=true
fi

echo -e "${BLUE}🔄 Claw Control Center - Restore Backup${NC}"
echo "Backup: $BACKUP_PATH"
echo ""

# Determine backup type (compressed or directory)
if [ -f "$BACKUP_PATH.tar.gz" ]; then
    BACKUP_PATH="${BACKUP_PATH}.tar.gz"
elif [ -f "$BACKUP_PATH" ] && file "$BACKUP_PATH" | grep -q "gzip"; then
    # It's already a .tar.gz file
    :
elif [ ! -d "$BACKUP_PATH" ]; then
    echo -e "${RED}❌ Error: Backup not found at $BACKUP_PATH${NC}"
    echo "Tried:"
    echo "  - $BACKUP_PATH"
    echo "  - ${BACKUP_PATH}.tar.gz"
    exit 1
fi

echo "📦 Backup type: $([ -f "$BACKUP_PATH" ] && echo "Archive (tar.gz)" || echo "Directory")"

# Check if .clawhub already exists
if [ -d "$CLAWHUB_DIR" ] && [ "$FORCE" != "true" ]; then
    echo -e "${YELLOW}⚠️  Current .clawhub directory exists${NC}"
    echo ""
    echo "To prevent data loss, restore will create a recovery backup first."
    echo "Current directory will be saved as:"
    echo "  $RECOVERY_DIR"
    echo ""
    read -p "Continue with restore? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Create temporary extraction directory
TEMP_RESTORE=$(mktemp -d)
trap "rm -rf $TEMP_RESTORE" EXIT

echo ""
echo "📖 Extracting backup..."

# Extract backup
if [ -f "$BACKUP_PATH" ]; then
    # It's a compressed archive
    tar -xzf "$BACKUP_PATH" -C "$TEMP_RESTORE"
else
    # It's a directory
    cp -r "$BACKUP_PATH" "$TEMP_RESTORE/backup-content"
fi

echo "✅ Backup extracted"

# Verify backup metadata
if [ -f "$TEMP_RESTORE/backup-metadata.json" ]; then
    echo ""
    echo "📋 Backup Information:"
    cat "$TEMP_RESTORE/backup-metadata.json" | grep -E '"timestamp"|"hostname"|"clawhub_size"|"files_count"' | sed 's/.*: "/  /' | sed 's/".*//' || true
fi

# Find clawhub directory in extraction (handle both direct and nested cases)
EXTRACTED_CLAWHUB="$TEMP_RESTORE/clawhub"
if [ ! -d "$EXTRACTED_CLAWHUB" ]; then
    # Try to find it
    EXTRACTED_CLAWHUB=$(find "$TEMP_RESTORE" -maxdepth 2 -type d -name "clawhub" | head -1)
fi

if [ ! -d "$EXTRACTED_CLAWHUB" ]; then
    echo -e "${RED}❌ Error: clawhub directory not found in backup${NC}"
    exit 1
fi

# Backup current .clawhub if it exists
if [ -d "$CLAWHUB_DIR" ]; then
    echo ""
    echo "💾 Saving current .clawhub as recovery backup..."
    mkdir -p "${RECOVERY_DIR}"
    cp -r "$CLAWHUB_DIR"/* "${RECOVERY_DIR}/" 2>/dev/null || true
    echo -e "${GREEN}✅ Recovery backup created at ${RECOVERY_DIR}${NC}"
fi

# Restore from backup
echo ""
echo "🔄 Restoring .clawhub..."
mkdir -p "$CLAWHUB_DIR"
cp -r "$EXTRACTED_CLAWHUB"/* "$CLAWHUB_DIR/" 2>/dev/null || true

echo -e "${GREEN}✅ Restore complete!${NC}"
echo ""
echo "📊 Restore Summary:"
echo "  Files restored: $(find $CLAWHUB_DIR -type f | wc -l)"
echo "  Size: $(du -sh $CLAWHUB_DIR | cut -f1)"
echo "  Location: $CLAWHUB_DIR"
if [ -d "$RECOVERY_DIR" ]; then
    echo "  Recovery backup: $RECOVERY_DIR"
fi
echo ""

# Verify restoration
if [ -d "$CLAWHUB_DIR" ]; then
    if [ -f "$CLAWHUB_DIR/tasks.json" ] || [ -f "$CLAWHUB_DIR/agents.json" ]; then
        echo -e "${GREEN}✅ Backup verification: OK${NC}"
        echo ""
        echo "💡 Next steps:"
        echo "  1. Verify the restored data looks correct"
        echo "  2. If needed, restore services: systemctl restart claw-bridge claw-ui"
        echo "  3. If restore was unsuccessful, restore the recovery backup:"
        echo "     rm -rf $CLAWHUB_DIR && mv $RECOVERY_DIR $CLAWHUB_DIR"
    else
        echo -e "${YELLOW}⚠️  Warning: Restored .clawhub seems incomplete${NC}"
        echo "Files found: $(ls -la $CLAWHUB_DIR | head -5)"
    fi
else
    echo -e "${RED}❌ Error: Restore failed${NC}"
    exit 1
fi
