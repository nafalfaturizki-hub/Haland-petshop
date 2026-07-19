# Dependency Update Policy

## Update Frequency
- **Security patches**: Apply within 7 days of release
- **Minor updates**: Review monthly
- **Major updates**: Review quarterly with regression testing

## Update Process
1. Check for updates: `npm outdated`
2. Create branch: `git checkout -b deps/update-xxx`
3. Update package: `npm install package@latest`
4. Run full test suite: `npm test && npm run typecheck && npm run lint`
5. If tests pass, merge branch
6. For major versions, run full regression on staging first

## Critical Packages
| Package | Strategy | Notes |
|---------|----------|-------|
| next | Pin minor, review major | Full regression |
| prisma/@prisma/client | Keep in sync | Update together |
| next-auth | Review all releases | Security-critical |
| zod | Auto-update minor | Backward compatible |

## Security Advisories
- Monitor `npm audit` in CI/CD
- Subscribe to GitHub Security Advisories
- Use Dependabot for automated PRs

## Rollback
```bash
npm install package@previous-version
npm test
```
