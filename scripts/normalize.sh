#!/bin/bash

# Input file paths
BENCHMARKS_FILE="benchmarks.json"
PACKAGE_COUNT_FILE="package-count.json"

# Output file paths
OUTPUT_FILE="results.json"
ERROR_LOG="error-log.json"

# Parse benchmarks and package counts
results=$(jq -n \
  --argfile benchmarks "$BENCHMARKS_FILE" \
  --argfile package_counts "$PACKAGE_COUNT_FILE" \
  '
  $benchmarks.results | 
  map(
    if .exit_codes | all(. == 0) and $package_counts[.command] != null and $package_counts[.command] > 0 then
      {
        command: .command,
        total_mean_speed: .mean,
        total_package_count: $package_counts[.command],
        normalized_speed: (.mean / $package_counts[.command]),
        error: false
      }
    else
      {
        command: .command,
        total_mean_speed: .mean,
        total_package_count: ($package_counts[.command] // 0),
        normalized_speed: null,
        error: true,
        error_reason: (
          if .exit_codes | any(. != 0) then "Non-zero exit codes in benchmarks"
          elif $package_counts[.command] == null or $package_counts[.command] == 0 then "Zero or missing package count"
          else "Unknown error"
          end
        )
      }
    end
  )
')

# Split valid results and errors
valid_results=$(echo "$results" | jq '[.[] | select(.error == false)]')
errors=$(echo "$results" | jq '[.[] | select(.error == true)]')

# Save combined results and errors
echo "$results" | jq '.' > "$OUTPUT_FILE"
echo "$errors" | jq '.' > "$ERROR_LOG"

# Display results
echo "Results written to $OUTPUT_FILE"
echo "Errors logged to $ERROR_LOG"