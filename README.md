# Game Planning

Re-platform of the Game Planning App from a split LAMP stack (PHP/MySQL REST API +
vanilla-JS PWA) to a single Next.js (App Router) + TypeScript monorepo.

The legacy app still lives at `gameplan.stephens.page` (UI) and `api.gameplan.stephens.page`
(API) and remains the behavioral source of truth until parity is reached.

## Status

Pre-scaffold. The authoritative plan is in
[`docs/game-planning-architecture-plan.md`](docs/game-planning-architecture-plan.md),
audited against the live PHP source. Implementation follows the milestones in that doc.
