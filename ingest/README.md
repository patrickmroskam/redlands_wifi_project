# ingest/ — retired, leave it empty

Raw wardrive logs **no longer go here.** This repository is public, and a raw log shows
your drive route, so since issue #30 the logs go to a **private** repo instead.

## Where new logs go now

Put your `wardrive_*.log` files in the top folder of the private inbox:

**https://github.com/patrickmroskam/redlands_wifi_inbox**

The easy way: open
<https://github.com/patrickmroskam/redlands_wifi_inbox/upload/main>, drag the files onto
the page, and click **Commit changes**. Pushing with git works too.

Once a day (or when the "Ingest wardrive logs" workflow is run manually from the Actions
tab) the pipeline reads every file there, keeps only networks inside ZIP codes
92373 / 92374 that aren't already in the database, adds them to `data/networks.json`
here, and **deletes the processed files from the private inbox**.

Files that can't be parsed are left in the inbox, named in the run's summary, and the run
is marked failed (red) in the Actions tab so you notice.

## Why this folder still exists

The first 48 logs were processed here before the switch, and they are still in this
repository's **git history**. Emptying the folder did not remove them; only a history
rewrite would, and that is tracked separately because it is destructive.

Do not put anything in this folder.
