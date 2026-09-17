# Make a private inbox for your wardrive logs

**Slug:** `private-inbox` · **Issue:** [#30](https://github.com/patrickmroskam/redlands_wifi_project/issues/30) · **Who:** the owner (these steps need your GitHub login).

## Why

You chose option C on [#22](https://github.com/patrickmroskam/redlands_wifi_project/issues/22):
raw logs should stop being public. Raw logs show your drive route. From now on they go into a
**private** repo. Each night the bot reads them from there, publishes only the filtered map
data here, and deletes the processed logs from the private repo.

The bot can't create repos or tokens for you, so it needs you for three short parts
(about 10 minutes). Until you finish, **don't push new logs to this public repo.**

---

## Part 1: Make the private repo

1. Open https://github.com/new.
2. In **Repository name**, type `redlands_wifi_inbox`.
3. Choose **Private**.
4. Tick **"Add a README file"**. (The repo needs at least one file.)
5. Click **Create repository**.

## Part 2: Make a key that only opens that repo

6. Open https://github.com/settings/personal-access-tokens/new.
7. In **Token name**, type `redlands inbox`.
8. In **Expiration**, choose **Custom** and pick a date one year from today. Put a reminder in your calendar for that date. When the key expires, the nightly job stops and says why.
9. In **Resource owner**, leave it as `patrickmroskam`.
10. Under **Repository access**, click **"Only select repositories"**, then pick `patrickmroskam/redlands_wifi_inbox` from the list. Pick **only** that one.
11. Under **Permissions**, open **Repository permissions**. Find **Contents** and set it to **Read and write**. Leave everything else alone. (GitHub adds **Metadata: Read-only** by itself; that's fine.)
12. Scroll down and click **Generate token**.
13. Click the copy button next to the new key (it starts with `github_pat_`). **Keep this tab open.** GitHub shows the key only once. Don't paste it anywhere except step 21.

## Part 3: Put the key in a locked box that only the nightly job can open

The key goes into a GitHub **environment**. An environment is a locked box that only
workflows running on `main` can open. Pull requests can't open it.

14. In a new tab, open https://github.com/patrickmroskam/redlands_wifi_project/settings/environments.
15. Click **New environment**.
16. In **Name**, type `ingest`. Click **Configure environment**.
17. Find **Deployment branches and tags**. Open its dropdown (it says "No restriction") and choose **"Selected branches and tags"**.
18. Click **Add deployment branch or tag rule**. Leave the type on **Branch**, type `main`, and click **Add rule**.
19. Scroll down to **Environment secrets** and click **Add environment secret**.
20. In **Name**, type `INBOX_TOKEN`.
21. In **Value**, paste the key you copied in step 13.
22. Click **Add secret**. You can now close the tab that showed the key.

## Part 4: Where new logs go from now on

23. From now on, put new `wardrive_*.log` files in the **top folder of `redlands_wifi_inbox`**, next to its README, not in this public repo.
24. The easy way: open https://github.com/patrickmroskam/redlands_wifi_inbox/upload/main, drag the log files onto the page, and click **Commit changes**. Pushing with git works too.
25. You can upload logs right away. The bot won't read them until it has finished the switch-over, and nothing gets lost while they wait.

## Two things you're agreeing to (or not)

- **Rule change.** The project rule currently says "Never push the raw wardrive logs anywhere
  except `ingest/` in this repo." When you reply DONE, the bot changes it to name the private
  inbox instead. If you **don't** want that, say so in your reply.
- **Old logs in history.** The first 48 logs were already deleted from the public repo, but
  git history still has them. The bot will **leave history alone** unless you ask. Rewriting
  history is destructive, and anyone who already copied the repo keeps their copy. If you
  want it anyway, add the words `rewrite history` to your reply.

When you're finished, reply on OH HAI with: DONE private-inbox
