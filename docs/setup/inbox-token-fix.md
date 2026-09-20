# Fix the key that opens your private log folder

**Slug:** `inbox-token-fix` · **Who:** the owner (these steps need your GitHub login) · **Time:** about 5 minutes.

## What's wrong

The switch-over is finished. The nightly job now knows to read your logs from the private
repo instead of the public one. But when it tried, GitHub answered **"Not Found"** for
`redlands_wifi_inbox`.

The repo is there and the locked box is there — I checked both. So the problem is the
**key** inside the box: it doesn't open that repo.

The most likely reason is one dropdown. When you make a key, GitHub starts it on
**"Public repositories"**. Your inbox is *private*, so a key left on that setting can't
see it at all — which is exactly the "Not Found" we got.

You can't check a key after it's made (GitHub shows it only once), so the fix is to make
a fresh one and paste it in. The old one stops being used the moment you replace it.

---

## Part 1: Make a new key

1. Open https://github.com/settings/personal-access-tokens/new.
2. In **Token name**, type `redlands inbox v2`.
3. In **Expiration**, choose **Custom** and pick a date one year from today. Put a
   reminder in your calendar for that date.
4. In **Resource owner**, make sure it says **`patrickmroskam`** (your own account). If it
   shows an organisation instead, click it and choose `patrickmroskam`.
5. Find the **Repository access** section. **This is the step that matters.**
6. Click **"Only select repositories"**. (Not "Public repositories" — that's the one that
   causes "Not Found". Not "All repositories" either.)
7. A **Select repositories** dropdown appears. Click it.
8. Type `inbox` in the search box.
9. Click **`patrickmroskam/redlands_wifi_inbox`** in the list.
10. Check that the box now reads **"1 repository selected"** and names
    `redlands_wifi_inbox`. If it says something else, fix it before going on.
11. Scroll to **Permissions** and open **Repository permissions**.
12. Find **Contents** in that list. Set its dropdown to **Read and write**.
13. Leave every other permission on **No access**. (GitHub adds **Metadata: Read-only**
    by itself — that's normal, leave it.)
14. Scroll to the bottom and click **Generate token**.
15. Click the copy button next to the new key. It starts with `github_pat_`.
    **Keep this tab open** — GitHub shows the key only once.

## Part 2: Put the new key in the box

16. In a **new tab**, open
    https://github.com/patrickmroskam/redlands_wifi_project/settings/environments.
17. Click **ingest**.
18. Scroll to **Environment secrets**. You'll see `INBOX_TOKEN` already there.
19. Click the **pencil** (edit) icon next to `INBOX_TOKEN`.
20. In **Value**, select everything that's there, delete it, and paste the key you copied
    in step 15.
21. Click **Update secret**.
22. You can now close the tab that showed the key.

## Part 3: Delete the old key (tidy-up)

23. Go back to https://github.com/settings/tokens?type=beta.
24. Find the older **`redlands inbox`** entry — the one *without* `v2`.
25. Click **Delete**, then confirm.

---

## What happens next

Reply and I'll run the job in test mode ("dry run" — it reads your logs and reports what
it *would* publish, but changes nothing). If that comes back green, I'll turn the nightly
schedule on and the map starts updating by itself.

Your `wardrive_0.log` is sitting safely in the inbox. Nothing is lost while this waits.

**If step 6 already said "Only select repositories" and the inbox was already picked**,
then the dropdown wasn't the problem — tell me that in your reply and I'll dig further
instead of sending you round the same loop.

When you're finished, reply on OH HAI with: DONE inbox-token-fix
