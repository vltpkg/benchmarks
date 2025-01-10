#!/bin/bash

hyperfine --export-json=../next.json --warmup 3 --runs 10 -i --prepare ' \
    rm -rf ./node_modules/; \
    rm -rf .npm*; \
    rm -rf .yarn*; \
    rm -rf .pnp*; \
    rm -rf .vlt*; \
    rm -rf package-lock.json; \
    rm -rf yarn.lock; \
    rm -rf pnpm-lock.yaml; \
    rm -rf vlt-lock.json; \
    rm -rf bun.lockb; \
    rm -rf deno.lock; \
    npm cache clean --force; \
    yarn@1 cache clean --all; \
    yarn@latest cache clean --all; \
    pnpm cache delete *; \
    rm -rf $(vlt config get cache); \
    rm -rf $(bun pm cache); \
    deno clean; \
    npm pkg delete packageManager; \
    git add .; \
    git stash' \
  'npm install --no-audit --no-fund' \
  'corepack yarn@1 install' \
  'corepack yarn@latest install' \
  'corepack pnpm@latest install' \
  'vlt install' \
  'bun install' \
  'deno install --allow-scripts'
