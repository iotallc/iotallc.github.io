# iotallc.github.io

Static site for IOTA. Plain HTML, CSS, and JavaScript. No build step.

## Files

- `index.html` main page
- `tutorials/index.html` tutorials (IOTA Mobile getting started, Deep Research, memory, IOTA for Windows setup)
- `iota-mobile/privacy.html` IOTA Mobile privacy policy (unchanged copy of the live page; this URL is used by Google Play)
- `iota-tales/index.html` Iota Tales privacy policy (unchanged copy of the live page)
- `404.html` not found page
- `assets/css/site.css` all styles
- `assets/js/config.js` editable values: links and the founder title
- `assets/js/site.js` animations, the interactive tree showcase, and placeholders
- `assets/img/` logo, icons, screenshots, `og-image.png` (1200x627 link preview)
- `assets/fonts/` Geist and Geist Mono (SIL Open Font License)
- `.nojekyll` tells GitHub Pages to serve files as they are

Helper scripts (`tools/apply-config.py`, screenshot and og-image tools) are kept in the local working copy and are not published here.

## Corpus reading speed

The IOTA Orchestration section on the home page includes the corpus reading-speed comparison. The figures are in `index.html`.

## Publishing

Copy these files into the `iotallc/iotallc.github.io` repository, replacing `index.html` and adding the
rest. Keep `iota-mobile/privacy.html` and `iota-tales/index.html` at the same paths so the Play Store
links keep working. Commit and push to the default branch.

## Preview locally

    python3 -m http.server 8000
    # then open http://localhost:8000/

## Palette

Background #000000 to #141414, surfaces #121212 / #1A1A1A, borders #2A2A2A, text #E0E0E0 / #CBCBCB,
muted #9A9A9A / #707070, chrome text gradient in silver tones.
Branch accents: Investment #D4B86A, Enterprise #8EB8D4, Windows #B5A4C9, Mobile #6BCB8E,
Games #E09A8C, Models #7EBBC7, RAG #8FCBB5.
