# LLM Exam Prep 🔥

A streak-based quiz game for the **Programming Using LLMs** course final — ~500
multiple-choice questions authored from the full course material (12 lecture decks,
10 recitations, 11 in-class quizzes, 4 homeworks). Every wrong answer points you to
the exact lecture/recitation and page range to study.

## Modes

- **Streak** — endless questions; a wrong answer shows the explanation + source and
  resets your flame. Best streak is saved locally. Optional per-question countdown.
- **Exam simulation** — 50 questions stratified across all topics with a 60-minute
  clock (both configurable), scored at the end with per-topic breakdown and a
  review of every mistake.
- **Topic filter** — practice only the topics you choose.
- **Stats** — accuracy per topic, weakest-topic callout, exam history.

Works on desktop and mobile, light and dark theme, keyboard shortcuts (A–D / 1–4,
Enter for next).

## Run locally

The app fetches its question bank, so it needs a static server (not `file://`):

```bash
python3 -m http.server -d site 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create an empty repository on github.com (e.g. `llm-exam-prep`), no README.
2. ```bash
   git remote add origin git@github.com:<YOUR-USER>/llm-exam-prep.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: "GitHub Actions"**.
4. The included workflow (`.github/workflows/pages.yml`) validates the question
   bank and deploys `site/` on every push to `main`. The site appears at
   `https://<YOUR-USER>.github.io/llm-exam-prep/`.

## Repo layout

```
site/                 the deployed static app (vanilla JS, no build step)
  data/questions/     one JSON file per course topic (t00, t02..t12)
  data/manifest.json  generated topic index — do not hand-edit
tools/
  validate.mjs        question-bank validator (runs in CI as a deploy gate)
  build-manifest.mjs  regenerates manifest.json from the question files
  extract-text.py     PDF → page-marked text dumps for question authoring
  authoring-guide.md  MCQ style guide used to author the bank
resources/            course PDFs (gitignored — course material stays local)
```

## Updating the question bank

Edit or add questions in `site/data/questions/tNN.json`, then:

```bash
node tools/validate.mjs      # must pass
node tools/build-manifest.mjs
```

Question schema and style rules: `tools/authoring-guide.md`.
