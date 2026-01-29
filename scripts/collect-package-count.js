const fs = require('fs');
const path = require('path');

// Read the output folder from first positional argument
const outputFolder = process.argv[2];
if (!outputFolder) {
  throw new Error('Output folder not found');
}

// Try to read existing package-count.json or start with empty object
const packageCountPath = path.resolve(outputFolder, 'package-count.json');
let result;
try {
  const existingData = fs.readFileSync(packageCountPath, 'utf8');
  result = JSON.parse(existingData);
} catch (error) {
  // File doesn't exist or can't be parsed, start with empty object
  result = {};
}

// Define the possible count files and their corresponding package manager names
const countFiles = [
  { filename: 'npm-count.txt', pmName: 'npm' },
  { filename: 'yarn-count.txt', pmName: 'yarn' },
  { filename: 'berry-count.txt', pmName: 'berry' },
  { filename: 'zpm-count.txt', pmName: 'zpm' },
  { filename: 'pnpm-count.txt', pmName: 'pnpm' },
  { filename: 'vlt-count.txt', pmName: 'vlt' },
  { filename: 'bun-count.txt', pmName: 'bun' },
  { filename: 'deno-count.txt', pmName: 'deno' }
];

let pmName = null;
let countData = null;
for (const { filename, pmName: pm } of countFiles) {
  const filePath = path.resolve(outputFolder, filename);
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    pmName = pm;
    countData = fileContent;
  } catch {
    // File doesn't exist or can't be read, try next one
    continue;
  }
  console.log('Read file path:', filePath);

  // Parse each line as a number
  const lines = countData.trim().split('\n').filter(line => line.trim() !== '');
  const countValues = lines.map(line => parseInt(line.trim(), 10)).filter(num => !isNaN(num));

  // if there are no valid count values, log a warning and exit
  if (countValues.length === 0) {
    console.warn('No valid count values found in the temporary count file');
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

  // Remove the file after reading it
  fs.unlinkSync(filePath);
}

// If no count file was found, log a warning and exit
if (!pmName || !countData) {
  console.warn('Could not read any temporary count file');
  process.exit(0);
}

// Save the updated result back to the JSON file
fs.writeFileSync(packageCountPath, JSON.stringify(result, null, 2));

console.log(`Successfully collected package count data`);
