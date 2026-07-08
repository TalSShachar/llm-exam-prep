#!/usr/bin/env python3
"""Extract page-marked text from all course PDFs into resources-extracted/text/.

Question-author agents read these text dumps instead of the PDFs; the
`===== PAGE N =====` markers let questions cite real PDF page numbers.
Re-run after adding/updating PDFs in resources/.
"""
import glob
import os

import pypdf

OUT_DIR = "resources-extracted/text"


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    count = 0
    for pattern in ("resources/*.pdf", "resources-extracted/*.pdf"):
        for path in sorted(glob.glob(pattern)):
            name = os.path.splitext(os.path.basename(path))[0]
            out = os.path.join(OUT_DIR, f"{name}.txt")
            reader = pypdf.PdfReader(path)
            parts = []
            for i, page in enumerate(reader.pages):
                text = (page.extract_text() or "").strip()
                parts.append(f"\n===== PAGE {i + 1} =====\n{text}")
            with open(out, "w") as fh:
                fh.write("".join(parts))
            count += 1
            print(f"{name}: {len(reader.pages)} pages")
    print(f"extracted {count} PDFs -> {OUT_DIR}/")


if __name__ == "__main__":
    main()
