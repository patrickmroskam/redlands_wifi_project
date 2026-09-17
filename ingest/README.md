# ingest/ — drop wardrive files here

This folder is the inbox for raw wardrive logs (WiGLE CSV 1.4 files from the ESP32
Marauder, usually named `wardrive_N.log`).

## How to add new files (3 steps)

1. Copy your new `wardrive_*.log` files into this `ingest/` folder.
2. Commit them:
   ```bash
   git add ingest && git commit -m "ingest: add wardrive logs"
   ```
3. Push:
   ```bash
   git push
   ```

That's it. Once a day (or when the "Ingest wardrive logs" workflow is run manually from
the Actions tab) the pipeline reads every file here, keeps only networks inside ZIP
codes 92373 / 92374 that aren't already in the database, adds them to
`data/networks.json`, and **deletes the processed files from this folder**.

Files that can't be parsed are left here, named in the run's summary, and the run
is marked failed (red) in the Actions tab so you notice.
Do not put anything else in this folder.
