## Description
<!-- Provide a brief description of the changes in this PR -->

## Type of Change
<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Dependency update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement

## Related Issues
<!-- Link to related issues, e.g., "Fixes #123" or "Relates to #456" -->

## Changes Made
<!-- Provide a detailed list of changes -->

- 
- 
- 

## Testing Checklist
<!-- Ensure all items are checked before submitting -->

- [ ] All existing tests pass (`npm test`)
- [ ] New tests have been added for new functionality
- [ ] Code coverage has been maintained or improved (`npm run test:coverage`)
- [ ] Tests run successfully with all Node.js versions (18.x, 20.x, 22.x) if possible
- [ ] Manual testing performed (if applicable)

## Code Quality Checklist
<!-- Ensure all items are checked before submitting -->

- [ ] Code follows the project's style guidelines
- [ ] ESLint passes without errors (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No `any` types introduced without proper justification and `eslint-disable` comment
- [ ] Code is properly documented with JSDoc comments where appropriate
- [ ] No debugging code (e.g., `console.log`) left in production code

## Security Checklist
<!-- For dependency updates and security-related changes -->

- [ ] No new security vulnerabilities introduced
- [ ] Dependencies audited (`npm audit`)
- [ ] Sensitive data (API keys, tokens) not hardcoded

## Documentation
<!-- Check if documentation needs to be updated -->

- [ ] README updated (if applicable)
- [ ] Code comments added/updated for complex logic
- [ ] API documentation updated (if applicable)
- [ ] Examples updated (if applicable)

## Breaking Changes
<!-- If this is a breaking change, describe the impact and migration path -->

N/A

## Screenshots/Demo
<!-- If applicable, add screenshots or demo GIFs to help explain your changes -->

N/A

## Additional Notes
<!-- Any additional information that reviewers should know -->

---

## Pre-Submission Commands Run

```bash
npm ci                    # Clean install
npm run lint              # Linting
npm run build             # Build check
npm test                  # Run tests
npm run test:coverage     # Coverage check
```

## CI Status
<!-- The CI workflow will automatically run when you open this PR. Ensure all checks pass before requesting review. -->

- CI tests will run automatically
- All checks must pass before merge
- Coverage reports will be generated and uploaded as artifacts