# Put the site on redlandswifiproject.com (Cloudflare free plan)

**Slug:** `custom-domain` · **Issue:** [#17](https://github.com/patrickmroskam/redlands_wifi_project/issues/17) · **Who:** the owner (these steps need your Namecheap, Cloudflare and GitHub logins).

## Read this first — what we found on 2026-09-17

- **The domain is registered at Namecheap, not Cloudflare.** A `whois` lookup shows
  `Registrar: NameCheap, Inc.` and nameservers `dns1/dns2.registrar-servers.com`
  (those are Namecheap's). So Cloudflare is not in charge of it yet. Part 1 moves the
  DNS to Cloudflare's free plan. Part 5 (optional) also moves the *registration*
  to Cloudflare.
- **The domain already points at GitHub Pages, but no GitHub repo claims it.** Its
  `A` records are GitHub's four IPs, and `www` is a CNAME to `patrickmroskam.github.io`.
  This repo has no custom domain set, and the domain is not verified on your GitHub
  account. In that state, **any GitHub user could create a repo, claim
  `redlandswifiproject.com`, and serve their own page on it.** Part 2 closes that hole.
  Do Parts 1–2 soon.

## When to do each part

| Part | What | When |
|---|---|---|
| 1 | Move DNS to Cloudflare (free) | **Now.** It changes nothing visible: the records stay the same. |
| 2 | Verify the domain with GitHub | **Now, right after Part 1.** This stops anyone else from claiming the domain. |
| 3 | Switch the site to the domain | **Later: after the backfill (#8) and the security audit (#14) are merged** and the live site shows the real data. Pick an evening (Pacific) with about an hour free. **Avoid 2:30–3:30 AM Pacific,** when the daily ingest job runs and pushes to `main`. Weekday evenings are ideal: if something looks wrong, you can fix it the same night, and few visitors are around. |
| 4 | Tell the bot you're done | Right after Part 3. |
| 5 | (Optional) transfer the registration to Cloudflare | Any time after Part 1 is active. It costs one year of renewal (about $10). |

Why wait for Part 3? The first time people see `redlandswifiproject.com`, it should
show the finished map with the real data, and it should already have passed the
security review.

---

## Part 1 — Move the DNS to Cloudflare's free plan

You need your Namecheap login and an email address for Cloudflare.

1. Open https://dash.cloudflare.com/sign-up and create a free account. If you already have one, log in at https://dash.cloudflare.com.
2. On the Cloudflare home page, click the **"+ Add"** button (top right) and choose **"Connect a domain"**. Older screens call it **"Add a domain"** or **"Add site"**.
3. In the box, type `redlandswifiproject.com` (no `www`, no `https://`).
4. Leave **"Quick scan for DNS records"** selected. Click **Continue**.
5. When it asks for a plan, scroll to the bottom, click the **Free** plan ($0), and click **Continue**.
6. Cloudflare shows the DNS records it found. **Make the list match this table exactly** (use **Edit** or **Delete** on each row, and **Add record** for any that are missing):

   | Type | Name | Content / Target | Proxy status |
   |---|---|---|---|
   | A | `@` | `185.199.108.153` | **DNS only** (grey cloud) |
   | A | `@` | `185.199.109.153` | **DNS only** |
   | A | `@` | `185.199.110.153` | **DNS only** |
   | A | `@` | `185.199.111.153` | **DNS only** |
   | AAAA | `@` | `2606:50c0:8000::153` | **DNS only** |
   | AAAA | `@` | `2606:50c0:8001::153` | **DNS only** |
   | AAAA | `@` | `2606:50c0:8002::153` | **DNS only** |
   | AAAA | `@` | `2606:50c0:8003::153` | **DNS only** |
   | CNAME | `www` | `patrickmroskam.github.io` | **DNS only** |

   - **The proxy switch matters.** Cloudflare usually turns the orange cloud ("Proxied") on by default. Click it on each of these rows so it turns **grey** and reads **"DNS only"**. Here is why: GitHub has to see its own servers behind the name to issue and renew the free HTTPS certificate. GitHub Pages already has its own fast CDN, and a second cache in front of it could keep serving yesterday's map after the daily update.
   - **Delete any other `A`, `AAAA` or `CNAME` record named `@` or `www`**, such as a Namecheap "parking page" address.
   - **Keep `MX` and `TXT` records only if you use email on this domain.** If you don't, you can delete them.
   - Leave **TTL** on **Auto**.
7. Click **Continue** (or **Continue to activation**). Cloudflare now shows **two nameservers**, for example `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`. Yours will have different names. **Copy both exactly.** Keep this tab open.
8. In a new tab, log in at https://www.namecheap.com and click **Domain List** in the left menu.
9. Find `redlandswifiproject.com` and click **Manage** on its row.
10. Scroll to the **NAMESERVERS** section. Open its dropdown (it currently says "Namecheap BasicDNS") and choose **"Custom DNS"**.
11. Paste the first Cloudflare nameserver in box 1 and the second in box 2. If there are more boxes, remove the extras with the trash icon.
12. Click the **green check mark** ✓ next to the boxes to save. Namecheap says the change can take up to 48 hours; it usually takes under an hour.
13. Go back to the Cloudflare tab and click **"Check nameservers now"**. The domain is ready when Cloudflare shows it as **Active**; Cloudflare also sends an email. If it isn't active yet, come back later. The site keeps working the whole time, because the records are identical.
14. (Skip for now) Cloudflare may suggest **DNSSEC**. Leave it off: turning it on also requires a step at Namecheap, and it's easy to get wrong. We can add it later.

## Part 2 — Verify the domain with GitHub (stops domain takeover)

15. Open https://github.com/settings/pages. These are your *account* Pages settings, not the repo's.
16. Under **"Verified domains"**, click **"Add a domain"**.
17. Type `redlandswifiproject.com` and click **"Add domain"**.
18. GitHub shows a **TXT record** with two parts: a **name** that looks like `_github-pages-challenge-patrickmroskam`, and a **value** that is a long random code. Leave this page open.
19. In Cloudflare, open `redlandswifiproject.com`, then click **DNS → Records → "+ Add record"**.
20. Set **Type** to `TXT`. Paste the GitHub **name** into **Name** (just `_github-pages-challenge-patrickmroskam`; Cloudflare adds the domain itself). Paste the GitHub **value** into **Content**. Click **Save**.
21. Go back to the GitHub page and click **"Verify"**. If it says it can't find the record, wait 5–10 minutes and click **Verify** again. When it works, the domain shows a green **Verified** badge.
22. **Never delete that TXT record.** It keeps the domain locked to your account.

When Parts 1–2 are done, reply on OH HAI with: `DONE custom-domain-dns`. You can also say it in chat.

---

## Part 3 — Switch the site to the domain (do this at the time chosen above)

23. Open https://github.com/patrickmroskam/redlands_wifi_project/settings/pages.
24. Find the **"Custom domain"** box, type `redlandswifiproject.com` (no `www`), and click **Save**.
    GitHub creates a small commit on `main` that adds a file named `CNAME`. That is expected; don't delete it.
25. Under the box, GitHub runs a **DNS check**. Wait until it says **"DNS check successful"**. This usually takes a minute or two. If it reports a problem, re-check the table in step 6 (grey clouds!).
26. Wait for the HTTPS certificate. The **"Enforce HTTPS"** checkbox stays greyed out until GitHub has issued it, which usually takes 15–60 minutes and can take up to 24 hours. Refresh the page now and then.
27. When **"Enforce HTTPS"** becomes clickable, **tick it**.
28. Test these three addresses in a browser:
    - https://redlandswifiproject.com — the map loads, with a padlock in the address bar.
    - https://www.redlandswifiproject.com — it jumps to the address above.
    - https://patrickmroskam.github.io/redlands_wifi_project/ — it jumps to the new domain.
29. If the map loads but looks old, press **Shift + Reload** once.

## Part 4 — Tell the bot

30. Reply on OH HAI with: `DONE custom-domain`.
    The dev team then updates the repo's references to the new address (README, spec, constitution `site_url`, tests) in a pull request.

## Part 5 — (Optional) Move the registration itself to Cloudflare

Cloudflare Registrar charges only the wholesale price at renewal. The transfer adds one
year to the expiry date, so you pay that year up front. You can only start once Part 1 shows **Active**.

31. In Namecheap: **Domain List → Manage** on `redlandswifiproject.com` → **Sharing & Transfer** tab. Turn **Domain Lock** **OFF**.
32. On the same tab, click **"Auth Code"** → **Get**. Namecheap emails you the transfer code.
33. In Cloudflare: open https://dash.cloudflare.com, click **Domain Registration → Transfer Domains**, tick `redlandswifiproject.com`, and click **Confirm domains**.
34. Paste the auth code from the email, fill in the contact form, add a payment card, and click **Confirm and finalize transfer**.
35. Namecheap sends an email asking you to approve the transfer. Click the approval link to finish it now; otherwise it completes by itself within about 5 days.
36. The site doesn't change at all during a transfer; only the company you pay changes.

When you're finished, reply on OH HAI with: DONE custom-domain
