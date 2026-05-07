# `imageDetection.py`

Developer utility used to help find screen coordinates for new UI elements. It provides interactive windows with sliders to tune OpenCV detection parameters (Blur, Canny, Thresholds, etc.).

## Installation

Install its dependencies (kept separate from the data scraper since they only overlap on `numpy`):

```bash
pip install -r scripts/imageDetection/requirements.txt
```

## Running

From the repo root:

```bash
python scripts/imageDetection/imageDetection.py
```

Paths resolve via `Path(__file__).parent`, so the script works regardless of the current working directory. The sample PNGs co-located in this folder (e.g., `imageDetectionSample.png`) are used as input.
