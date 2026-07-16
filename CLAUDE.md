# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a personal GitHub Pages site. It is a static website with no build step, package manager, tests, or linting. Each page is a self-contained HTML file with inline or adjacent CSS/JS.

- `README.md` states: "This is my work related Github Pages."
- The repository is published via GitHub Pages from the default branch.

## Repository layout

- `/util/` — standalone browser utilities:
  - `big_clock.html` — large countdown timer.
  - `big_wheel.html` — spinning random-winner wheel with canvas rendering.
  - `jpg-to-png-converter.html` — client-side JPG-to-PNG batch converter using a canvas and JSZip.
- `/tec/` — work-related pages and tools:
  - `pages/leasemanagement/` — static HTML pages for lease management briefings/layouts.
  - `util/imagecoord/` — image coordinate picker that exports to CSV (`index.html`, `scripts.js`, `style.css`).

## Dependencies

Most utilities are dependency-free. Exceptions:

- `util/jpg-to-png-converter.html` loads Tailwind CSS and JSZip from public CDNs.
- `tec/util/imagecoord/index.html` references local `style.css` and `scripts.js`.

## Deployment

Push changes to the default branch (`main`). GitHub Pages publishes the repository contents directly. There is no CI, test suite, or preview build.

## Documentation 
When prompted to create any documentation, it should always do so in the `/docs` directory, with compatibility for Obsidian and Quartz. 