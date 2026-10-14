# Rules for agents working on Senyap

Short public rules for any coding agent working from a clone of this repository. The full internal
handoff (`task-tracker.md`, `AGENTS.md`) lives only in the owner's local working folder.

- Never push while the GitHub repository is public. Check `gh repo view --json visibility` right before
  every push. Never change repository visibility.
- Never print or commit secrets. Variable names live in `.env.example`; values never do. Nothing secret
  goes into `apps/web` or any `VITE_*` variable.
- Install the Compact toolchain only with a pinned version: `compact update 0.31.1`.
- Installing global tools, Docker images or browser extensions, deploying, sending transactions and
  posting publicly all need the owner's explicit approval.
- Demo data is always labelled. Never claim a feature that does not run.
- Design rules are in `DESIGN.md` (no eyebrow labels above headings, no small monospace labels, no glow,
  no gradient washes, no em dashes in copy, justified paragraphs, SF Pro).
- Specification: `SPEC.md`. Product context: `PRODUCT.md`.
