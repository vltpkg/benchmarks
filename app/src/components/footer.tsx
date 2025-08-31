import { Vlt } from "@/components/icons/vlt";

const ChartIcon = () => (
  <svg
    data-testid="geist-icon"
    height="20"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="20"
    style={{ color: "currentcolor" }}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 1v11.75A2.25 2.25 0 0 0 3.25 15H15v-1.5H3.25a.75.75 0 0 1-.75-.75V1H1Zm8.5 2.75V3H8v9h1.5V3.75ZM6 8v4H4.5V8H6Zm7-1.25V6h-1.5v6H13V6.75Z"
      clipRule="evenodd"
    />
  </svg>
);

export const Footer = () => {
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
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Visit VLT website"
            >
              <Vlt size={24} />
            </a>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            <div className="bg-muted/30 border border-border/50 rounded-lg p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ChartIcon />
              <h3 className="text-foreground font-semibold text-base">Benchmark Methodology</h3>
            </div>

            <div>
              <p className="text-muted-foreground leading-relaxed text-sm">
                We do a best-effort job to configure each tool to behave as similar as possible to its peers but there's limitations to this standardization in many scenarios (as each tool makes decisions about its default support for security checks/validations/feature-set). As part of the normalization process, we count the number of packages - post-installation - & use that to determine the average speed relative to the number of packages installed. This strategy helps account for when there are significant discrepancies between the package manager's dependency graph resolution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-foreground font-medium mb-3">Benchmark Environment</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• <strong>VM:</strong> Linux</li>
                  <li>• <strong>Processor (CPU):</strong> 4 cores</li>
                  <li>• <strong>Memory (RAM):</strong> 16 GB</li>
                  <li>• <strong>Storage (SSD):</strong> 14 GB</li>
                  <li>• <strong>Workflow label:</strong> ubuntu-latest</li>
                </ul>
              </div>

              <div>
                <h4 className="text-foreground font-medium mb-3">Resources</h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
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
              <p className="text-muted-foreground text-xs leading-relaxed">
                All trademarks, logos and brand names are the property of their respective owners. All company, product and service names used in this website are for identification purposes only. Use of these names, trademarks and brands does not imply endorsement.
              </p>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
