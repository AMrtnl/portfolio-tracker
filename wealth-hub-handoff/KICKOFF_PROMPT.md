# Paste this into Claude Code, from the root of the Wealth Hub repo

I've added a design handoff at `./wealth-hub-handoff/`. Read `wealth-hub-handoff/HANDOFF.md` in full before doing anything else, then skim `tokens/`, `reference/code/` and the files in `reference/screens/` that correspond to screens this repo already has.

We are rebuilding Wealth Hub's interface in its new brand identity. Work in the phases defined in the handoff, one at a time, with atomic commits, and stop for my review at the end of each phase.

Start with **Phase 0 only**: audit the repo and report back. Do not change any files yet. In the report I want:
1. The stack and how styling, routing, state and data are organised today.
2. Where the hand-written chart code lives and how it is structured, since the new chart kit must follow the same no-dependency approach.
3. Exactly where you propose to put the tokens, fonts, icon font, the adaptive `Mark` component, the token tile, and the chart kit.
4. Anything in the handoff that conflicts with how this codebase works, with your recommended resolution.
5. A file-level plan for Phase 1.

Constraints that are not negotiable: no chart library, no UI kit, no variant prop on the logo (it adapts to its ground by itself), green and red only for money meaning, gold once per screen, and copy that never claims to be financial advice.

When I approve Phase 0, run `/autoplan` for Phase 1.
