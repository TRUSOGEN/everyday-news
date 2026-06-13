# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `TRUSOGEN/everyday-news`. Use the `gh` CLI for issue operations when a workflow needs to publish, read, label, or close issues.

## Conventions

- Create an issue with `gh issue create --title "..." --body "..."`.
- Read an issue with `gh issue view <number> --comments`.
- List issues with `gh issue list --state open --json number,title,body,labels,comments`.
- Comment with `gh issue comment <number> --body "..."`.
- Apply labels with `gh issue edit <number> --add-label "..."`.
- Remove labels with `gh issue edit <number> --remove-label "..."`.
- Close issues with `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` resolves it automatically when run inside this clone.

## Skill behavior

When an engineering skill says "publish to the issue tracker", create a GitHub issue.

When a skill says "fetch the relevant ticket", run `gh issue view <number> --comments`.
