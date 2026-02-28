# Exit on error
set -Eeuxo pipefail

# Get current date for results directory
DATE=$(date +%Y-%m-%d)

# Create results directory structure
mkdir -p "results/$DATE"
mkdir -p "results/latest"

# Clean benchmark files before processing summaries and chart data.
node ./scripts/clean-benchmarks.js ./results

# Find any versions.json file from downloaded artifacts, otherwise use local one
if [ -d "versions-temp" ]; then
    find versions-temp -name "versions.json" -type f | head -1 | xargs -I {} cp {} "./results/$DATE/versions.json" || echo "No versions.json found in versions-temp"
elif [ -f "results/versions.json" ]; then
    cp "results/versions.json" "./results/$DATE/versions.json"
else
    echo "No versions.json found"
fi

resolve_result_path() {
    local fixture=$1
    local variation=$2
    local filename=$3

    local artifact_path="results/results-$fixture-$variation/$filename"
    local local_path="results/$fixture/$variation/$filename"

    if [ -f "$artifact_path" ]; then
        echo "$artifact_path"
        return 0
    fi

    if [ -f "$local_path" ]; then
        echo "$local_path"
        return 0
    fi

    return 1
}

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
for fixture in next astro svelte vue large babylon; do
    for variation in cache cache+lockfile cache+lockfile+node_modules cache+node_modules clean lockfile lockfile+node_modules node_modules run; do
        if benchmark_file=$(resolve_result_path "$fixture" "$variation" "benchmarks.json"); then
            print_summary "$benchmark_file" "$fixture" "$variation"
            cp "$benchmark_file" "results/$DATE/$fixture-$variation.json"
            cp "$benchmark_file" "results/latest/$fixture-$variation.json"
        else
            echo "Warning: No results found for $fixture & $variation"
        fi

        if package_count_file=$(resolve_result_path "$fixture" "$variation" "package-count.json"); then
            print_package_count "$package_count_file" "$fixture" "$variation"
            cp "$package_count_file" "results/$DATE/$fixture-$variation-package-count.json"
            cp "$package_count_file" "results/latest/$fixture-$variation-package-count.json"
        else
            echo "Warning: No package count found for $fixture & $variation"
        fi
    done
done

# Process registry variation results
for fixture in next astro svelte vue large babylon; do
    for variation in registry-clean registry-lockfile; do
        if benchmark_file=$(resolve_result_path "$fixture" "$variation" "benchmarks.json"); then
            print_summary "$benchmark_file" "$fixture" "$variation"
            cp "$benchmark_file" "results/$DATE/$fixture-$variation.json"
            cp "$benchmark_file" "results/latest/$fixture-$variation.json"
        else
            echo "Warning: No results found for $fixture & $variation"
        fi
    done
done

# Process run results
if run_file=$(resolve_result_path "run" "run" "benchmarks.json"); then
    print_summary "$run_file" "run" "run"
    cp "$run_file" "results/$DATE/run-run.json"
    cp "$run_file" "results/latest/run-run.json"
else
    echo "Warning: No results found for run"
fi

# Generate visualization
echo "Generating visualization..."
if ! node scripts/generate-chart.js "$DATE"; then
    echo "Error: Failed to generate chart"
    exit 1
fi

# Copy chart data to latest
cp "results/$DATE/chart-data.json" "results/latest/chart-data.json"

echo "Results processing complete!"

