# Exit on error
set -Eeuxo pipefail

# Get current date for results directory
DATE=$(date +%Y-%m-%d)

# Create results directory structure
mkdir -p "chart/results/$DATE"

# Function to print summary of results
print_summary() {
    local file=$1
    local fixture=$2
    local variation=$3

    if [ ! -f "$file" ]; then
        echo "Warning: Results file $file not found"
        return 1
    fi

    echo "=== RESULTS: $fixture ($variation) ==="
    if ! jq -r '.results[] | "\(.command): \(.mean)s (stddev: \(.stddev)s)"' "$file"; then
        echo "Warning: Could not parse results from $file"
        return 1
    fi
    echo
}

print_package_count() {
    local file=$1
    local fixture=$2
    local variation=$3

    if [ ! -f "$file" ]; then
        echo "Warning: Package count file $file not found"
        return 1
    fi

    echo "=== PACKAGE COUNT: $fixture ($variation) ==="
    if ! node -p "console.table(JSON.parse(fs.readFileSync('$file', 'utf8')))"; then
        echo "Warning: Could not parse package count from $file"
        return 1
    fi
    echo
}

# Process and copy results
echo "Processing results..."

# Process variations results
for fixture in next astro svelte vue; do
    for variation in cache cache+lockfile cache+lockfile+node_modules cache+node_modules clean lockfile lockfile+node_modules node_modules run; do
        if [ -f "results/results-$fixture-$variation/benchmarks.json" ]; then
            print_summary "results/results-$fixture-$variation/benchmarks.json" "$fixture" "$variation"
            cp "results/results-$fixture-$variation/benchmarks.json" "chart/results/$DATE/$fixture-$variation.json"
        else
            echo "Warning: No results found for $fixture & $variation"
        fi

        if [ -f "results/results-$fixture-$variation/package-count.json" ]; then
            print_package_count "results/results-$fixture-$variation/package-count.json" "$fixture" "$variation"
            cp "results/results-$fixture-$variation/package-count.json" "chart/results/$DATE/$fixture-$variation-package-count.json"
        else
            echo "Warning: No package count found for $fixture & $variation"
        fi
    done
done

# Process run results
if [ -f "results/results-run-run/benchmarks.json" ]; then
    print_summary "results/results-run-run/benchmarks.json" "run" "run"
    cp "results/results-run-run/benchmarks.json" "chart/results/$DATE/run-run.json"
else
    echo "Warning: No results found for run"
fi

# Generate visualization
echo "Generating visualization..."
if ! node scripts/generate-chart.js "$DATE"; then
    echo "Error: Failed to generate chart"
    exit 1
fi

# Create a results directory
mkdir -p charts

# Copy static files
echo "Copying static files..."
cp chart/results/$DATE/index.html charts/index.html
cp chart/results/$DATE/index.html charts/$DATE.html

echo "Results processing complete!"

