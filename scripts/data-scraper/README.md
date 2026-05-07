# Game Data Update Instructions

This directory contains the Python scraper that produces the game-data JSON files in [`src/data/`](../../src/data/) used by the Uma Musume Android Automation bot.

## Prerequisites

- **Python 3.10+**: Ensure you have Python installed and added to your PATH.
- **Google Chrome**: Required for scraping data via Selenium.
- **Chrome Driver**: Selenium will attempt to manage this automatically, but ensure your Chrome is up to date.

## Installation

Install the required Python dependencies using `pip`:

```bash
pip install -r scripts/data-scraper/requirements.txt
```

## Updating Game Data

To update all game data files (`skills.json`, `characters.json`, `supports.json`, `races.json`, `epithets.json`, and `characterPresets.json`), run the following command from the repo root:

```bash
python scripts/data-scraper/main.py
```

The script writes its output into [`src/data/`](../../src/data/) regardless of the current working directory (paths are resolved via `Path(__file__).resolve().parents[2] / "src" / "data"`).

### What this script does:

1.  **Skills**: Scrapes skill data, evaluation points (from Umamusume Wiki), and tier lists (from Game8).
2.  **Characters**: Scrapes character-specific training events and "After a Race" events.
3.  **Support Cards**: Scrapes support card training events and effects.
4.  **Races**: Scrapes race information and calculates turn numbers for the in-game calendar.
5.  **Epithets**: Scrapes nickname rewards and conditions; preserves the curated `dependsOn` and `matchers` fields used by the Smart Race Solver.
6.  **Character Presets**: Scrapes per-character distance and surface aptitudes used by the Smart Race Solver as starting aptitude defaults (`characterPresets.json`). Selectors are best-effort and may need updating if gametora reshuffles its CSS modules.

> [!NOTE]
> The script uses **Delta Scraping** by default (defined by `IS_DELTA = True` in `main.py`). This means it will only fetch new or updated items to save time. If you need a full refresh, set `IS_DELTA = False` in `main.py`.
