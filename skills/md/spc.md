---
name: SPC Charts and Capability
command: /spc
version: "1.0"
category: Engineering
editions: both
editions_reason: "Works in both editions. All math runs in local Python with pandas, numpy, and matplotlib. Your measurement data stays on your PC."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /spc: SPC Charts and Capability

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Make statistical process control charts from measurement data: X-bar and R charts for subgroups, or I-MR charts for individual readings. Compute Cp and Cpk against spec limits, flag Western Electric and Nelson rule violations, and save a PNG chart plus a table of results. The numbers are computed in code, not by the language model.

## When to use

- You have a CSV or Excel column of measurements and want to know if the process is stable.
- You need a capability number (Cp, Cpk) for a customer or a review.
- You want to find points that break run rules before they become scrap.

## When not to use

- Attribute data (pass/fail counts, defects per unit). Those need p, np, c, or u charts, which this version does not draw.
- Fewer than 20 points (I-MR) or 20 subgroups (X-bar R). The skill will warn that limits are not reliable yet.
- Data that is clearly not from one process (mixed machines or parts). Split it first.

## Requirements

- Python 3.10 or later with `pandas`, `numpy`, `matplotlib`, and `openpyxl` for Excel input.
- Model: any Gemma 3 size or a Nemotron model. The model only picks columns and explains results; all statistics come from the code below, so small models are fine.

## Inputs

| Input | Required | Example |
|---|---|---|
| Data file | Yes | `bore_dia.csv` or `.xlsx` |
| Value column | Yes | `diameter_mm` |
| Subgroup column or size | For X-bar R | `subgroup` or `n=5` |
| LSL, USL | For capability | `24.95`, `25.05` |
| Target | No | `25.00` |
| Rules | No | `we` (Western Electric, default) or `nelson` |

## Step-by-step procedure

1. **Load and inspect.** Show the first rows, the count, missing values, and min and max. Ask which column to use if more than one is numeric. Drop blank rows and tell the user how many.

2. **Pick the chart.**
   - Subgroup column given or subgroup size 2 to 10: X-bar and R.
   - Otherwise: I-MR.

3. **Compute limits with standard constants.**

   | n | A2 | D3 | D4 | d2 |
   |---|---|---|---|---|
   | 2 | 1.880 | 0 | 3.267 | 1.128 |
   | 3 | 1.023 | 0 | 2.574 | 1.693 |
   | 4 | 0.729 | 0 | 2.282 | 2.059 |
   | 5 | 0.577 | 0 | 2.114 | 2.326 |
   | 6 | 0.483 | 0 | 2.004 | 2.534 |
   | 7 | 0.419 | 0.076 | 1.924 | 2.704 |
   | 8 | 0.373 | 0.136 | 1.864 | 2.847 |
   | 9 | 0.337 | 0.184 | 1.816 | 2.970 |
   | 10 | 0.308 | 0.223 | 1.777 | 3.078 |

   ```python
   import numpy as np
   import pandas as pd

   A2 = {2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308}
   D3 = {2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076, 8: 0.136, 9: 0.184, 10: 0.223}
   D4 = {2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777}
   D2 = {2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078}

   def xbar_r(df: pd.DataFrame, value: str, group: str) -> dict:
       g = df.groupby(group, sort=False)[value]
       sizes = g.size()
       n = int(sizes.mode()[0])
       g = df[df[group].isin(sizes[sizes == n].index)].groupby(group, sort=False)[value]
       xbar, r = g.mean(), g.max() - g.min()
       xbb, rbar = xbar.mean(), r.mean()
       return {
           "n": n, "xbar": xbar, "r": r, "center": xbb, "rbar": rbar,
           "ucl_x": xbb + A2[n] * rbar, "lcl_x": xbb - A2[n] * rbar,
           "ucl_r": D4[n] * rbar, "lcl_r": D3[n] * rbar,
           "sigma_within": rbar / D2[n],
           "dropped_groups": int((sizes != n).sum()),
       }

   def i_mr(x: pd.Series) -> dict:
       x = x.reset_index(drop=True)
       mr = x.diff().abs()
       mrbar = mr.mean()               # mean of the n-1 moving ranges
       center = x.mean()
       sigma = mrbar / 1.128
       return {
           "x": x, "mr": mr, "center": center, "mrbar": mrbar,
           "ucl_x": center + 3 * sigma, "lcl_x": center - 3 * sigma,
           "ucl_mr": 3.267 * mrbar, "lcl_mr": 0.0, "sigma_within": sigma,
       }
   ```
   If subgroups have unequal sizes, the skill keeps the most common size, drops the others, and reports how many it dropped.

4. **Capability.** Use within subgroup sigma for Cp and Cpk, and overall standard deviation for Pp and Ppk. Report both and explain the difference in one sentence.
   ```python
   def capability(values: pd.Series, sigma_within: float, lsl: float, usl: float) -> dict:
       mu, s_all = values.mean(), values.std(ddof=1)
       return {
           "Cp": (usl - lsl) / (6 * sigma_within),
           "Cpk": min(usl - mu, mu - lsl) / (3 * sigma_within),
           "Pp": (usl - lsl) / (6 * s_all),
           "Ppk": min(usl - mu, mu - lsl) / (3 * s_all),
           "mean": mu, "sigma_within": sigma_within, "sigma_overall": s_all,
       }
   ```
   Only report capability when the chart shows no out of control points, or say clearly that the process is not stable and capability is not meaningful yet.

5. **Run rules.** Zones are measured in sigma units from the center line, with sigma = (UCL minus center) / 3.
   ```python
   def rule_hits(x: np.ndarray, c: float, s: float, mode: str = "we") -> list[tuple[int, str]]:
       z = (x - c) / s
       hits = []
       def window(k, test, name):
           for i in range(k - 1, len(z)):
               if test(z[i - k + 1:i + 1]):
                   hits.append((i, name))
       window(1, lambda w: abs(w[0]) > 3, "1: beyond 3 sigma")
       window(3, lambda w: (w > 2).sum() >= 2 or (w < -2).sum() >= 2, "2 of 3 beyond 2 sigma, same side")
       window(5, lambda w: (w > 1).sum() >= 4 or (w < -1).sum() >= 4, "4 of 5 beyond 1 sigma, same side")
       run = 9 if mode == "nelson" else 8
       window(run, lambda w: (w > 0).all() or (w < 0).all(), f"{run} in a row on one side")
       if mode == "nelson":
           window(6, lambda w: (np.diff(w) > 0).all() or (np.diff(w) < 0).all(), "6 in a row trending")
           window(14, lambda w: (np.sign(np.diff(w))[1:] * np.sign(np.diff(w))[:-1] < 0).all(), "14 alternating")
           window(15, lambda w: (abs(w) < 1).all(), "15 within 1 sigma")
           window(8, lambda w: (abs(w) > 1).all() and (w > 0).any() and (w < 0).any(), "8 outside 1 sigma, both sides")
       return hits
   ```
   Report each hit with the point index (1 based), the value, and the rule name. Mark the point where the window ends.

6. **Plot.** Two stacked panels sharing the x axis. Center line solid, limits dashed, spec limits dotted (on the X chart only, and only if within view), rule hits as red markers. Save at 150 dpi.
   ```python
   import matplotlib
   matplotlib.use("Agg")
   import matplotlib.pyplot as plt

   def plot_imr(res, hits, path, title, lsl=None, usl=None):
       fig, (a1, a2) = plt.subplots(2, 1, figsize=(10, 6.5), sharex=True)
       x = res["x"]
       a1.plot(range(1, len(x) + 1), x, marker="o", ms=3, lw=1, color="#3A6EA5")
       for y, st in [(res["center"], "-"), (res["ucl_x"], "--"), (res["lcl_x"], "--")]:
           a1.axhline(y, ls=st, lw=1, color="#555")
       for y in [v for v in (lsl, usl) if v is not None]:
           a1.axhline(y, ls=":", lw=1, color="#B5651D")
       for i, _ in hits:
           a1.plot(i + 1, x[i], "o", color="#C0392B", ms=6)
       a1.set_title(title); a1.set_ylabel("Individual")
       a2.plot(range(1, len(x) + 1), res["mr"], marker="o", ms=3, lw=1, color="#3A6EA5")
       a2.axhline(res["mrbar"], lw=1, color="#555"); a2.axhline(res["ucl_mr"], ls="--", lw=1, color="#555")
       a2.set_ylabel("Moving range"); a2.set_xlabel("Observation")
       fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)
   ```
   The X-bar R plot is the same with subgroup means and ranges.

7. **Write the table** `spc_results.csv` (and `.xlsx` if asked) with: chart type, n, center, UCL, LCL, sigma within, sigma overall, Cp, Cpk, Pp, Ppk, count of rule hits, and a second sheet listing every hit.

8. **Explain.** Two to five plain sentences: stable or not, the main signal, and capability with its meaning. Example: "Cpk is 1.12, below the common 1.33 target, mainly because the mean sits 0.01 mm above target."

## Output format

- `spc_<column>.png`
- `spc_results.csv` or `.xlsx`
- A chat summary with the key numbers in a small table.

## Safety and confirmation rules

- The source data file is opened read only and never changed.
- Never overwrite earlier output without asking; add a timestamp instead.
- Do not remove "outliers" from the data. If the user wants to exclude points, they list them and the reason is written into the results.
- Nothing is sent anywhere.

## Quality checks

- Recompute one limit by hand in the reply (for example UCL = center + A2 times R-bar) so the user can check it.
- Warn when there are fewer than 20 points or subgroups.
- Warn when the data looks non normal (skewness beyond plus or minus 1) because Cpk assumes roughly normal data.
- Check that LSL is less than USL.

## Examples

1. **I-MR:** 50 bore diameters, LSL 24.95, USL 25.05. Center 25.008, UCL 25.041, LCL 24.975. One rule 1 hit at point 37. The skill reports the process as not stable and lists Cp and Cpk with a warning.
2. **X-bar R:** 25 subgroups of 5 fill weights. All within limits; Cpk 1.48. Chart and table saved.
3. **Nelson rules:** a slow drift shows "6 in a row trending" at points 41 to 46 before any point leaves the limits.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Column read as text | Commas as decimal separators. The skill retries with `decimal=","`. |
| Limits look too wide | Data from several machines mixed together. Split by machine. |
| Cpk very high but parts fail | Check that the spec limits and units match the data. |
| Many rule 4 hits on a stable process | The process mean shifted. Recompute limits from the new period only if the shift is explained. |

## Limitations

- Only variables charts (X-bar R, I-MR). No X-bar S, attribute charts, or CUSUM and EWMA in this version.
- Capability assumes roughly normal, stable data.
- Limits are computed from the data given; Phase I versus Phase II handling is up to the user.

## Changelog

- 1.0 (October 2026): First release. X-bar R and I-MR charts, Cp, Cpk, Pp, Ppk, Western Electric and Nelson rules, PNG and table output.
