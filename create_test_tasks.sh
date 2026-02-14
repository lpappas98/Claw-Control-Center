#!/bin/bash

# Create 12 test tasks with different priorities and tags across lanes
# Put 8 of them in the "proposed" lane to trigger the overflow

TASKS=(
  '{"title":"Test Epic Task 1","priority":"P0","lane":"proposed","tag":"Epic","owner":"Forge"}'
  '{"title":"Test UI Task 1","priority":"P0","lane":"proposed","tag":"UI","owner":"Patch"}'
  '{"title":"Test Backend Task 1","priority":"P1","lane":"proposed","tag":"Backend"}'
  '{"title":"Test QA Task 1","priority":"P1","lane":"proposed","tag":"QA","owner":"Sentinel"}'
  '{"title":"Test Architecture Review","priority":"P0","lane":"proposed","tag":"Architecture"}'
  '{"title":"Test Cleanup Task 1","priority":"P2","lane":"proposed","tag":"Cleanup"}'
  '{"title":"Test Fix High Priority","priority":"P0","lane":"proposed","tag":"Fix","owner":"Forge"}'
  '{"title":"Test E2E Test Suite","priority":"P2","lane":"proposed","tag":"Test"}'
  '{"title":"Task in Queued Lane","priority":"P1","lane":"queued","tag":"UI"}'
  '{"title":"Task in Development","priority":"P2","lane":"development","tag":"Backend"}'
  '{"title":"Task in Review","priority":"P3","lane":"review","tag":"QA"}'
  '{"title":"Completed Task","priority":"P0","lane":"done","tag":"Epic"}'
)

echo "Creating ${#TASKS[@]} test tasks..."

for i in "${!TASKS[@]}"; do
  RESPONSE=$(curl -s -X POST http://localhost:8787/api/tasks \
    -H 'Content-Type: application/json' \
    -d "${TASKS[$i]}")
  
  ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  echo "✓ Created task $((i+1))/${#TASKS[@]}: $ID"
done

echo ""
echo "All test tasks created!"
