#!/bin/bash

# Exit on error
set -e

# Get current date for results directory
DATE=$(date +%Y-%m-%d)

# Create results directory structure
mkdir -p "chart/results/$DATE"

# Function to print summary of results
print_summary() {
    local file=$1
    local project=$2
    local cache=$3
    
    if [ ! -f "$file" ]; then
        echo "Warning: Results file $file not found"
        return 1
    }
    
    echo "=== $project ($cache cache) ==="
    if ! jq -r '.results[] | "\(.command): \(.mean)s (stddev: \(.stddev)s)"' "$file"; then
        echo "Warning: Could not parse results from $file"
        return 1
    fi
    echo
}

# Process and copy results
echo "Processing results..."

# Process task execution results
if [ -f "results/run.json" ]; then
    print_summary "results/run.json" "Task Execution" "N/A"
    cp "results/run.json" "chart/results/$DATE/task-execution.json"
else
    echo "Warning: No task execution results found"
fi

# Process project results
for project in next astro svelte vue; do
    for cache in cold warm; do
        if [ -f "results/$project/benchmarks-$cache.json" ]; then
            print_summary "results/$project/benchmarks-$cache.json" "$project" "$cache"
            cp "results/$project/benchmarks-$cache.json" "chart/results/$DATE/$project-$cache.json"
        else
            echo "Warning: No results found for $project ($cache cache)"
        fi
    done
done

# Check if we have any results to process
if [ ! -f "chart/results/$DATE/task-execution.json" ] && [ ! -f "chart/results/$DATE/next-cold.json" ]; then
    echo "Error: No benchmark results found to process"
    exit 1
fi

# Generate visualization
echo "Generating visualization..."
if ! node scripts/generate-chart.js "$DATE"; then
    echo "Error: Failed to generate chart"
    exit 1
fi

# Copy static files
echo "Copying static files..."
cp chart/index.html chart/results/
cp chart/styles.css chart/results/
cp chart/script.js chart/results/

echo "Results processing complete!" 