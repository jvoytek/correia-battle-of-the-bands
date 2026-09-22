# correia-battle-of-the-bands

Turnkey static GitHub Pages site for the **Battle of the Bills** school fundraiser leaderboard.

## What is included

- Responsive single-page leaderboard overlay
- Animated team counters and lead differential
- Animated two-line Canvas progress graph
- Top five online student leaderboard
- GitHub Pages deployment workflow that republishes on every push to `main`

## Repository structure

```text
.
├── assets/background.png
├── css/styles.css
├── data/leaderboard.json
├── index.html
├── js/main.js
└── .github/workflows/pages.yml
```

## Updating the fundraiser totals

The live site reads its content from `/data/leaderboard.json`. To update the hosted leaderboard directly from GitHub:

1. Open `data/leaderboard.json` in the GitHub web UI.
2. Click the pencil icon to edit the file.
3. Update:
   - `lastUpdated`
   - each team's `totalPoints`
   - the daily `history` values
   - the student `leaderboard` entries
4. Commit the change to `main`.

That commit automatically triggers `.github/workflows/pages.yml`, which redeploys the static site to GitHub Pages. The page fetches `leaderboard.json` with a cache-busting timestamp query string so new data is not held behind stale CDN cache.

## Data format

```json
{
  "lastUpdated": "2026-09-22 10:00 AM",
  "teams": [
    { "grade": "7th Grade", "totalPoints": 14250 },
    { "grade": "8th Grade", "totalPoints": 13800 }
  ],
  "history": [
    { "day": "Day 1", "7th": 2100, "8th": 1950 },
    { "day": "Day 2", "7th": 4500, "8th": 4800 },
    { "day": "Day 3", "7th": 8900, "8th": 8200 },
    { "day": "Day 4", "7th": 14250, "8th": 13800 }
  ],
  "leaderboard": [
    { "name": "Suzie Q.", "grade": "7th Grade", "totalPoints": 123123 },
    { "name": "Jenny Q.", "grade": "8th Grade", "totalPoints": 3453453 },
    { "name": "Johnny Q.", "grade": "7th Grade", "totalPoints": 436343 },
    { "name": "Louise Q.", "grade": "8th Grade", "totalPoints": 85567 },
    { "name": "Cambria Q.", "grade": "7th Grade", "totalPoints": 23423 }
  ]
}
```

## Local preview

Because this is a static site, any simple HTTP server works:

```bash
cd correia-battle-of-the-bands
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
