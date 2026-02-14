#!/bin/bash
# Migrate custom .btn classes to shadcn Button component

FILES=$(find src -name "*.tsx" -type f)

for file in $FILES; do
  # Skip if file already imports Button from ui
  if grep -q 'import.*Button.*from.*@/components/ui/button' "$file"; then
    echo "Skipping $file (already imports Button)"
    continue
  fi
  
  # Check if file uses .btn classes
  if grep -q 'className="btn' "$file"; then
    echo "Migrating $file..."
    
    # Add Button import at top (after React import)
    sed -i '/^import.*React/a import { Button } from "@/components/ui/button"' "$file"
    
    # Replace button with className="btn" → <Button>
    sed -i 's/<button className="btn"/<Button variant="default"/g' "$file"
    
    # Replace button with className="btn ghost" → <Button variant="ghost">
    sed -i 's/<button className="btn ghost"/<Button variant="ghost"/g' "$file"
    
    # Replace </button> → </Button> (where Button is used)
    # This is tricky, will need manual review
    
    echo "  → Updated $file (manual review needed for closing tags)"
  fi
done

echo ""
echo "Migration complete. Please review changes and update closing tags manually."
