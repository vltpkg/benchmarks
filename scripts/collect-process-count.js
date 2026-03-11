const fs = require('fs');
const path = require('path');

// Read the output folder from first positional argument
const outputFolder = process.argv[2];
if (!outputFolder) {
  throw new Error('Output folder not found');
}

// Try to read existing process-count.json or start with empty object
const processCountPath = path.resolve(outputFolder, 'process-count.json');
let result;
try {
  const existingData = fs.readFileSync(processCountPath, 'utf8');
  result = JSON.parse(existingData);
} catch (error) {
  // File doesn't exist or can't be parsed, start with empty object
  result = {};
}

// Define the possible count files and their corresponding package manager names
const countFiles = [
  { filename: 'npm-process-count.txt', pmName: 'npm' },
  { filename: 'yarn-process-count.txt', pmName: 'yarn' },
  { filename: 'berry-process-count.txt', pmName: 'berry' },
  { filename: 'zpm-process-count.txt', pmName: 'zpm' },
  { filename: 'pnpm-process-count.txt', pmName: 'pnpm' },
  { filename: 'vlt-process-count.txt', pmName: 'vlt' },
  { filename: 'bun-process-count.txt', pmName: 'bun' },
  { filename: 'deno-process-count.txt', pmName: 'deno' },
  { filename: 'nx-process-count.txt', pmName: 'nx' },
  { filename: 'turbo-process-count.txt', pmName: 'turbo' },
  { filename: 'node-process-count.txt', pmName: 'node' },
];

let found = false;
for (const { filename, pmName } of countFiles) {
  const filePath = path.resolve(outputFolder, filename);
  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch {
    // File doesn't exist or can't be read, try next one
    continue;
  }
  found = true;
  console.log('Read file path:', filePath);

  // Parse each line as a number
  const lines = fileContent.trim().split('\n').filter(line => line.trim() !== '');
  const countValues = lines.map(line => parseInt(line.trim(), 10)).filter(num => !isNaN(num));

  // If there are no valid count values, log a warning and skip
  if (countValues.length === 0) {
    console.warn(`No valid count values found for ${pmName}`);
    continue;
  }

  // Keep references to found count values
  let count, minCount, maxCount;

  if (countValues.every(value => value === countValues[0])) {
    // All values are the same
    count = countValues[0];
  } else {
    // Different values found
    minCount = Math.min(...countValues);
    maxCount = Math.max(...countValues);
    // Calculate average
    const sum = countValues.reduce((acc, val) => acc + val, 0);
    count = Math.round(sum / countValues.length);
  }

  // Update the result object
  if (minCount !== undefined && maxCount !== undefined) {
    result[pmName] = { count, minCount, maxCount };
  } else {
    result[pmName] = { count };
  }

  // Remove the temp file after reading it
  fs.unlinkSync(filePath);
}

// If no count file was found, log a warning and exit
if (!found) {
  console.warn('Could not read any temporary process count file');
  process.exit(0);
}

// Save the updated result back to the JSON file
fs.writeFileSync(processCountPath, JSON.stringify(result, null, 2));

console.log('Successfully collected process count data');
