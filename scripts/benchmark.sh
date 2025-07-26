# Exit on error
set -Eeuxo pipefail

# Check if fixture name is provided
if [ -z "$1" ]; then
    echo "Error: Fixture name not provided"
    echo "Usage: $0 <fixture-name> <variation>"
    exit 1
fi

# Check if variation is provided
if [ -z "$2" ]; then
    echo "Error: Benchmark variation not provided"
    echo "Usage: $0 <fixture-name> <variation>"
    exit 1
fi

# Navigate to the fixture directory
pushd "./fixtures/$1"

# Run the install variation
case "$2" in
    cache)
        bash ../../scripts/variations/cache.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    cache+lockfile)
        bash ../../scripts/variations/cache+lockfile.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    cache+node_modules)
        bash ../../scripts/variations/cache+node_modules.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    cache+lockfile+node_modules)
        bash ../../scripts/variations/cache+lockfile+node_modules.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    lockfile)
        bash ../../scripts/variations/lockfile.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    lockfile+node_modules)
        bash ../../scripts/variations/lockfile+node_modules.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    node_modules)
        bash ../../scripts/variations/node_modules.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    clean)
        bash ../../scripts/variations/clean.sh "../../scripts" "../../results" "$1" "$2"
        ;;
    run)
        bash ../../scripts/variations/run.sh "../../scripts" "../../results" "run" "run"
        ;;
    *)
        echo "Error: Unknown install variation '$2'"
        exit 1
        ;;
esac

popd
echo "Installation benchmark suite completed successfully!"
