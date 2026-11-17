// Counts the packages a project can actually reach from its package.json
// files, by walking the dependency graph with Node's resolution algorithm.
//
// Scanning node_modules for package.json files counts whatever a package
// manager left on disk: aube and upm keep removed packages in their
// .aube/.upm store folders, and vlt can leave a removed package in a
// .VLT.DELETE.* folder while it deletes it in the background. Walking the
// graph only counts what is installed for the current package.json.
//
// Usage: node package-count.js [project-dir]
// Prints the count to stdout.

const fs = require('fs');
const path = require('path');

const DEP_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const ROOT_DEP_FIELDS = [...DEP_FIELDS, 'devDependencies'];

module.exports = { countPackages };

if (require.main === module) {
  console.log(countPackages(path.resolve(process.argv[2] || '.')));
}

// Returns the number of unique package folders (by real path) reachable from
// the project root and its workspaces. Workspaces themselves aren't counted.
function countPackages(projectDir) {
  const root = fs.realpathSync(projectDir);
  const roots = new Set([root, ...findWorkspaces(root)]);
  const seen = new Set();
  const queue = [...roots].map((dir) => ({ dir, fields: ROOT_DEP_FIELDS }));

  while (queue.length) {
    const { dir, fields } = queue.shift();
    const manifest = readManifest(dir);
    if (!manifest) continue;

    for (const name of dependencyNames(manifest, fields)) {
      const resolved = resolvePackage(name, dir, root);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      // workspaces reached through a symlink are walked as roots already
      if (!roots.has(resolved)) queue.push({ dir: resolved, fields: DEP_FIELDS });
    }
  }

  return [...seen].filter((dir) => !roots.has(dir)).length;
}

// Workspace folders from package.json `workspaces` and pnpm-workspace.yaml.
function findWorkspaces(root) {
  const manifest = readManifest(root) || {};
  const patterns = [
    ...(Array.isArray(manifest.workspaces)
      ? manifest.workspaces
      : manifest.workspaces?.packages || []),
    ...pnpmWorkspacePatterns(root),
  ];
  const dirs = new Set();
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue;
    for (const match of fs.globSync(pattern, {
      cwd: root,
      exclude: (name) => name === 'node_modules',
    })) {
      const dir = path.join(root, match);
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        dirs.add(fs.realpathSync(dir));
      }
    }
  }
  dirs.delete(root);
  return dirs;
}

// Node's lookup: <dir>/node_modules/<name>, then each parent folder's
// node_modules. Returns the real path. Inside the project it stops at the
// root. Packages can also live outside it (aube links from a global virtual
// store), and there it stops once it leaves the store's node_modules tree.
function resolvePackage(name, fromDir, root) {
  const inProject = fromDir === root || fromDir.startsWith(root + path.sep);
  let dir = fromDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return fs.realpathSync(candidate);
    }
    if (inProject ? dir === root : !dir.split(path.sep).includes('node_modules')) {
      return undefined;
    }
    dir = path.dirname(dir);
  }
}

function dependencyNames(manifest, fields) {
  const names = new Set();
  for (const field of fields) {
    for (const name of Object.keys(manifest[field] || {})) names.add(name);
  }
  return names;
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

// Minimal parse of the `packages:` list; enough for the fixtures.
function pnpmWorkspacePatterns(root) {
  let yaml;
  try {
    yaml = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  } catch {
    return [];
  }
  const patterns = [];
  let inPackages = false;
  for (const line of yaml.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
    } else if (inPackages && /^\s+-\s+/.test(line)) {
      patterns.push(line.replace(/^\s+-\s+/, '').replace(/^['"]|['"]\s*$/g, '').trim());
    } else if (inPackages && /^\S/.test(line)) {
      inPackages = false;
    }
  }
  return patterns;
}
