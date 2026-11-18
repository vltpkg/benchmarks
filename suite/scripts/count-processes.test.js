const assert = require("node:assert/strict");
const test = require("node:test");

const { countProcesses } = require("./count-processes.js");

test("counts the tool once, not the wrapper, PATH lookups or its interpreter", () => {
  // npm ci on next, from the 2026-11-17 audit: npm spawned nothing
  const log = [
    `393   execve("/usr/bin/bash", ["bash", "-c", "npm ci"], 0x7ffe /* 30 vars */) = 0`,
    `393   execve("/opt/node/bin/npm", ["npm", "ci"], 0x55f6 /* 30 vars */) = 0`,
    `393   execve("/home/runner/.yarn/switch/bin/node", ["node", "/opt/node/bin/npm", "ci"], 0x7ffc /* 30 vars */) = -1 ENOENT (No such file or directory)`,
    `393   execve("/opt/node/bin/node", ["node", "/opt/node/bin/npm", "ci"], 0x7ffc /* 30 vars */) = 0`,
  ].join("\n");
  assert.equal(countProcesses(log), 1);
});

test("counts child processes that ran a program", () => {
  const log = [
    `2407  execve("/usr/bin/bash", ["bash", "-c", "corepack pnpm@latest install"], 0x7ffc /* 30 vars */) = 0`,
    `2407  execve("/opt/node/bin/corepack", ["corepack", "pnpm@latest", "install"], 0x5572 /* 30 vars */) = 0`,
    `2407  execve("/opt/node/bin/node", ["node", "/opt/node/bin/corepack", "pnpm@latest", "install"], 0x7ffc /* 30 vars */) = 0`,
    `2419  execve("/home/runner/.cache/pnpm-native", ["pnpm-native", "install"], 0x34aa /* 32 vars */) = 0`,
    `2499  execve("/home/runner/.yarn/switch/bin/node", ["node", "--version"], 0x7ffd /* 32 vars */) = -1 ENOENT (No such file or directory)`,
    `2499  execve("/opt/node/bin/node", ["node", "--version"], 0x7ffd /* 32 vars */) = 0`,
    `2465  --- SIGCHLD {si_signo=SIGCHLD, si_code=CLD_EXITED, si_pid=2499, si_uid=1003, si_status=0} ---`,
    `2407  +++ exited with 0 +++`,
  ].join("\n");
  // corepack, pnpm-native, node --version; 2465 is a thread that ran nothing
  assert.equal(countProcesses(log), 3);
});

test("doesn't count a process whose execs all failed", () => {
  const log = [
    `1  execve("/usr/bin/bash", ["bash", "-c", "x"], 0x1 /* 1 vars */) = 0`,
    `1  execve("/opt/node/bin/x", ["x"], 0x1 /* 1 vars */) = 0`,
    `2  execve("/usr/local/bin/missing", ["missing"], 0x1 /* 1 vars */) = -1 ENOENT (No such file or directory)`,
    `2  execve("/usr/bin/missing", ["missing"], 0x1 /* 1 vars */) = -1 ENOENT (No such file or directory)`,
  ].join("\n");
  assert.equal(countProcesses(log), 1);
});

test("counts only the children of a wrapper shell that stays", () => {
  // ci+setup: bash -c 'bash -c "npm install -g ... && npm ci"'
  const log = [
    `10 execve("/usr/bin/bash", ["bash", "-c", "bash -c '...'"], 0x1 /* 1 vars */) = 0`,
    `10 execve("/usr/bin/bash", ["bash", "-c", "npm install -g npm && npm ci"], 0x1 /* 1 vars */) = 0`,
    `11 execve("/opt/node/bin/npm", ["npm", "install", "-g", "npm"], 0x1 /* 1 vars */) = 0`,
    `11 execve("/opt/node/bin/node", ["node", "/opt/node/bin/npm"], 0x1 /* 1 vars */) = 0`,
    `12 execve("/tmp/bench-npm/bin/npm", ["npm", "ci"], 0x1 /* 1 vars */) = 0`,
  ].join("\n");
  assert.equal(countProcesses(log), 2);
});

test("counts shells the tool starts", () => {
  const log = [
    `1 execve("/usr/bin/bash", ["bash", "-c", "x"], 0x1 /* 1 vars */) = 0`,
    `1 execve("/opt/bin/x", ["x"], 0x1 /* 1 vars */) = 0`,
    `2 execve("/bin/sh", ["sh", "-c", "node install.js"], 0x1 /* 1 vars */) = 0`,
  ].join("\n");
  assert.equal(countProcesses(log), 2);
});

test("follows execve calls split across lines", () => {
  const log = [
    `1 execve("/usr/bin/bash", ["bash", "-c", "x"], 0x1 /* 1 vars */) = 0`,
    `1 execve("/opt/bin/x", ["x"], 0x1 /* 1 vars */) = 0`,
    `2 execve("/opt/bin/missing", ["missing"], 0x1 /* 1 vars */ <unfinished ...>`,
    `3 execve("/opt/bin/child", ["child"], 0x1 /* 1 vars */ <unfinished ...>`,
    `2 <... execve resumed>) = -1 ENOENT (No such file or directory)`,
    `3 <... execve resumed>) = 0`,
  ].join("\n");
  assert.equal(countProcesses(log), 2);
});

test("counts nothing for an empty log", () => {
  assert.equal(countProcesses(""), 0);
});
