# Community documentation and publication

The [community guide](wiki/Home.md) is the reviewable source for the RedTide ppc (RTP) Wiki. The [Discussions tab](https://github.com/franshessss2/red-tide-ppc/discussions) is for questions, ideas and project news. Code defects belong in [Issues](https://github.com/franshessss2/red-tide-ppc/issues).

## Publication state

- **Repository guide:** these Markdown pages are available as soon as the PR is merged. README links point to these working copies.
- **Discussions:** the Community discussions workflow creates the two starter posts on a matching push to `main`. Check its run and printed URLs before saying they are published. Existing posts with the same title/category are preserved; edits here do not overwrite a live discussion.
- **Native GitHub Wiki:** the pages and navigation below are prepared, but direct publication is pending an authenticated Wiki/browser connection. Merging this PR alone does not populate the Wiki tab. GitHub stores the Wiki separately from this repository.

## Wiki pages

| Source | Wiki page title |
| --- | --- |
| [Home](wiki/Home.md) | Home |
| [Getting started](wiki/Getting-started.md) | Getting started |
| [Data and limits](wiki/Data-and-limits.md) | Data and limits |
| [Android app](wiki/Android-app.md) | Android app |
| [Windows app](wiki/Windows-app.md) | Windows app |
| [Contributing and troubleshooting](wiki/Contributing-and-troubleshooting.md) | Contributing and troubleshooting |
| [Sidebar](wiki/_Sidebar.md) | _Sidebar |
| [Footer](wiki/_Footer.md) | _Footer |

Keep these filenames when copying to the Wiki's separate Git repository. Guide links use relative `.md` targets so the repository copy works now; convert those page links to the corresponding Wiki URLs when publishing. The prepared Sidebar already uses Wiki URLs, while implementation references link to repository files. Do not replace or delete an existing Wiki without checking it first. Once the pages are actually published, update this state and the README navigation in a follow-up.

## Discussions and forms

The two initial posts are [Welcome](discussions/welcome.md) in **Announcements** and [Next improvements](discussions/ideas.md) in **Ideas**. [The manifest](discussions/posts.json) defines their exact titles and categories. The existing category names must match; the publisher never creates or deletes categories.

`.github/DISCUSSION_TEMPLATE/ideas.yml` and `q-a.yml` match the existing **Ideas** and **Q&A** category slugs. They request context without asking for credentials or personal information.

## Maintainer checks

```sh
node scripts/community-discussions.mjs --check
node --test scripts/community-discussions.test.mjs
git diff --check
```

The new workflow runs those checks on affected PRs with `contents: read`. Publishing runs only on this repository's `main`, with `contents: read` and `discussions: write`, using the temporary `GITHUB_TOKEN`. There is no PAT, repository write permission, push command, remote-code execution or Wiki write in that job. Its application network call is only to GitHub's GraphQL API. Actions checkout and Node setup also contact GitHub/tool-download services.

Reruns scan all Discussion pages before creating posts and skip existing titles in the matching category. Ambiguous duplicates or missing categories stop publication. A request timeout fails the run; rerunning first checks whether the earlier request already created the post. Use the workflow's **Run workflow** on `main` for a retry. It does not schedule recurring posts or notify a user list.

See GitHub's [Wiki documentation](https://docs.github.com/en/communities/documenting-your-project-with-wikis), [Discussions quickstart](https://docs.github.com/en/discussions/quickstart), [category forms](https://docs.github.com/en/discussions/managing-discussions-for-your-community/creating-discussion-category-forms) and [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).
