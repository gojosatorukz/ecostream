# EcoStream

EcoStream is a classroom prototype for comparing estimated operational emissions and investigating low-utilisation cloud resources.

**[Bekzat Rashiduly](https://github.com/gojosatorukz) — frontend prototype and product demo.** I worked on the browser demo and prepared the walkthrough for the team presentation.

**[Open the live demo](https://gojosatorukz.github.io/ecostream/)**

## Demo walkthrough

1. Open **Cloud connections** to see the AWS, Azure and GCP fixtures.
2. On **Overview**, compare two consecutive seven-day windows using the same set of reporting resources. The full fixture contains 30 resources, of which 29 have complete telemetry.
3. On **Resources**, inspect the missing-data state and open `app-staging-03` to check its model inputs. One day at 0.04 kW uses 0.96 kWh. Applying the synthetic factor of 400 gCO₂eq/kWh gives 384 gCO₂eq.
4. Review a **Recommendation** to see the CPU and memory rule, then try the local alert sink.
5. Export **PDF** or **CSV** from **Reports** using the selected period, provider and environment.

The site uses synthetic telemetry, region-specific teaching factors and browser-local state. It performs no cloud operations and sends no external notifications. Emissions exclude embodied carbon. The matched-period change is a fixture result, separate from the project’s untested 90-day pilot target.

## Run locally

Open `index.html` in a browser or run `python3 -m http.server 8000` in this folder. No dependencies, credentials or build step are required.

- `telemetry.js` contains the fixture, energy calculations and matched-cohort comparison.
- `app.js` contains the dashboard, review flow and PDF/CSV exports.
- `styles.css` contains the shared responsive layout.
