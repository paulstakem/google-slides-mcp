# CI/CD Setup Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) setup for the Google Slides MCP Server project.

## Overview

The project uses **GitHub Actions** as its CI/CD platform with automated workflows for testing, linting, building, and quality checks.

## Workflow Files

### Main CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Pushes to `main` or `develop` branches
- Pull requests targeting `main` or `develop` branches

**Jobs:**

#### 1. Test and Lint Job
Runs on: `ubuntu-latest`

**Matrix Strategy:**
- Tests against Node.js versions: 18.x, 20.x, 22.x
- Ensures compatibility across multiple Node.js versions

**Steps:**
1. **Checkout code** - Uses `actions/checkout@v4`
2. **Setup Node.js** - Configures the specific Node.js version with npm cache
3. **Install dependencies** - Runs `npm ci` for clean, reproducible installs
4. **Run linter** - Executes `npm run lint` to check code style and quality
5. **Build project** - Runs `npm run build` to compile TypeScript to JavaScript
6. **Run tests with GitHub Actions reporter** - Executes tests with dual reporters:
   - `--reporter=github-actions` for inline PR annotations
   - `--reporter=default` for readable console output
7. **Generate coverage report** (Node.js 20.x only) - Runs `npm run test:coverage`
8. **Upload coverage to Codecov** (Node.js 20.x only) - Uploads coverage data
9. **Upload coverage artifacts** (Node.js 20.x only) - Stores HTML/JSON reports for 30 days

#### 2. Build Check Job
Runs on: `ubuntu-latest`

**Node.js Version:** 20.x

**Steps:**
1. **Checkout code** - Uses `actions/checkout@v4`
2. **Setup Node.js** - Configures Node.js 20.x with npm cache
3. **Install dependencies** - Runs `npm ci`
4. **Type check** - Runs `npx tsc --noEmit` to verify TypeScript types without emitting files
5. **Build** - Runs `npm run build` to compile the project
6. **Upload build artifacts** - Stores compiled JavaScript for 7 days

## Vitest GitHub Actions Reporter

### What It Does

The [Vitest GitHub Actions Reporter](https://vitest.dev/guide/reporters.html#github-actions-reporter) provides enhanced CI integration:

- **Inline Annotations**: Test failures appear directly in PR diffs with file/line context
- **Collapsible Output**: Test logs are organized and collapsible in GitHub Actions UI
- **Error Grouping**: Related failures are grouped together for easier debugging
- **Native GitHub Integration**: Leverages GitHub's annotations API for rich feedback

### Configuration

Tests run with dual reporters:

```bash
npm run test -- --reporter=github-actions --reporter=default
```

- `github-actions`: Provides CI-specific formatting and annotations
- `default`: Provides readable console output in logs

### Benefits

1. **Faster PR Reviews**: Failures are visible inline without opening logs
2. **Better Context**: Exact line numbers and error messages in the PR UI
3. **Reduced Friction**: Developers see issues immediately in familiar GitHub interface

## Dependabot Configuration (`.github/dependabot.yml`)

Automated dependency updates with intelligent grouping:

### NPM Dependencies
- **Schedule**: Weekly on Mondays at 9:00 AM ET
- **Grouping Strategy**:
  - Development dependencies: Minor and patch updates grouped together
  - Production dependencies: Minor and patch updates grouped together
  - Major updates: Always individual PRs for careful review
  - Security updates: Always individual PRs
- **Auto-assignment**: Assigned to `paulstakem` with `dependencies` and `automated` labels

### GitHub Actions
- **Schedule**: Weekly on Mondays at 9:00 AM ET
- **Scope**: Updates action versions in workflow files
- **Auto-assignment**: Assigned to `paulstakem` with `ci`, `dependencies`, and `automated` labels

## Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)

Ensures quality and consistency across contributions with comprehensive checklists:

**Sections:**
- Description and type of change
- Related issues linking
- Detailed changes made
- Testing checklist (all tests pass, new tests added, coverage maintained)
- Code quality checklist (linting, TypeScript compilation, no improper `any` types)
- Security checklist (no vulnerabilities, dependencies audited)
- Documentation updates
- Breaking changes documentation
- Pre-submission commands verification

## Issue Templates

### Bug Report (`.github/ISSUE_TEMPLATE/bug_report.md`)

Structured template for bug reports including:
- Clear description and reproduction steps
- Expected vs. actual behavior
- Environment details (OS, Node.js version, MCP client)
- Configuration examples (sanitized)
- Logs and error messages
- Checklist for completeness

### Feature Request (`.github/ISSUE_TEMPLATE/feature_request.md`)

Structured template for feature requests including:
- Feature description and problem statement
- Proposed solution with example usage
- Use case and benefits
- Google Slides API references
- Implementation complexity estimation
- Breaking change assessment
- Contribution willingness

## Local CI Simulation

Developers can simulate CI locally before pushing:

```bash
# Clean install (like CI)
npm ci

# Run all quality checks
npm run lint
npm run build
npm test

# Generate coverage
npm run test:coverage

# Full CI simulation (one command)
npm ci && npm run lint && npm run build && npm test && npm run test:coverage
```

## Coverage Reports

**Generation:** Only on Node.js 20.x to avoid redundant uploads

**Storage:**
- Codecov: Long-term trending and PR comments
- GitHub Artifacts: HTML reports downloadable for 30 days

**Access:**
- Codecov dashboard (if configured with token)
- GitHub Actions artifacts section in workflow runs

## CI Status Badge

The README includes a CI status badge:

```markdown
[![CI](https://github.com/paulstakem/google-slides-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/paulstakem/google-slides-mcp/actions/workflows/ci.yml)
```

This provides at-a-glance status of the main branch's CI health.

## Best Practices

### For Contributors

1. **Run tests locally** before pushing
2. **Check linting** with `npm run lint`
3. **Verify build** with `npm run build`
4. **Review coverage** with `npm run test:coverage`
5. **Fill out PR template** completely
6. **Wait for CI** before requesting reviews

### For Maintainers

1. **Require passing CI** before merge
2. **Review coverage changes** in artifacts
3. **Monitor Dependabot PRs** weekly
4. **Update workflow** as dependencies evolve
5. **Keep Node.js versions** aligned with LTS releases

## Troubleshooting

### CI Failing on Specific Node.js Version

Check if dependencies have version-specific issues. Review the specific job logs in GitHub Actions.

### Coverage Upload Failing

- Verify Codecov token is set in repository secrets (if using Codecov)
- Check that `coverage/coverage-final.json` is being generated
- Review upload step logs for API errors

### Linting Failures

Run `npm run lint` locally to see exact errors. Many can be auto-fixed with:

```bash
npx eslint . --ext .ts --fix
```

### Build Failures

Run `npm run build` locally. Common causes:
- TypeScript errors (run `npx tsc --noEmit` for detailed type checking)
- Missing dependencies (run `npm ci` to ensure clean install)
- ESM/CommonJS module conflicts (check `package.json` type field)

## Future Enhancements

Potential improvements to consider:

- **Semantic Release**: Automate versioning and changelog generation
- **Performance Benchmarking**: Track test execution time and bundle size
- **Integration Tests**: Add E2E tests with real Google Slides API (with test account)
- **Mutation Testing**: Use tools like Stryker for test quality assessment
- **Docker**: Containerized builds for consistent environments
- **Pre-commit Hooks**: Use Husky to enforce linting/testing before commits
- **Branch Protection**: Require CI passing and code review before merge

## Related Documentation

- [Vitest Reporters](https://vitest.dev/guide/reporters.html)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Codecov Documentation](https://docs.codecov.com/)

## Maintenance

**Review Schedule:**
- **Monthly**: Review CI workflow efficiency and update actions
- **Quarterly**: Audit Node.js version matrix against LTS releases
- **As Needed**: Update when new testing tools or best practices emerge

---

**Last Updated:** 2024-01-XX
**Maintained By:** paulstakem
**CI Platform:** GitHub Actions