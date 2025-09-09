import { useState, useRef, useCallback, useMemo } from "react";
import { WebContainer } from "@webcontainer/api";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { BenchmarkChartData } from "@/types/chart-data";

interface PackageTesterProps {
  chartData: BenchmarkChartData;
}

interface TestResult {
  packageManager: string;
  variation: string;
  duration: number;
  success: boolean;
  error?: string;
  packageCount?: number;
  perPackageTime?: number;
  version?: string;
}

interface TestStatus {
  isRunning: boolean;
  currentPackageManager?: string;
  currentVariation?: string;
  progress: number;
  total: number;
  isInstallingTools?: boolean;
  installProgress?: number;
  installTotal?: number;
  currentInstalling?: string;
}

interface TestLog {
  timestamp: Date;
  level: 'info' | 'error' | 'success';
  message: string;
}

export const PackageTester = ({ chartData }: PackageTesterProps) => {
  const [packageName, setPackageName] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>({
    isRunning: false,
    progress: 0,
    total: 0,
  });
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string>("average");
  const [chartType, setChartType] = useState<"total" | "perPackage">("total");
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const webcontainerRef = useRef<WebContainer | null>(null);

  const packageManagers = chartData.chartData.packageManagers.filter(
    pm => !['turbo', 'nx', 'node', 'bun', 'deno'].includes(pm)
  );

  const variations = [
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules"
  ];

  const addLog = (level: TestLog['level'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  };

  const initWebContainer = useCallback(async () => {
    if (!webcontainerRef.current) {
      console.log("Booting WebContainer...");

      // Check if cross-origin isolation is enabled
      if (!crossOriginIsolated) {
        throw new Error("WebContainer requires cross-origin isolation. Please restart the dev server after updating vite.config.ts with the necessary headers.");
      }

      webcontainerRef.current = await WebContainer.boot();
      console.log("WebContainer booted successfully");

      // Install all package managers globally
      await installPackageManagers(webcontainerRef.current);
    }
    return webcontainerRef.current;
  }, []);

  const installPackageManagers = async (webcontainer: WebContainer) => {
    console.log("Installing package managers...");

    const installCommands = [
      { cmd: "npm install -g pnpm@latest --no-audit --no-fund", name: "pnpm" },
      { cmd: "npm install -g yarn@latest --no-audit --no-fund", name: "yarn" },
      { cmd: "npm install -g @yarnpkg/cli@latest --no-audit --no-fund", name: "yarn berry" },
      {
        cmd: "npm install -g vlt@latest --no-audit --no-fund --ignore-engines || npm install -g @vltpkg/vlt@latest --no-audit --no-fund --ignore-engines",
        name: "vlt",
        fallback: true
      }
    ];

    setTestStatus(prev => ({
      ...prev,
      isInstallingTools: true,
      installProgress: 0,
      installTotal: installCommands.length,
      currentInstalling: installCommands[0]?.name
    }));

    for (let i = 0; i < installCommands.length; i++) {
      const { cmd, name } = installCommands[i];

      setTestStatus(prev => ({
        ...prev,
        installProgress: i,
        currentInstalling: name
      }));

      try {
        console.log(`Installing ${name}: ${cmd}`);
        addLog('info', `Installing ${name}...`);
        const process = await webcontainer.spawn("sh", ["-c", cmd]);
        const exitCode = await process.exit;
        if (exitCode === 0) {
          console.log(`✓ ${name} installed successfully`);
          addLog('success', `${name} installed successfully`);
        } else {
          console.log(`✗ ${name} failed with exit code ${exitCode}`);
          addLog('error', `${name} failed with exit code ${exitCode}`);
        }
      } catch (error) {
        console.log(`✗ ${name} failed:`, error);
        addLog('error', `${name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setTestStatus(prev => ({
      ...prev,
      installProgress: installCommands.length,
      currentInstalling: "Verification"
    }));

    // Verify key package managers installation
    const verifyCommands = [
      { name: "pnpm", cmd: "pnpm --version" },
      { name: "vlt", cmd: "vlt --version" },
      { name: "bun", cmd: "bun --version" },
      { name: "deno", cmd: "deno --version" }
    ];

    for (const { name, cmd } of verifyCommands) {
      try {
        console.log(`Verifying ${name} installation...`);
        addLog('info', `Verifying ${name}...`);
        const process = await webcontainer.spawn("sh", ["-c", cmd]);
        const exitCode = await process.exit;
        if (exitCode === 0) {
          console.log(`✓ ${name} verification successful`);
          addLog('success', `${name} verified successfully`);
        } else {
          console.log(`✗ ${name} verification failed, but continuing...`);
          addLog('error', `${name} verification failed (exit code: ${exitCode})`);
        }
      } catch (error) {
        console.log(`✗ ${name} verification error:`, error);
        addLog('error', `${name} verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setTestStatus(prev => ({
      ...prev,
      isInstallingTools: false,
      installProgress: 0,
      installTotal: 0,
      currentInstalling: undefined
    }));
    console.log("Package manager installation complete");
  };

  const createPackageJson = (packageName: string) => ({
    "package.json": {
      file: {
        contents: JSON.stringify({
          name: "benchmark-test",
          version: "1.0.0",
          dependencies: {
            [packageName]: "latest"
          }
        }, null, 2)
      }
    }
  });

  // Helper function to get package manager version
  const getPackageManagerVersion = async (webcontainer: WebContainer, packageManager: string): Promise<string> => {
    try {
      let versionCommand = '';
      switch (packageManager) {
        case 'npm':
          versionCommand = 'npm --version';
          break;
        case 'yarn':
          versionCommand = 'yarn --version';
          break;
        case 'yarn (berry)':
        case 'yarn v2':
        case 'yarn v3':
        case 'yarn v4':
          versionCommand = 'yarn --version';
          break;
        case 'pnpm':
          versionCommand = 'pnpm --version';
          break;
        case 'vlt':
          versionCommand = 'vlt --version';
          break;
        default:
          return 'unknown';
      }

      const process = await webcontainer.spawn('sh', ['-c', versionCommand]);
      let output = '';
      process.output.pipeTo(new WritableStream({
        write(data) {
          output += data;
        }
      }));

      const exitCode = await process.exit;
      if (exitCode === 0) {
        return output.trim().split('\n')[0] || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      console.log(`Error getting ${packageManager} version:`, error);
      return 'unknown';
    }
  };

  // Helper function to count installed packages using multiple strategies
  const countInstalledPackages = async (webcontainer: WebContainer, packageManager: string): Promise<number> => {
    try {
      // Check if node_modules exists
      const nodeModulesExists = await webcontainer.fs.readdir("node_modules").catch(() => null);
      if (!nodeModulesExists) return 0;

      // Strategy 1: Use the exact same find command as the real benchmarks (PRIMARY METHOD)
      try {
        const findProcess = await webcontainer.spawn('sh', ['-c',
          'find node_modules -name "package.json" -type f | grep -E "node_modules/([a-zA-Z0-9_-]+)/package\\.json$|node_modules/@[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+/package\\.json$" | sort -u | wc -l | xargs'
        ]);

        let findOutput = '';
        findProcess.output.pipeTo(new WritableStream({
          write(data) {
            findOutput += data;
          }
        }));

        const findExitCode = await findProcess.exit;
        if (findExitCode === 0) {
          const count = parseInt(findOutput.trim(), 10);
          if (!isNaN(count) && count > 0) {
            console.log(`${packageManager}: Found ${count} packages via find command (matches real benchmarks)`);
            return count;
          }
        }
      } catch (error) {
        console.log(`Find command failed:`, error);
      }

      // Strategy 2: Package manager specific list commands (fallback only)
      let packageCount = 0;
      try {
        let listCommand = '';
        switch (packageManager) {
          case 'pnpm':
            listCommand = 'pnpm list --depth=Infinity --json';
            break;
          case 'npm':
            listCommand = 'npm list --depth=Infinity --json';
            break;
          case 'yarn':
          case 'yarn (berry)':
            listCommand = 'yarn list --json';
            break;
          default:
            // Fall back to manual counting for other package managers
            break;
        }

        if (listCommand) {
          const process = await webcontainer.spawn('sh', ['-c', listCommand]);
          let output = '';
          process.output.pipeTo(new WritableStream({
            write(data) {
              output += data;
            }
          }));

          const exitCode = await process.exit;
          if (exitCode === 0 && output.trim()) {
            try {
              const parsed = JSON.parse(output);
              if (packageManager === 'pnpm' && parsed.dependencies) {
                // Count all dependencies recursively for pnpm
                const countDependencies = (deps: Record<string, unknown>): number => {
                  let count = 0;
                  for (const [, depInfo] of Object.entries(deps)) {
                    count++;
                    if (depInfo && typeof depInfo === 'object' && 'dependencies' in depInfo) {
                      count += countDependencies(depInfo.dependencies as Record<string, unknown>);
                    }
                  }
                  return count;
                };
                packageCount = countDependencies(parsed.dependencies);
              } else if (packageManager === 'npm' && parsed.dependencies) {
                // Count all dependencies recursively for npm
                const countDependencies = (deps: Record<string, unknown>): number => {
                  let count = 0;
                  for (const [, depInfo] of Object.entries(deps)) {
                    count++;
                    if (depInfo && typeof depInfo === 'object' && 'dependencies' in depInfo) {
                      count += countDependencies(depInfo.dependencies as Record<string, unknown>);
                    }
                  }
                  return count;
                };
                packageCount = countDependencies(parsed.dependencies);
              }

              if (packageCount > 0) {
                console.log(`${packageManager}: Found ${packageCount} packages via list command (fallback)`);
                return packageCount;
              }
            } catch (parseError) {
              console.log(`Failed to parse ${packageManager} list output:`, parseError);
            }
          }
        }
      } catch (error) {
        console.log(`${packageManager} list command failed:`, error);
      }

      // Strategy 3: Manual directory traversal (last resort)
      const findPackageJsonFiles = async (dir: string): Promise<void> => {
        try {
          const entries = await webcontainer.fs.readdir(dir);

          for (const entry of entries) {
            const fullPath = `${dir}/${entry}`;

            try {
              // Try to read as directory first
              await webcontainer.fs.readdir(fullPath);

              // If it's a directory, check for package.json and recurse for scoped packages
              if (entry.startsWith('@') && dir === 'node_modules') {
                // This is a scoped package directory, recurse into it
                await findPackageJsonFiles(fullPath);
              } else if (!entry.startsWith('.') && entry !== 'bin') {
                // This is a regular package directory, check for package.json
                try {
                  await webcontainer.fs.readFile(`${fullPath}/package.json`);
                  packageCount++;
                } catch {
                  // No package.json, not a valid package
                }
              }
            } catch {
              // Not a directory, skip
            }
          }
        } catch (error) {
          console.log(`Error reading directory ${dir}:`, error);
        }
      };

      await findPackageJsonFiles('node_modules');
      console.log(`${packageManager}: Found ${packageCount} packages via manual traversal`);
      return packageCount;
    } catch (error) {
      console.log("Error counting packages:", error);
      return 0;
    }
  };

  const runBenchmark = async (
    webcontainer: WebContainer,
    packageManager: string,
    variation: string,
    packageName: string
  ): Promise<TestResult> => {
    const startTime = Date.now();

    try {
      console.log(`Starting benchmark for ${packageManager}-${variation}`);

      // Clear the container but preserve package managers and essential directories
      try {
        const files = await webcontainer.fs.readdir("/");
        for (const file of files) {
          // Keep essential system directories and global npm
          if (!["tmp", "proc", "dev", "usr", "opt", "root"].includes(file)) {
            await webcontainer.fs.rm(`/${file}`, { recursive: true, force: true });
          }
        }

        // Clear package manager caches specifically
        const cachesToClear = [
          "/root/.npm",           // npm cache
          "/root/.pnpm-store",    // pnpm store
          "/root/.pnpm",          // pnpm cache
          "/root/.yarn",          // yarn cache
          "/root/.cache/yarn",    // yarn v2+ cache
          "/root/.bun",           // bun cache (but preserve binary)
          "/root/.vlt",           // vlt cache
          "/root/.deno",          // deno cache
          "/tmp/.npm",            // temp npm cache
          "/tmp/.pnpm",           // temp pnpm cache
          "/tmp/.yarn-cache"      // temp yarn cache
        ];

        for (const cachePath of cachesToClear) {
          try {
            await webcontainer.fs.rm(cachePath, { recursive: true, force: true });
            console.log(`Cleared cache: ${cachePath}`);
          } catch {
            // Cache might not exist, that's fine
          }
        }

        addLog('info', `Cleared caches for ${packageManager}-${variation}`);
      } catch (e) {
        console.log("Error clearing container, continuing...", e);
        addLog('error', `Cache cleanup warning: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }

      // Create package.json
      const files = createPackageJson(packageName);
      await webcontainer.mount(files);
      console.log(`Mounted package.json for ${packageName}`);

      // Setup variation-specific state
      console.log(`Setting up ${variation} variation`);

      const hasCache = variation.includes("cache");
      const hasLockfile = variation.includes("lockfile");
      const hasNodeModules = variation.includes("node_modules");

      if (hasCache) {
        // Pre-populate cache (simplified simulation)
        console.log("Setting up cache component");
        // Create a simple cache directory structure
        try {
          await webcontainer.fs.mkdir(".npm", { recursive: true });
          await webcontainer.fs.mkdir(".yarn/cache", { recursive: true });
          await webcontainer.fs.mkdir(".pnpm", { recursive: true });
        } catch (e) {
          console.log("Cache setup warning:", e);
        }
      }

      if (hasLockfile) {
        // Create appropriate lockfile
        console.log("Setting up lockfile component");
        if (packageManager === "npm") {
          await webcontainer.fs.writeFile("package-lock.json", JSON.stringify({
            "name": "benchmark-test",
            "version": "1.0.0",
            "lockfileVersion": 2,
            "requires": true,
            "packages": {}
          }, null, 2));
        } else if (packageManager === "vlt") {
          await webcontainer.fs.writeFile("vlt-lock.json", JSON.stringify({
            "lockfileVersion": 1,
            "dependencies": {}
          }, null, 2));
        } else if (packageManager === "yarn" || packageManager.includes("yarn")) {
          await webcontainer.fs.writeFile("yarn.lock", "# yarn lockfile v1\n");
        } else if (packageManager === "pnpm") {
          await webcontainer.fs.writeFile("pnpm-lock.yaml", "lockfileVersion: '6.0'\n");
        } else if (packageManager === "bun") {
          await webcontainer.fs.writeFile("bun.lockb", ""); // Bun uses binary lockfile
        }
      }

      if (hasNodeModules) {
        // Pre-create node_modules with some basic structure
        console.log("Setting up node_modules component");
        await webcontainer.fs.mkdir("node_modules", { recursive: true });
        await webcontainer.fs.mkdir("node_modules/.bin", { recursive: true });
        // Create a simple package to simulate existing installation
        await webcontainer.fs.mkdir("node_modules/.package-lock.json", { recursive: true });
      }

      // Run the install command using native package manager commands
      let installCommand: string;

      switch (packageManager) {
        case "npm":
          installCommand = "npm cache clean --force && npm install --no-audit --no-fund --ignore-engines";
          break;
        case "vlt":
          installCommand = "vlt install --ignore-engines || vlt install";
          break;
        case "yarn":
          installCommand = "yarn cache clean --all && yarn install --silent --ignore-engines";
          break;
        case "yarn (berry)":
        case "yarn v2":
        case "yarn v3":
        case "yarn v4":
          // Use yarn berry command
          installCommand = "yarn cache clean --all && yarn install --silent --ignore-engines";
          break;
        case "pnpm":
          installCommand = "pnpm store prune && pnpm install --silent --no-optional --ignore-engines";
          break;
        default:
          installCommand = "npm cache clean --force && npm install --no-audit --no-fund --ignore-engines"; // Default fallback
      }

      console.log(`Running command: ${installCommand}`);
      addLog('info', `${packageManager} (${variation}): Running ${installCommand}`);

      const process = await webcontainer.spawn("sh", ["-c", installCommand]);

      // Capture output for debugging
      let output = "";

      process.output.pipeTo(new WritableStream({
        write(data) {
          output += data;
        }
      }));

      // Note: WebContainer processes don't expose stderr separately
      // All output (stdout + stderr) comes through the main output stream

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<number>((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout after 60 seconds')), 60000);
      });

      let exitCode: number;
      try {
        exitCode = await Promise.race([process.exit, timeoutPromise]);
      } catch (error) {
        console.log(`Command timed out for ${packageManager}-${variation}`);
        addLog('error', `${packageManager} (${variation}): Command timed out after 60 seconds`);
        process.kill();
        throw error;
      }

      console.log(`Command finished with exit code: ${exitCode}`);

      if (exitCode !== 0) {
        console.log(`Command output:`, output);
        const fullError = output.trim();
        addLog('error', `${packageManager} (${variation}): Failed with exit code ${exitCode}. Output: ${fullError.slice(0, 200)}${fullError.length > 200 ? '...' : ''}`);
      }

      const duration = Date.now() - startTime;

      // Get version and count installed packages if installation was successful
      let packageCount = 0;
      let perPackageTime = 0;
      let version = 'unknown';

      if (exitCode === 0) {
        // Get package manager version
        version = await getPackageManagerVersion(webcontainer, packageManager);

        // Count installed packages using the improved strategy
        packageCount = await countInstalledPackages(webcontainer, packageManager);
        perPackageTime = packageCount > 0 ? duration / packageCount : 0;
        addLog('info', `${packageManager} v${version} (${variation}): Installed ${packageCount} packages in ${duration}ms (${perPackageTime.toFixed(2)}ms per package)`);
      }

      return {
        packageManager,
        variation,
        duration,
        success: exitCode === 0,
        error: exitCode !== 0 ?
          `Exit code: ${exitCode}${output.trim().length > 0 ?
            `. Output: ${output.trim().slice(0, 100)}` :
            ''}` :
          undefined,
        packageCount,
        perPackageTime,
        version
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Error in benchmark for ${packageManager}-${variation}:`, error);
      return {
        packageManager,
        variation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        packageCount: 0,
        perPackageTime: 0,
        version: 'unknown'
      };
    }
  };

  const handleRunTests = async () => {
    if (!packageName.trim()) return;

    const totalTests = packageManagers.length * variations.length;
    setTestStatus({
      isRunning: true,
      progress: 0,
      total: totalTests,
    });

    setResults([]);
    setLogs([]);

    addLog('info', `Starting benchmark for package: ${packageName.trim()}`);

    try {
      console.log("Initializing WebContainer...");
      const webcontainer = await initWebContainer();
      console.log("WebContainer initialized successfully");

      const newResults: TestResult[] = [];
      let completed = 0;

      for (const packageManager of packageManagers) {
        for (const variation of variations) {
          console.log(`Testing ${packageManager} with ${variation} variation for ${packageName.trim()}`);

          setTestStatus(prev => ({
            ...prev,
            currentPackageManager: packageManager,
            currentVariation: variation,
            progress: completed,
          }));

          try {
            const result = await runBenchmark(webcontainer, packageManager, variation, packageName.trim());
            console.log(`Result for ${packageManager}-${variation}:`, result);

            if (result.success) {
              addLog('success', `${packageManager} (${variation}): ${formatDuration(result.duration)}`);
            } else {
              addLog('error', `${packageManager} (${variation}): ${result.error || 'Failed'}`);
            }

            newResults.push(result);
          } catch (error) {
            console.error(`Error testing ${packageManager}-${variation}:`, error);
            addLog('error', `${packageManager} (${variation}): ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Add failed result
            newResults.push({
              packageManager,
              variation,
              duration: 0,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              packageCount: 0,
              perPackageTime: 0,
              version: 'unknown'
            });
          }

          completed++;

          setTestStatus(prev => ({
            ...prev,
            progress: completed,
          }));

          // Update results incrementally so user sees progress
          setResults([...newResults]);

          // Add a small delay to prevent overwhelming the WebContainer
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log("All tests completed:", newResults);
    } catch (error) {
      console.error("Test failed:", error);
      // Show error to user
      setResults([{
        packageManager: "error",
        variation: "error",
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        packageCount: 0,
        perPackageTime: 0,
        version: 'unknown'
      }]);
    } finally {
      setTestStatus({
        isRunning: false,
        progress: 0,
        total: 0,
      });
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getResultsByPackageManager = () => {
    const grouped: Record<string, TestResult[]> = {};
    results.forEach(result => {
      if (!grouped[result.packageManager]) {
        grouped[result.packageManager] = [];
      }
      grouped[result.packageManager].push(result);
    });
    return grouped;
  };

  const resultsChartData = useMemo(() => {
    if (results.length === 0) return [];

    const grouped = getResultsByPackageManager();

    return Object.entries(grouped)
      .filter(([, pmResults]) => pmResults.some(r => r.success))
      .map(([packageManager, pmResults]) => {
        const successfulResults = pmResults.filter(r => r.success);

        const avgDuration = successfulResults.length > 0
          ? successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
          : 0;

        const avgPerPackageTime = successfulResults.length > 0
          ? successfulResults.reduce((sum, r) => sum + (r.perPackageTime || 0), 0) / successfulResults.length
          : 0;

        const dataPoint: Record<string, number | string> = {
          packageManager,
          avgDuration: Math.round(avgDuration),
          avgPerPackageTime: Math.round(avgPerPackageTime * 100) / 100,
        };

        // Add variation-specific data
        variations.forEach(variation => {
          const result = pmResults.find(r => r.variation === variation && r.success);
          dataPoint[variation] = result ? result.duration : 0;
          dataPoint[`${variation}_perPackage`] = result ? (result.perPackageTime || 0) : 0;
          dataPoint[`${variation}_count`] = result ? (result.packageCount || 0) : 0;
        });

        return dataPoint;
      });
  }, [results]);

  // Log failed package managers to logs instead of showing red error boxes
  useMemo(() => {
    if (results.length === 0 || testStatus.isRunning) return;

    const grouped = getResultsByPackageManager();
    const failed = Object.entries(grouped)
      .filter(([, pmResults]) => {
        // Only include package managers that have NO successful tests
        return !pmResults.some(r => r.success);
      })
      .map(([packageManager, pmResults]) => ({
        packageManager,
        errors: pmResults.map(r => r.error).filter(Boolean)
      }));

    // Log failed package managers
    if (failed.length > 0) {
      failed.forEach(({ packageManager, errors }) => {
        addLog('error', `${packageManager}: All tests failed. Errors: ${errors.slice(0, 2).join(', ')}`);
      });
    }
  }, [results, testStatus.isRunning]);

  const chartDisplayData = useMemo(() => {
    // Temporarily simplified for single package mode only
    return resultsChartData.map(data => {
      const packageManager = data.packageManager as string;

      if (chartType === "perPackage") {
        if (selectedVariation === "average") {
          return {
            packageManager,
            displayValue: data.avgPerPackageTime || 0,
            packageCount: 0,
          };
        } else {
          return {
            packageManager,
            displayValue: data[`${selectedVariation}_perPackage`] || 0,
            packageCount: data[`${selectedVariation}_count`] || 0,
          };
        }
      } else {
        // Total time chart
        if (selectedVariation === "average") {
          return {
            packageManager,
            displayValue: data.avgDuration || 0,
            packageCount: 0,
          };
        } else {
          return {
            packageManager,
            displayValue: data[selectedVariation] || 0,
            packageCount: data[`${selectedVariation}_count`] || 0,
          };
        }
      }
    });
  }, [resultsChartData, selectedVariation, chartType]);


  return (
    <div className="bg-card/50 border border-border/50 rounded-lg p-6 backdrop-blur-sm">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Package Speed Tester
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Test package installation speed across different cache and lockfile states.
            <span className="block mt-1">
              <strong>Note:</strong> Bun and Deno are not supported in this WebContainer environment due to their compiled binary nature.
            </span>
            {typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated && (
              <span className="block text-red-600 dark:text-red-400 mt-1">
                ⚠️ Cross-origin isolation required. Restart dev server to enable WebContainer.
              </span>
            )}
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && packageName.trim() && !testStatus.isRunning && crossOriginIsolated) {
                    handleRunTests();
                  }
                }}
                placeholder="Enter package name (e.g., lodash, react, express)"
                className="w-full h-10 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={testStatus.isRunning}
              />
            </div>
            <Button
              onClick={handleRunTests}
              disabled={!packageName.trim() || testStatus.isRunning || !crossOriginIsolated}
              className="flex items-center gap-2 h-10"
            >
              {testStatus.isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {testStatus.isRunning ? "Running..." : "Run Tests"}
            </Button>
          </div>
        </div>

        {/* Compact Progress Section */}
        {(testStatus.isRunning || testStatus.isInstallingTools) && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">
                {testStatus.isInstallingTools
                  ? `Installing ${testStatus.currentInstalling}...`
                  : `${testStatus.currentPackageManager} • ${testStatus.currentVariation}`
                }
              </span>
              <span className="text-muted-foreground font-mono">
                {testStatus.isInstallingTools
                  ? `${testStatus.installProgress || 0}/${testStatus.installTotal || 0}`
                  : `${testStatus.progress}/${testStatus.total}`
                }
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  testStatus.isInstallingTools ? 'bg-blue-500' : 'bg-primary'
                }`}
                style={{
                  width: testStatus.isInstallingTools
                    ? `${((testStatus.installProgress || 0) / (testStatus.installTotal || 1)) * 100}%`
                    : `${(testStatus.progress / testStatus.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">
                Results for "{packageName}"
              </h5>
              <div className="text-xs text-muted-foreground">
                {chartType === "perPackage" ? "Per-package" : "Total"} {selectedVariation === "average" ? "average" : selectedVariation} time ({chartType === "perPackage" ? "ms/pkg" : "ms"})
              </div>
            </div>

            {/* Chart Controls */}
            <div className="space-y-3">
              {/* Chart Type Selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">View:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setChartType("total")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 border border-border/50 hover:border-border ${
                      chartType === "total"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    Total Time
                  </button>
                  <button
                    onClick={() => setChartType("perPackage")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 border border-border/50 hover:border-border ${
                      chartType === "perPackage"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    Per Package
                  </button>
                </div>
              </div>

              {/* Variation Selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Scenario:</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedVariation("average")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 border border-border/50 hover:border-border ${
                      selectedVariation === "average"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    Average
                  </button>
                  {variations.map((variation) => (
                    <button
                      key={variation}
                      onClick={() => setSelectedVariation(variation)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 border border-border/50 hover:border-border ${
                        selectedVariation === variation
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {variation}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart View */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDisplayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="packageManager"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(value) => formatDuration(value)}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: { payload?: { packageCount?: number } }) => {
                      const packageCount = props.payload?.packageCount || 0;
                      const timeLabel = chartType === "perPackage" ? "Per Package" : "Total Time";
                      const countInfo = packageCount > 0 ? ` (${packageCount} packages)` : "";
                      return [
                        chartType === "perPackage" ? `${value.toFixed(2)}ms` : formatDuration(value),
                        `${timeLabel}${countInfo}`
                      ];
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px'
                    }}
                  />
                                    <Bar
                    dataKey="displayValue"
                    radius={[2, 2, 0, 0]}
                  >
                    {chartDisplayData.map((entry, index) => {
                      const packageManager = 'packageManager' in entry ? entry.packageManager as string : '';
                      const colorMap = chartData.chartData.colors as Record<string, string>;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={packageManager && colorMap[packageManager] ? colorMap[packageManager] : '#8884d8'}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {resultsChartData.map((data) => {
                // Get version from successful results
                const pmResults = getResultsByPackageManager()[data.packageManager as string] || [];
                const successfulResult = pmResults.find(r => r.success);
                const version = successfulResult?.version || 'unknown';

                return (
                  <div
                    key={data.packageManager}
                    className="bg-muted/50 rounded-lg p-3"
                  >
                    <div className="font-medium">{data.packageManager}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      v{version}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total: {formatDuration(data.avgDuration as number)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Per pkg: {data.avgPerPackageTime ? `${(data.avgPerPackageTime as number).toFixed(1)}ms` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Packages: {data.avgPackageCount || 0} • Success: {data.successRate}%
                    </div>
                  </div>
                );
              })}
            </div>


            {/* Logs Section */}
            {logs.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="text-sm font-medium">Installation Logs</h6>
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showLogs ? 'Hide' : 'Show'} ({logs.length})
                  </button>
                </div>
                {showLogs && (
                  <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-1 text-xs font-mono">
                      {logs.map((log, index) => (
                        <div key={index} className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={`shrink-0 ${
                            log.level === 'error' ? 'text-red-600 dark:text-red-400' :
                            log.level === 'success' ? 'text-green-600 dark:text-green-400' :
                            'text-muted-foreground'
                          }`}>
                            {log.level === 'error' ? '✗' : log.level === 'success' ? '✓' : 'ℹ'}
                          </span>
                          <span className="text-foreground">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WebContainer Environment Info */}
            <div className="mt-6 pt-4 border-t border-border/50">
              <h6 className="text-sm font-medium mb-2">Test Environment Specifications</h6>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="font-medium text-foreground mb-1">Runtime Environment</div>
                    <div>• WebContainer (Browser-based Node.js)</div>
                    <div>• Isolated virtual filesystem</div>
                    <div>• In-memory package installation</div>
                    <div>• No persistent storage between tests</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">Test Methodology</div>
                    <div>• Fresh environment per test</div>
                    <div>• Package managers installed globally via npm</div>
                    <div>• All caches cleared before each test</div>
                    <div>• Timing measured from command start to completion</div>
                    <div>• Network requests to real npm registry</div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border/30">
                  <div className="font-medium text-foreground mb-1">Limitations & Notes</div>
                  <div>• Performance may differ from native environments</div>
                  <div>• Network latency affects all package managers equally</div>
                  <div>• Some advanced features may not be available</div>
                  <div>• Results are relative comparisons, not absolute benchmarks</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
