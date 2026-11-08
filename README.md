# NaNter

Every converter and calculator in one pocket app, so you never need those ad-stuffed websites again.
Units, currency, dates, time zones, percentages, loans, sizes and more: **97 tools**, no ads, no accounts, no tracking, and it works offline.

**Open it:** https://hichamabd.github.io/NaNter/

On iPhone, open the link in Safari, tap **Share** then **Add to Home Screen**. NaNter then opens full screen with its own icon.

## Using it

- **Search does the maths.** Type in the search box and get the answer without opening anything:
  `5 ft 11 in cm`, `100 usd in eur`, `20% of 85`, `30% off 120`, `72 f`, `days until christmas`, `today + 90 days`,
  `in 10 working days`, `time in tokyo`, `3pm london in tokyo`, `distance paris tokyo`, `1 cup flour in g`, `0xff`, `1700000000`, `MMXXVI`, `12*3+4`,
  `2500 brut`, `1900 net en brut`, `impôt 30000`.
  Tap **Open** on an answer and the tool opens already filled in.
- **Type in any row.** Converters (units, currency, number bases, cups ↔ grams) have no "from" and "to": type in whichever row you like and every other row updates. Tap a unit name to copy its value.
- **Fill in any two.** Running pace, travel time, download time and Ohm's law work out whichever value you leave empty.
- **Number fields accept maths and both decimal styles:** `1,5` and `1.5`, `12*3`, `1/3`, `1 3/8`, `200 + 15%`.
- **Favorites** (☆ in any tool) sit at the top of the home screen. Recent tools follow. Everything you type is kept on the device.
- **Settings:** home currency, country (public holidays, VAT rates), metric/UK/US units, week start, 12/24 h clock, number format, precision, theme.

## Tools

| Category | Tools |
| --- | --- |
| Units | Length, weight, temperature, volume, area, speed, time, pressure, energy, power, force, torque, angle (incl. ° ′ ″ and slope %), frequency, fuel economy, EV efficiency, density, flow rate, acceleration, illuminance |
| Money | Currency (live rates, 200+ currencies and crypto), exchange history (charts, rate on any date), travel price cheat sheet, crypto & gold (per gram, 24k/22k/21k/18k), tip & split, discount, VAT / sales tax, margin & markup, loan & mortgage (insurance, overpayments, schedule), savings & compound interest, savings goals (how much per month, or when you get there, with a log of what you saved), salary, French gross ↔ net pay (non-cadre, cadre, civil servant, contractuel; net imposable, withholding), French income tax (parts, brackets, family cap, décote, marginal and withholding rate), unit price comparison, trip cost (fuel or EV), energy cost |
| Date & time | Date difference (working days, public holidays), add to date, age, countdowns, holidays (public holidays with long weekends and bridge days, French school holidays zones A/B/C), time zones (meeting planner), city distance (great circle, flight time), time calculator, timesheet, travel time, Unix time, date info (ISO week, day of year), calendars (Hijri, Hebrew, Persian, Chinese… with Ramadan and Eid dates), sun & moon |
| Math | Scientific calculator (history, degrees/radians), percentage, ratio & rule of three, fractions, number bases, Roman numerals, statistics, aspect ratio, area & volume, big numbers (million, milliard, lakh), numbers in words (EN/FR, cheques), random |
| Health | BMI, calories (BMR/TDEE), body fat, running pace, heart-rate zones, due date, blood values (glucose, HbA1c, cholesterol), sleep cycles |
| Kitchen | Cups ↔ grams (50 ingredients), recipe scaler (servings, factor, pan size), rice & pasta (portions, water, timing), oven temperature (°C, fan, °F, gas mark, French thermostat), coffee ratio |
| Home | Heating & air-con sizing for a room, energy prices (cost of 1 kWh of heat: electricity, heat pump, gas, oil, pellets, wood) |
| Sizes | Shoes, clothing, rings, paper, screen & PPI, tires, wire gauge |
| Tech | Data size, data speed, download time, color (HEX/RGB/HSL/CMYK/OKLCH, contrast), QR codes (link, Wi-Fi, contact, email, SMS), CSS units, Ohm's law, battery, text counter |
| Phone sensors | Spirit level (surface and edge, calibration), GPS speedometer (speed, trip, altitude, heading) |

## How it works

A static site with no build step: plain HTML, CSS and JavaScript modules, served by GitHub Pages from `main`.
A service worker caches the whole app on first visit, so it opens instantly and keeps working offline.

| Data | Source |
| --- | --- |
| Exchange rates | [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) (jsDelivr, with a Cloudflare mirror), then [ExchangeRate-API](https://www.exchangerate-api.com) and [Frankfurter](https://frankfurter.dev) (ECB) as fallbacks. Cached on the device with their date, so conversion works offline. |
| Rate history | Frankfurter / ECB since 1999 for its 30 currencies; daily snapshots since March 2024 for the others |
| Public holidays | [Nager.Date](https://date.nager.at), cached per country and year |
| French school holidays | Ministère de l’Éducation nationale open data ([data.gouv.fr](https://www.data.gouv.fr/fr/datasets/vacances-scolaires-par-zones/), Licence Ouverte), built in up to summer 2028 |
| Time zones, calendars | The device (`Intl`), so daylight-saving rules stay current |
| Sun & moon | NOAA-style solar equations (after SunCalc), computed locally |
| French pay & income tax | 2026 official figures, built in: PMSS 4,005 €, contribution rates, barème of the loi de finances 2026 (2025 income), neutral withholding grid from May 2026. Update `js/tools/frtax.js` each January. |

Nothing else leaves the device: no analytics, no cookies, no accounts.

## Project layout

```
index.html, manifest.webmanifest, sw.js    app shell, install metadata, offline cache
css/app.css                                all styles (light and dark)
js/app.js                                  router, home, search UI, settings
js/core/                                   number parsing/formatting, storage, UI components, forms, solver
js/data/                                   unit definitions, cities & time zones
js/lib/                                    currencies, dates, time zones, sun/moon, holidays, search answers
js/tools/                                  the tools, one module per category; registry.js lists them all
icons/                                     app icons (regenerate with node tests/icons.js)
tests/                                     logic and browser tests
```

Adding a tool: add a line to `js/tools/registry.js`, then implement it in the category module, either as a
declarative form (`fields` + `compute`) or with a `mount(root, ctx)` function.

## Development

```sh
python3 -m http.server 8765        # from the repository root, then open http://localhost:8765
node tests/test-logic.mjs          # conversions, dates, parsing, search answers
node tests/test-layout.js          # every tool at 320/375/390 px: no errors, no overflow, no input under 16 px
node tests/test-offline.js         # every tool renders with the network off
node tests/icons.js                # regenerate the PNG icons
```

**Deploying:** push to `main`. Bump `VERSION` in `sw.js` whenever files change (and add new files to `SHELL`),
so installed copies fetch the new version; they reload themselves once it's downloaded.
