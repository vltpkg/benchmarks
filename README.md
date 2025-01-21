# Package Manager Benchmarks

This repo contains a suite of fixutres & tools to track the performance of package managers.

### Environment

We current only test the latest `linux` runner which is the most common GitHub Action environment. The [standard GitHub-hosted public runner environment](https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories) specs are below:

- VM: Linux
- Processor (CPU): 4
- Memory (RAM): 16 GB
- Storage (SSD): 14 GB
- Workflow label: `ubuntu-latest`

We may add Mac/Windows in the future but the it will likely exponentially increase the already slow run time of the suite (**~20min**).

### Configuration/Normalization

We do a best-effort job to configure each tool to behave as similar as possible to its peers but there's limitations to this standardization in many scenarios (as each tool makes decisions about its default support for security checks/validations/feature-set). As part of the normalization process, we count the number of packages - post-installation - & use that to determine the average speed relative to the number of packages installed. This strategy helps account for when there are significant discrepencies between the package manager's dependency graph resolution ([you can read/see more here](https://docs.google.com/presentation/d/1ojXF4jb_1MyGhew2LCbdrZ4e_0vYUr-7CoMJLJsHwZY/edit?usp=sharing)).

#### Example:

- **Package Manager A** installs **1,000** packages in **10s** -> an avg. of **~10ms** per-package
- **Package Manager B** installs **10** packages in **1s** -> an avg. of **~100ms** per-package

### Testing Package Installation

The installation tests we run today mimic a cold-cache scenario for a variety of test fixtures (ie. we install the packages of a `next`, `vue`, `svelte` & `astro` starter project). We will likely add lockfile & warm cache tests in the near future.

#### Supported Tools

- `vlt`
- `npm`
- `pnpm`
- `yarn`
- `yarn berry`
- `deno`
- `bun`

### Testing Script Execution (WIP)

This suite also tests the performance of basic script execution (ex. `npm run foo`). Notably, for any given build, test or deployment task the spawning of the process is a fraction of the overall execution time. That said, this is a commonly tracked workflow by various developer tools as it involves the common set of tasks: startup, filesystem read (`package.json`) & finally, spawning the process/command.

#### Supported Tools

- `vlt`
- `npm`
- `pnpm`
- `yarn`
- `yarn berry`
- `deno`
- `bun`
- `node`
- `turborepo`
- `nx`

### Output

Results of the test runs are found in the Actions Artifacts "results". We will eventually add a visualization of the results at some point in the future.
