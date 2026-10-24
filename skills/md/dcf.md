---
name: DCF Model Builder
command: /dcf
version: "1.0"
category: Finance
editions: both
editions_reason: "Works in both editions. You type or paste the inputs, local Python computes the model and writes an Excel file with live formulas. No market data is fetched, so it runs offline."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty. Not investment advice."
homepage: https://iotallc.github.io/skills/
---

# /dcf: DCF Model Builder

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

Not investment advice. A DCF shows what a set of assumptions implies. Different assumptions give very different answers.

## Purpose

Build a discounted cash flow (DCF) model as an Excel workbook with every assumption on one sheet, a WACC calculation, a five to ten year free cash flow forecast, a terminal value (Gordon growth or exit multiple), the bridge from enterprise value to equity value per share, and a sensitivity table. All cells are formulas so you can change inputs in Excel.

## When to use

- You want a transparent valuation model you can audit and edit.
- Teaching or learning how a DCF works.
- Checking what growth or margin a current price implies.

## When not to use

- Banks, insurers, and other financials where free cash flow is not meaningful. Use dividend or residual income models.
- Early stage companies with no path to positive cash flow inside the forecast period.
- As a recommendation to buy or sell. The skill produces a model, not advice.

## Requirements

- Python 3.10 or later with `openpyxl`.
- Inputs from you: recent revenue, margins, capital spending, and so on. The skill does not download market data. It can read numbers from a /sec-diff download or a CSV you provide.
- Model: any Gemma 3 size or a Nemotron model. The math is in Excel formulas written by code; the model only collects inputs and explains results.

## Inputs

| Input | Example | Notes |
|---|---|---|
| Company, currency, units | Example Co, USD, millions | |
| Base year revenue | 1,200 | last full year |
| Revenue growth by year | 8%, 7%, 6%, 5%, 4% | one per forecast year |
| EBIT margin by year | 18% flat | |
| Tax rate | 21% | |
| D&A, capex, change in NWC | 4%, 5%, 1% of revenue | or by year |
| Risk free rate | 4.2% | |
| Equity risk premium | 5.0% | |
| Beta | 1.1 | |
| Pre tax cost of debt | 5.5% | |
| Market value of equity and debt | 9,000 and 1,500 | for WACC weights |
| Terminal method | growth 2.5% or EV/EBITDA 10x | |
| Cash, debt, shares | 400, 1,500, 150 | for the equity bridge |
| Mid year convention | yes or no (default no) | |

## Step-by-step procedure

1. **Collect inputs** in the order above. Repeat them back in a table and ask the user to confirm units (thousands versus millions is the most common mistake).

2. **Sanity check before building.** Warn, but do not block, when:
   - Terminal growth is at or above the risk free rate, or above 4 percent.
   - WACC minus terminal growth is under 2 percentage points (the terminal value becomes very sensitive).
   - Any margin is above 60 percent or negative in the final year.

3. **Formulas used.**
   - Cost of equity (CAPM): `Ke = Rf + Beta * ERP`
   - After tax cost of debt: `Kd_at = Kd * (1 - t)`
   - WACC: `E/(D+E) * Ke + D/(D+E) * Kd_at`
   - Unlevered free cash flow: `FCF = EBIT * (1 - t) + D&A - Capex - change in NWC`
   - Discount factor year n: `1 / (1 + WACC)^n`, or `^(n - 0.5)` with the mid year convention
   - Gordon terminal value: `TV = FCF_N * (1 + g) / (WACC - g)`
   - Exit multiple terminal value: `TV = EBITDA_N * multiple`
   - Enterprise value: sum of discounted FCF + `TV / (1 + WACC)^N`
   - Equity value: `EV - debt + cash`; per share: `equity / shares`

   With the mid year convention, the terminal value is still discounted at `N` (end of year) for the Gordon method in this skill, and the skill states that choice in the Notes sheet.

4. **Build the workbook.**
   ```python
   from openpyxl import Workbook
   from openpyxl.styles import Font, PatternFill
   from openpyxl.utils import get_column_letter as col

   BLUE = Font(color="1F4E9E")              # inputs in blue, formulas in black

   def build(inp: dict, path: str):
       wb = Workbook()
       a = wb.active; a.title = "Assumptions"
       rows = [
           ("Company", inp["company"]), ("Units", inp["units"]),
           ("Base revenue", inp["revenue0"]), ("Tax rate", inp["tax"]),
           ("D&A % revenue", inp["da"]), ("Capex % revenue", inp["capex"]),
           ("Change in NWC % revenue", inp["nwc"]),
           ("Risk free rate", inp["rf"]), ("Equity risk premium", inp["erp"]), ("Beta", inp["beta"]),
           ("Pre tax cost of debt", inp["kd"]), ("Equity value (market)", inp["E"]), ("Debt (market)", inp["D"]),
           ("Terminal growth", inp["g"]), ("Exit EV/EBITDA", inp.get("multiple", 10)),
           ("Use exit multiple (1 = yes)", 1 if inp.get("method") == "multiple" else 0),
           ("Mid year (1 = yes)", 1 if inp.get("midyear") else 0),
           ("Cash", inp["cash"]), ("Debt for bridge", inp["debt"]), ("Shares", inp["shares"]),
       ]
       name = {}
       for i, (k, v) in enumerate(rows, start=1):
           a.cell(i, 1, k); c = a.cell(i, 2, v); c.font = BLUE
           name[k] = f"Assumptions!$B${i}"
       r0 = len(rows) + 2
       a.cell(r0, 1, "Year"); a.cell(r0 + 1, 1, "Revenue growth"); a.cell(r0 + 2, 1, "EBIT margin")
       N = len(inp["growth"])
       for n in range(N):
           a.cell(r0, 2 + n, n + 1)
           a.cell(r0 + 1, 2 + n, inp["growth"][n]).font = BLUE
           a.cell(r0 + 2, 2 + n, inp["margin"][n]).font = BLUE
       ke = f"({name['Risk free rate']}+{name['Beta']}*{name['Equity risk premium']})"
       kd = f"({name['Pre tax cost of debt']}*(1-{name['Tax rate']}))"
       E, D = name["Equity value (market)"], name["Debt (market)"]
       a.cell(r0 + 4, 1, "Cost of equity"); a.cell(r0 + 4, 2, f"={ke}")
       a.cell(r0 + 5, 1, "After tax cost of debt"); a.cell(r0 + 5, 2, f"={kd}")
       a.cell(r0 + 6, 1, "WACC"); a.cell(r0 + 6, 2, f"={E}/({E}+{D})*{ke}+{D}/({E}+{D})*{kd}")
       wacc = f"Assumptions!$B${r0 + 6}"

       f = wb.create_sheet("DCF")
       labels = ["Year", "Revenue", "EBIT", "NOPAT", "D&A", "Capex", "Change in NWC", "FCF",
                 "Discount period", "Discount factor", "PV of FCF"]
       for i, l in enumerate(labels, start=1):
           f.cell(i, 1, l)
       for n in range(N):
           c = col(2 + n); prev = "Assumptions!$B$3" if n == 0 else f"{col(1 + n)}2"
           g = f"Assumptions!{col(2 + n)}${r0 + 1}"; m = f"Assumptions!{col(2 + n)}${r0 + 2}"
           f[f"{c}1"] = n + 1
           f[f"{c}2"] = f"={prev}*(1+{g})"
           f[f"{c}3"] = f"={c}2*{m}"
           f[f"{c}4"] = f"={c}3*(1-{name['Tax rate']})"
           f[f"{c}5"] = f"={c}2*{name['D&A % revenue']}"
           f[f"{c}6"] = f"={c}2*{name['Capex % revenue']}"
           f[f"{c}7"] = f"={c}2*{name['Change in NWC % revenue']}"
           f[f"{c}8"] = f"={c}4+{c}5-{c}6-{c}7"
           f[f"{c}9"] = f"={c}1-0.5*{name['Mid year (1 = yes)']}"
           f[f"{c}10"] = f"=1/(1+{wacc})^{c}9"
           f[f"{c}11"] = f"={c}8*{c}10"
       last = col(1 + N)
       gordon = f"{last}8*(1+{name['Terminal growth']})/({wacc}-{name['Terminal growth']})"
       exitv = f"({last}3+{last}5)*{name['Exit EV/EBITDA']}"
       out = [
           ("Terminal value", f"=IF({name['Use exit multiple (1 = yes)']}=1,{exitv},{gordon})"),
           ("PV of terminal value", f"=B13/(1+{wacc})^{last}1"),
           ("Sum of PV of FCF", f"=SUM(B11:{last}11)"),
           ("Enterprise value", "=B14+B15"),
           ("Less debt", f"={name['Debt for bridge']}"),
           ("Plus cash", f"={name['Cash']}"),
           ("Equity value", "=B16-B17+B18"),
           ("Value per share", f"=B19/{name['Shares']}"),
           ("Terminal value share of EV", "=B14/B16"),
       ]
       for i, (k, v) in enumerate(out, start=13):
           f.cell(i, 1, k); f.cell(i, 2, v)
       notes = wb.create_sheet("Notes")
       notes["A1"] = "Not investment advice. Built with the /dcf skill guide by IOTA - Joseph Bryant."
       notes["A2"] = "Blue cells on Assumptions are inputs. All other cells are formulas."
       wb.save(path)
   ```

5. **Sensitivity table.** On a `Sensitivity` sheet, show value per share for WACC from minus 2 to plus 2 points in 0.5 steps (rows) against terminal growth from 1.5 to 3.5 percent (columns). Because openpyxl cannot create Excel Data Tables, the skill computes each cell with Python using the same formulas, writes values, and labels the sheet "values computed at build time; rebuild after changing inputs". It also checks that the center cell equals the DCF sheet result within 0.01.

6. **Explain the result.** Show EV, equity value, value per share, the terminal value share of EV, and the two inputs that move the result most (from the sensitivity table). If the terminal value is more than 75 percent of EV, say so plainly.

## Output format

- `DCF_<company>_<date>.xlsx` with sheets Assumptions, DCF, Sensitivity, Notes.
- A chat table: WACC, EV, equity value, per share value, terminal share of EV, plus "Not investment advice."

## Safety and confirmation rules

- Not investment advice; this line appears in the workbook and the chat summary.
- Inputs are confirmed before building. The skill never makes up a company's financial numbers; missing inputs are asked for.
- Never overwrite an existing workbook; save a new dated file.
- Nothing is sent or shared.

## Quality checks

- Recompute value per share in Python and compare with the workbook formulas (after a LibreOffice headless recalculation if available, else by evaluating the same formulas in Python).
- WACC greater than terminal growth, or the build stops with an explanation.
- Units consistent across revenue, cash, debt, and shares.
- FCF signs: capex and NWC increases reduce FCF.

## Examples

1. Example Co, revenue 1,200, growth 8 to 4 percent, margin 18 percent, WACC about 8.6 percent, g 2.5 percent. The workbook shows EV, equity value, and per share value, with the terminal value about two thirds of EV.
2. Same inputs with an exit multiple of 10x EBITDA. The skill shows both methods side by side and the implied perpetual growth of the multiple.
3. Reverse check: the user gives a share price; the skill searches growth rates in the sensitivity grid that match it and reports the implied growth.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `#DIV/0!` in terminal value | WACC equals terminal growth. Change one. |
| Value per share wildly off | Units mismatch, usually shares in millions and cash in thousands. |
| Formulas show as text | The cell started with a space. The skill writes formulas beginning with `=`. |
| Sensitivity center does not match | Inputs changed after build. Rebuild. |

## Limitations

- Single scenario per workbook (add copies for bull and bear cases).
- No automatic market data, beta estimation, or peer multiples.
- Simplified bridge: no minority interest, leases, or pensions unless added by hand.
- Not investment advice.

## Changelog

- 1.0 (October 2026): First release. Assumption sheet, CAPM WACC, FCF forecast, Gordon and exit multiple, equity bridge, sensitivity grid.
