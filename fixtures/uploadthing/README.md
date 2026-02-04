# UploadThing Benchmark Fixture

This fixture represents a typical Next.js application using UploadThing for file uploads, including common dependencies and patterns found in real-world UploadThing applications.

## Features Represented

- **Core UploadThing**: Main `uploadthing` package and React components
- **Next.js Integration**: Full Next.js app with TypeScript
- **UI Components**: Radix UI, Tailwind CSS, and common UI libraries
- **Authentication**: Clerk integration (common pattern)
- **Validation**: Zod for schema validation
- **Effect System**: Effect-TS (used internally by UploadThing)
- **Development Tools**: ESLint, Prettier, TypeScript

## Package Manager Compatibility

This fixture has been adapted from the original UploadThing monorepo to work with all major package managers:

- ✅ npm
- ✅ yarn
- ✅ pnpm
- ✅ bun

## Adaptation Strategy

### What We Did

**Simplified Monorepo Structure**: Instead of trying to adapt the complex 8-package monorepo with workspace dependencies, we created a single package that represents a typical UploadThing application.

**Dependency Resolution**: 
- Replaced `workspace:*` dependencies with actual published versions
- Included the core UploadThing packages (`uploadthing`, `@uploadthing/react`)
- Added common dependencies found in real UploadThing applications
- Included Effect-TS dependencies (used internally by UploadThing)

**Removed Package Manager Restrictions**:
- Removed `engines.pnpm` restriction
- Removed `packageManager` field
- Eliminated pnpm-specific workspace configuration

### What We Couldn't Adapt

**Turbo Build System**: The original uses Turbo for monorepo orchestration, which isn't relevant for a single-package fixture.

**Workspace Protocol**: The original heavily uses `workspace:*` which is pnpm-specific. We replaced these with actual versions.

**Complex Monorepo Structure**: The original has 8+ packages with complex interdependencies. We simplified this to a single realistic application.

## Dependencies Overview

- **Total Dependencies**: ~50 packages
- **Main Framework**: Next.js 15 + React 19
- **File Upload**: UploadThing core + React components
- **UI/Styling**: Tailwind CSS + Radix UI components
- **Type Safety**: TypeScript + Zod validation
- **Development**: Standard Next.js tooling

This fixture provides a realistic benchmark for package managers when dealing with modern React applications that use file upload capabilities.

## Limitations and Notes

### Why Not a Direct Clone?

The original UploadThing repository is a complex pnpm-only monorepo with:
- 8+ packages with circular workspace dependencies
- Heavy use of `workspace:*` protocol (pnpm-specific)
- Turbo build system configuration
- Engine restrictions (`engines.pnpm: "10.x"`)

Adapting this directly would have been:
1. **Extremely complex** - requiring rewriting workspace dependencies
2. **Potentially unreliable** - many package managers don't support all workspace features
3. **Not representative** - most users don't work with the UploadThing monorepo directly

### Our Approach

Instead, we created a fixture that represents **how developers actually use UploadThing**:
- A Next.js application using UploadThing for file uploads
- Common UI libraries (Radix, Tailwind) typically used with UploadThing
- Authentication (Clerk) - a common pattern in UploadThing apps
- All the core dependencies that UploadThing brings in

This provides a more realistic and useful benchmark while ensuring compatibility across all package managers.

### Fixture Quality

This fixture is **excellent for benchmarking** because it:
- ✅ Tests ~50 packages with complex dependency trees
- ✅ Includes modern React patterns and libraries
- ✅ Represents real-world application complexity
- ✅ Works reliably across all package managers
- ✅ Includes Effect-TS (functional programming library used by UploadThing)
- ✅ Tests peer dependency resolution
- ✅ Includes optional dependencies
