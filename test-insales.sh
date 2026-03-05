#!/bin/bash

# InSales Integration Test Runner
# Usage: bash test-insales.sh

echo "🚀 Starting InSales Integration Tests..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Run the test script
npx tsx scripts/test-insales-integration.ts

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
else
    echo ""
    echo "❌ Some tests failed. Check the output above."
fi

exit $exit_code
