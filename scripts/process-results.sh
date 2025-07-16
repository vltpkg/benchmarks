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
    
    echo "=== $fixture ($variation) ==="
    if ! jq -r '.results[] | "\(.command): \(.mean)s (stddev: \(.stddev)s)"' "$file"; then
        echo "Warning: Could not parse results from $file"
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
    done
done

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

echo "Results processing complete!" 
