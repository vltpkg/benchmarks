# `run`

The script-execution fixture. It installs essentially nothing on purpose.

- Directory: `suite/fixtures/run`
- Manifest name: `run`
- Dependencies: 0 runtime, 2 development
- One script: `test`, which echoes a line and exits

## What it exercises

Only the cost of **spawning a script**: process startup, reading
`package.json`, and handing off to the command. Nothing else is in the way,
which is the entire design — any dependency graph would add noise to a
measurement whose whole subject is fixed overhead.

Spawning is a small share of any real build, but it is a thing developers do
dozens of times a day, and it is a workflow most tools advertise.

## Variations

**Only `run`.** It is the only fixture that takes the `run` variation, and the
`run` variation applies to no other fixture — so the single published pair is
`run-run`.

Because `run` measures a script rather than an install, `run-run` publishes
**neither** a package-count nor a process-count file.

## Series you will only see here

`node`, `nx` and `turbo` appear as measured series in this fixture and not in
the install benchmarks, because they are task runners rather than installers.
