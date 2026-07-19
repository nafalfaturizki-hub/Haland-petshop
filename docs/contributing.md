# Contribution Guidelines

## Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`

## Code Standards
- TypeScript with strict mode (no `any` types)
- ESLint compliance (run `npm run lint` before committing)
- All server actions must have JSDoc comments
- Zod schemas for all input validation
- Server actions return `{ success, data/message }` shape

## Pull Request Process
1. Ensure all tests pass: `npm test`
2. Ensure typecheck passes: `npm run typecheck`
3. Ensure lint passes: `npm run lint`
4. Update ICM.md checklist if adding new features
5. Request review from at least one team member

## Branch Naming
- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code refactoring

## Commit Messages
Follow conventional commits: `type(scope): description`
Examples: `feat(invoice): add partial payment support`, `fix(pos): validate sellPrice against DB`
