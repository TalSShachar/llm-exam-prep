# MCQ Authoring Guide — "Programming Using LLMs" Exam Prep

Course: **AI Tools for Software Engineering Development** (Dr. Daniel Yellin, Mr. Yuval Belfer).
The final exam is 50 MCQs. Questions must mirror the instructor's in-class quiz style, observed
in quizzes 1–11.

## Observed instructor style (mirror this)

1. **Roughly half the questions are applied scenarios**, not pure definitions:
   - "Your divide-and-conquer strategy for code generation has integration errors. Probably…"
   - "An agent's conversation is approaching the context window limit. Which strategy BEST…"
   - "In your application, the LLM frequently omits some of the JSON fields you requested. One technique you should try is…"
2. **Framework/algorithm specifics matter**: parameters and phases of named methods taught in
   class (MCTS phases, beam search W/B, SEIDR tournament selection, PairCoder roles, APE steps,
   LangChain memory types). If the deck names a framework or paper, its mechanics are fair game.
3. Stems are 1–3 sentences, sometimes with a fill-in-the-blank ("A reasoning model uses ____").
4. Emphasis capitals used sparingly for the discriminating word: "SHORT-TERM", "BEST", "NOT".
5. Distractors are **course-adjacent misconceptions** — each one is something a student who
   half-learned the material would believe. Never joke options, never obviously-wrong throwaways.
6. Explanations (quiz answer slides) teach: state why correct is correct AND why the tempting
   distractor fails.

## Hard rules (validator-enforced)

- Exactly **4 options** (a–d equivalent), exactly one correct (`answer` = index 0–3).
- **Banned**: "All of the above", "None of the above", combo options ("(a) and (b)"), options
  distinguished only by an unmemorable number.
- Negation stems ("Which is NOT…") ≤ 15% of your set; put NOT in caps.
- Options similar in length and grammatical form — the correct answer must not be systematically
  the longest/most detailed.
- Spread the correct `answer` index roughly uniformly across 0–3 (validator rejects >35% on one index).
- Every question independently answerable — never reference "the slide above" or "as shown in class".
- `stem` ≤ 320 chars. `explanation` 1–3 sentences, ≥ 20 chars, teaches the concept (never "b is correct").
- `source.pages` = the actual PDF page range (from the `===== PAGE N =====` markers) containing the fact.
- Difficulty mix per topic ≈ 30% easy / 50% medium / 20% hard.
  - easy = direct definition/recall; medium = apply a concept to a scenario; hard = discriminate
    between close alternatives, multi-step reasoning, or framework internals.
- You may **paraphrase and restructure** in-class quiz questions (tag `kind: "quiz"`) — never copy
  verbatim, and convert combo-option questions into clean 4-option form.
- **Homework-inspired questions must test course concepts, never assignment implementation.**
  No "In HW3…" / "HW1 Part 2…" framing, no assignment scaffold names (node names, function names,
  file names from the starter code), no numbers that only exist in the assignment's example run.
  Recast the scenario as a self-contained, generic situation ("An agent's SQL tool returns an
  error…"). Citing the HW as `source.kind: "homework"` is fine when the concept is exercised there.
- Tags: 1–3 lowercase keyword tags per question.

## Schema (write exactly this shape)

```json
{
  "topic": "t08",
  "title": "Word Embeddings and RAG",
  "questions": [
    {
      "id": "t08-q001",
      "stem": "…",
      "options": ["…", "…", "…", "…"],
      "answer": 2,
      "explanation": "…",
      "source": {
        "file": "2026 topic 8 - Word  embeddings and RAG.pdf",
        "title": "Topic 8 — Word Embeddings and RAG",
        "kind": "lecture",
        "pages": "31-35"
      },
      "difficulty": "medium",
      "tags": ["chunking", "retrieval"]
    }
  ]
}
```

- `id`: sequential `tNN-qNNN` starting at q001, zero-padded, unique.
- `source.kind` ∈ lecture | recitation | quiz | homework | review.
- `source.file` = the exact original PDF filename you were assigned (not the .txt name).
- `source.title` = human-readable "Topic 8 — Word Embeddings and RAG" / "Recitation 8 — RAG" etc.
