# QA Tests

This directory contains Playwright tests created by Sentinel (QA agent) during task verification.

Tests are automatically generated for each task that enters the review lane.

## Running tests manually

```bash
cd /path/to/Claw-Control-Center
node tests/qa/{test-file}.mjs
```

## Test structure

Each test:
1. Navigates to the feature
2. Verifies functionality (clicks, inputs, API responses)
3. Takes a screenshot
4. Analyzes the screenshot with vision for visual correctness
