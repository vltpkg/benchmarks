// Counts the processes a command started, from an
// `strace -f -e trace=execve,execveat` log.
//
// A process is counted once if it ran a program, i.e. made at least one
// successful execve or execveat. Failed calls aren't processes: they are
// lookups along PATH (e.g. `/usr/bin/env node` trying each PATH entry). A
// process that execs more than once, like a `#!/usr/bin/env node` script becoming `env` and
// then `node`, is still one process, so a JS tool's interpreter isn't counted
// on its own.
//
// The harness runs every counted command through `bash -c`, so the traced
// process starts as a shell. Leading shell execs of that first process are
// not counted: when bash execs the tool in place, the tool's process is
// counted; when the command is a compound one and the shell stays, only the
// processes it started are counted.
//
// Usage: node count-processes.js <strace-log>
// Prints the count to stdout.

const fs = require('fs');
const path = require('path');

const SHELLS = new Set(['bash', 'sh', 'dash']);

module.exports = { countProcesses };

if (require.main === module) {
  const log = process.argv[2];
  if (!log) throw new Error('strace log is required');
  console.log(countProcesses(fs.readFileSync(log, 'utf8')));
}

// Returns the number of processes in the strace log that ran a program, not
// counting the wrapper shell.
function countProcesses(log) {
  const execs = successfulExecs(log);
  const [root] = execs.keys();
  if (root !== undefined) {
    const programs = execs.get(root);
    while (programs.length && SHELLS.has(path.basename(programs[0]))) {
      programs.shift();
    }
  }
  return [...execs.values()].filter((programs) => programs.length).length;
}

// Map of pid -> programs it successfully exec'd, in order. Every traced pid
// appears, in the order it was first seen, so the first key is the traced
// command itself.
function successfulExecs(log) {
  const execs = new Map();
  // calls split by another thread's syscall:
  //   12 execve("/bin/x", [...] <unfinished ...>
  //   12 <... execve resumed>) = 0
  const unfinished = new Map();

  for (const line of log.split('\n')) {
    const match = /^(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const [, pid, rest] = match;
    if (!execs.has(pid)) execs.set(pid, []);

    let program;
    let result;
    if (/^execve(at)?\(/.test(rest)) {
      program = execPath(rest);
      if (rest.endsWith('<unfinished ...>')) {
        unfinished.set(pid, program);
        continue;
      }
      result = rest;
    } else if (/^<\.\.\. execve(at)? resumed>/.test(rest)) {
      program = unfinished.get(pid);
      unfinished.delete(pid);
      result = rest;
    } else {
      continue;
    }

    if (program !== undefined && /\)\s+=\s+0$/.test(result)) {
      execs.get(pid).push(program);
    }
  }

  return execs;
}

// The program an execve or execveat line runs: the first string argument,
// i.e. execve's path or execveat's path after the directory fd.
function execPath(call) {
  return /^execve(?:at)?\((?:[^,"]*, )?"((?:[^"\\]|\\.)*)"/.exec(call)?.[1];
}
