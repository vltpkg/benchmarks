# benchmarks

This is a next.js starter app. If you want to run the benchmark manually, checkout this repo & run the following (should be the same in the project's benchmark workflow).

```bash
echo "npm@$(npm -v)";
echo "vlt@$(vlt -v)";
echo "yarn@$(COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack yarn@1 -v)";
echo "yarn@$(COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack yarn@latest -v)";
echo "pnpm@$(COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack pnpm@latest -v)";
echo "bun@$(bun -v)";
echo "deno@$(deno -v)";
echo "Benchmarking...";
hyperfine --warmup 3 -i --prepare 'rm -rf node_modules vlt-lock.json package-lock.json .npmrc yarn.lock .yarnrc pnpm-lock.yaml bun.lockb deno.json' 'vlt install' 'npm install' 'COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack yarn@1 install' 'COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack yarn@latest install' 'COREPACK_ENABLE_STRICT=0 COREPACK_ENABLE_AUTO_PIN=0 corepack pnpm@latest install' 'bun install' 'deno install' --export-markdown benchmark.md;
cat benchmark.md
```
