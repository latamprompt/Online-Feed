name: Generate feed (manual/push)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: write  # needed to commit feed.xml back to the repo

concurrency:
  group: generate-feed
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Use Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Show workspace (debug)
        run: ls -la

      - name: Build RSS from Google Sheets
        run: |
          node generate-rss.js \
            --in "${{ secrets.FEED_CSV_URL }}" \
            --out feed.xml \
            --title "LatAm Online" \
            --site "https://latamprompt.github.io/Online-Feed/" \
            --feed "https://latamprompt.github.io/Online-Feed/feed.xml" \
            --desc "Latest posts" \
            --validate-xml

      - name: Commit feed.xml
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add feed.xml
          git commit -m "chore: auto-build RSS (manual/push)" || echo "No changes to commit"

      - name: Push changes
        run: git push

      - name: Upload feed.xml artifact (optional)
        uses: actions/upload-artifact@v4
        with:
          name: feed-xml
          path: feed.xml
