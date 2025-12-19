This is the directly-pushed staging version of feature2.md, designed to purposefully cause merge conflicts when creating a cherry-pick PR from development to staging, since development has feature2.md created via a merged PR separately, with the label "unit-test-conflicts".

This is a feature that was built and PR'd into development. Staging will have the same file directly pushed to it with different content, which will result in a merge conflict when cherry picking development to staging.

This second paragraph was added in a follow-up commit, so the PR to development has 2 commits total.
