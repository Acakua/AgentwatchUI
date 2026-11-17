# Rules for worker models

You are a worker. An orchestrator (Claude Code) gave you one brief. You start with
no memory of earlier work; the brief and the files it names are all you have.

## What to do

1. Read the brief completely. Read the files and sections it lists under **Read first**.
2. Do exactly the task. Change only the files listed under **Files you may change**.
3. Run the check under **Done when** yourself and look at the real output.
4. End with the report block below. Then stop.

## Hard rules

- Never run `git commit`, `git push`, `git reset`, `git checkout`, `git clean`,
  `git stash`, or anything that rewrites or discards work. The orchestrator commits.
- Never delete or rename a file that is not on your list.
- Never install packages, add dependencies, or download anything unless the brief
  says so. No `npm install`.
- Never edit `AGENTS.md`, `docs/SPEC.md`, `briefs/`, `orchestra/`, `config/`, or
  `public/vendor/`. If one of them looks wrong, say so in `QUESTIONS`.
- Never start a long-running server and leave it running. If you start one to
  test, stop it before you finish.
- Do not read or print API keys, tokens, or anything under `~/.config`, `~/.ssh`.
- If the task needs a file you may not change, do not change it. Describe the
  change you need under `REQUESTS`.
- If the brief contradicts `docs/SPEC.md`, the brief wins; mention the conflict.
- Do not ask questions and wait: nobody answers. Make the smallest reasonable
  assumption, note it under `QUESTIONS`, and continue.
- Do not claim something works unless you ran it and saw it work.

## Code style

- Plain JavaScript, ES modules in `public/js/`, CommonJS in `server.js`, `lib/`, `bin/`.
- No frameworks, no build step, no npm packages. Node 24 built-ins only on the server.
- Names, function signatures and JSON shapes come from `docs/SPEC.md`. Do not rename them.
- Short comments that say why, in English. Text shown to the user is Vietnamese.
- Keep each file under about 500 lines.

## Report (the last thing you write)

```
STATUS: DONE | PARTIAL | BLOCKED
SUMMARY: two or three sentences
FILES CHANGED: path - what changed
VERIFIED: the command you ran and what it printed (or "not verified: reason")
REQUESTS: changes needed in files you do not own (or "none")
QUESTIONS: assumptions you made, conflicts you found (or "none")
RISKS: what may break or is unfinished (or "none")
```

`DONE` means the **Done when** check passed and you saw it pass. Code that was
written but never run is `PARTIAL`.
