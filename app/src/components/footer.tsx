import { Vlt } from "@/components/icons/vlt";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useTheme } from "@/components/theme-provider";


export const Footer = () => {
  const { theme } = useTheme();

  return (
    <footer className="border-t border-border/50 bg-muted/20 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start gap-6">
          {/* VLT Logo on the far left */}
          <div className="flex-shrink-0">
            <a
              href="https://vlt.sh"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${
                theme === 'dark'
                  ? 'text-white hover:text-neutral-200'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Visit VLT website"
            >
              <Vlt size={24} />
            </a>
          </div>

          {/* Main content area */}
          <div className="flex-1">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-semibold text-base">Benchmark Methodology</h3>
              </div>
              <ThemeSwitcher />
            </div>

            <div>
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-sm">
                We do a best-effort job to configure each tool to behave as similar as possible to its peers but there's limitations to this standardization in many scenarios (as each tool makes decisions about its default support for security checks/validations/feature-set). As part of the normalization process, we count the number of packages - post-installation - & use that to determine the average speed relative to the number of packages installed. This strategy helps account for when there are significant discrepancies between the package manager's dependency graph resolution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-foreground font-medium mb-3">Benchmark Environment</h4>
                <ul className="text-neutral-600 dark:text-neutral-300 space-y-1 text-sm">
                  <li>• <strong>VM:</strong> Linux</li>
                  <li>• <strong>Processor (CPU):</strong> 4 cores</li>
                  <li>• <strong>Memory (RAM):</strong> 16 GB</li>
                  <li>• <strong>Storage (SSD):</strong> 14 GB</li>
                  <li>• <strong>Workflow label:</strong> ubuntu-latest</li>
                </ul>
              </div>

              <div>
                <h4 className="text-foreground font-medium mb-3">Resources</h4>
                <ul className="text-neutral-600 dark:text-neutral-300 space-y-1 text-sm">
                  <li>
                    • <a
                        href="https://docs.google.com/presentation/d/1ojXF4jb_1MyGhew2LCbdrZ4e_0vYUr-7CoMJLJsHwZY/edit?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Detailed methodology presentation
                      </a>
                  </li>
                  <li>
                    • <a
                        href="https://github.com/vltpkg/benchmarks"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Source code on GitHub
                      </a>
                  </li>
                  <li>
                    • <a
                        href="https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        GitHub runner specifications
                      </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                All trademarks, logos and brand names are the property of their respective owners. All company, product and service names used in this website are for identification purposes only. Use of these names, trademarks and brands does not imply endorsement.
              </p>
            </div>
          </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
