#!/bin/bash

rm -rf ./node_modules/;
rm -rf .npm*;
rm -rf .yarn*;
rm -rf .pnp*;
rm -rf .vlt*;
rm -rf package-lock.json;
rm -rf yarn.lock;
rm -rf pnpm-lock.yaml;
rm -rf vlt-lock.json;
rm -rf bun.lockb;
rm -rf deno.lock;
npm cache clean --force --silent;
corepack yarn@1 cache clean --all --silent;
corepack yarn@latest cache clean --all >/dev/null;
corepack pnpm cache delete * --silent;
rm -rf $(corepack pnpm store path);
rm -rf $(vlt config get cache);
rm -rf $(bun pm cache);
rm -rf nx.json;
rm -rf .nx;
rm -rf .turbo;
deno clean --quiet;
npm pkg delete packageManager;
git add . --quiet;
git stash --quiet;