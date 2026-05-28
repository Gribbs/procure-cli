# Contributing to procure-cli

Thanks for your interest in contributing! This document covers the development
setup, commit conventions, and the release process.

## Development setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/procure-cli.git
   cd procure-cli
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the checks:

   ```bash
   npm test
   npm run lint
   ```

## Adding or changing an action

Service/action definitions live in `lib/services/`. The README API reference
and `docs/services.md` are generated from them.

1. Edit (or create) the descriptor in `lib/services/<service>.js`.
2. Run `npm test` — the registry tests confirm the shape.
3. Run `npm run docs` to regenerate `docs/services.md` and the README API
   reference, then commit the regenerated files. CI fails if they drift.

## Commit message format

This project uses [Conventional Commits](https://www.conventionalcommits.org/)
to drive automated versioning and changelog generation. **All commit messages
must follow this format**, or CI will fail.

```
<type>(<scope>): <subject>

<body>

<footer>
```

`<type>` must be one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
`test`, `build`, `ci`, `chore`, `revert`.

### Version bumps

- `fix:` → patch release
- `feat:` → minor release
- `feat!:` / `BREAKING CHANGE:` in the footer → major release

### Validate locally

```bash
echo "feat: add new feature" | npx commitlint
```

## Pull request process

1. Create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and add tests for new functionality.
3. Ensure `npm test`, `npm run lint`, and `npm run docs` (no drift) all pass.
4. Push and open a pull request on GitHub.

### Pull request requirements

- All tests pass
- All commit messages follow Conventional Commits
- `docs/services.md` and the README API reference are in sync (`npm run docs`)
- New features include tests

## Testing

- Run all tests: `npm test`
- Watch mode: `npm run test:watch`
- With coverage: `npm run test:coverage`

## Release process

Releases are automated with
[semantic-release](https://github.com/semantic-release/semantic-release) when
changes are merged to `main`:

1. Merge an approved PR to `main`.
2. semantic-release analyzes commit messages, determines the version bump,
   updates `package.json` and `CHANGELOG.md`, tags the release, publishes to
   npm, and creates a GitHub release.

There is no manual `npm publish` step.

## Questions?

Open an issue on GitHub. Thanks for contributing!
