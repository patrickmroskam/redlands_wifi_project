# Close the domain-takeover window on redlandswifiproject.com

**Slug:** `domain-takeover` · **Issue:** [#17](https://github.com/patrickmroskam/redlands_wifi_project/issues/17) · **Who:** the owner (needs your Namecheap and GitHub logins) · **Time:** about 5 minutes

> This is the **security-only** half of [`custom-domain.md`](custom-domain.md), pulled out so it can be done on its own.
> It does **not** move DNS to Cloudflare, and it does **not** switch the site over to the domain.
> Visitors see no change at all. The site stays exactly where it is.

## What's wrong right now

Checked again on 2026-09-18 at 07:38 UTC — this is live, not an old note:

- `redlandswifiproject.com` points its `A` records at GitHub Pages' four servers, and `www` points at `patrickmroskam.github.io`.
- But **no GitHub repository claims that name**, and **the domain is not verified on your GitHub account**. Opening https://redlandswifiproject.com/ today returns GitHub's "Site not found" 404 page.

That combination is the problem. GitHub hands a custom domain to whichever repository claims it first. Because DNS already points at GitHub and nothing on your account reserves the name, **any GitHub user can create their own repository, type `redlandswifiproject.com` into its Pages settings, and start serving their own content on a web address carrying this project's name.** Verifying the domain is the switch that reserves it for your account only.

## Pick ONE of the two options

Both close the hole completely. Option A keeps the domain for later; Option B gives it up.

---

## Option A — Reserve the name for your account (recommended, ~5 min)

Do this if you still want `redlandswifiproject.com` eventually. It is invisible to visitors and reversible.

1. Open https://github.com/settings/pages in your browser. (These are your **account** settings — not the repository's.)
2. Find the **"Verified domains"** section and click **"Add a domain"**.
3. Type `redlandswifiproject.com` and click **"Add domain"**.
4. GitHub now shows you a **TXT record** made of two pieces:
   - a **name**, which looks like `_github-pages-challenge-patrickmroskam`
   - a **value**, which is a long random code

   **Leave this browser tab open.** You need to copy from it in a moment.
5. In a **new tab**, log in at https://www.namecheap.com.
6. Click **Domain List** in the left-hand menu.
7. Find `redlandswifiproject.com` in the list and click the **Manage** button on its row.
8. Click the **Advanced DNS** tab along the top.
9. Scroll to the **HOST RECORDS** section and click **ADD NEW RECORD**.
10. Fill the new row in like this:
    - **Type:** choose `TXT Record`
    - **Host:** paste the GitHub **name** from step 4 — just `_github-pages-challenge-patrickmroskam`, without `.redlandswifiproject.com` on the end. Namecheap adds the domain part itself.
    - **Value:** paste the long random **value** from step 4.
    - **TTL:** leave it on `Automatic`.
11. Click the **green check mark** ✓ at the end of the row to save it. (Namecheap does not save the row until you click it.)
12. Go back to the GitHub tab from step 4 and click **"Verify"**.
13. If GitHub says it cannot find the record, wait 5–10 minutes and click **"Verify"** again. DNS changes take a few minutes to travel.
14. You are done when the domain shows a green **Verified** badge.
15. **Never delete that TXT record.** It is what keeps the name locked to your account.

**Do not** type the domain into the repository's Pages settings. That is Part 3 of `custom-domain.md` and it is a separate, later decision.

---

## Option B — Give the domain up (~3 min)

Do this instead if you have decided you don't want `redlandswifiproject.com` at all. Removing the records means the name no longer points at GitHub, so there is nothing for anyone to claim.

1. Log in at https://www.namecheap.com.
2. Click **Domain List** in the left-hand menu.
3. Find `redlandswifiproject.com` and click **Manage** on its row.
4. Click the **Advanced DNS** tab along the top.
5. In **HOST RECORDS**, delete these rows using the trash-can icon at the end of each:
   - the four **A Records** with Host `@` pointing at `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - the **CNAME Record** with Host `www` pointing at `patrickmroskam.github.io`
   - any **AAAA Records** with Host `@` pointing at addresses starting `2606:50c0:`
6. Leave every other record alone (especially `MX` or `TXT` rows, if you use email on this domain).

The site at https://patrickmroskam.github.io/redlands_wifi_project/ is completely unaffected either way — it does not use this domain today.

---

## Which one should I pick?

If you are unsure, **pick Option A**. It costs nothing, changes nothing visitors can see, and keeps every option open. Option B is only for "I don't want this domain any more."

When you're finished, reply on OH HAI with: `DONE domain-takeover`

Tell us which option you chose, so the follow-up is right: after **A**, issue #17 becomes the ordinary "switch the site over" task (out of v1 scope, no hurry). After **B**, #17 closes and the custom domain leaves the plan entirely.
