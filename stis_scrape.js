name: Scrape STIS & Publish

on:
  schedule:
    - cron: "15 3 * * *"   # 03:15 UTC ~ 05:15 v ČR
  workflow_dispatch: {}

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install deps
        run: npm ci

      - name: Run scraper
        env:
          URLS: >
            https://stis.ping-pong.cz/tabulka/svaz-420211/rocnik-2025/soutez-6198
        run: |
          mkdir -p docs
          IFS=$'\n'
          for U in $URLS; do
            [ -z "$U" ] && continue
            node stis_scrape.js "$U"
          done
          mv -f *.json docs/ 2>/dev/null || true
          mv -f *.csv  docs/ 2>/dev/null || true

      - name: Create/Update docs/index.html
        run: |
          echo '<!doctype html><meta charset="utf-8"><title>STIS exporty</title><h1>Exporty</h1><ul id="list"></ul><script>fetch(".").then(r=>r.text()).then(t=>{const m=[...t.matchAll(/href="([^"]+\.(json|csv))"/g)].map(x=>x[1]);const ul=document.getElementById("list");m.forEach(f=>{const li=document.createElement("li");const a=document.createElement("a");a.href=f;a.textContent=f;li.appendChild(a);ul.appendChild(li);});});</script>' > docs/index.html

      - name: Commit artifacts
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add docs/*.json docs/*.csv docs/index.html || true
          git diff --staged --quiet || git commit -m "update scraped data"

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./docs

  deploy:
    needs: scrape
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4