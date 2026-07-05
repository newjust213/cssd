#!/usr/bin/env python3
"""시나공 컴활 1급 필기 기출 PDF → quiz-bank.json 파서.

PDF 구조 전제:
- A4 세로 2단 레이아웃, 문항 1~60 연속 번호
- "제N과목" 헤더로 과목 구분 (1 컴퓨터 일반 / 2 스프레드시트 일반 / 3 데이터베이스 일반)
- 마지막 페이지 "정답" 섹션에 "N.①" 형식 정답표
- 해설 없음 (프리미엄존 자료에만 존재)

사용:
  python3 parse_sinagong.py <pdf_dir> -o quiz-bank.json

주의: 생성물은 길벗/시나공 저작물 기반이므로 개인 학습용으로만 사용할 것.
공개 저장소에 커밋하지 말 것 (.gitignore 처리됨).
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

CIRCLES = "①②③④"
SUBJECTS = {1: "컴퓨터 일반", 2: "스프레드시트 일반", 3: "데이터베이스 일반"}

RE_QNUM = re.compile(r"^(\d{1,2})\.\s*(.*)")
RE_SUBJECT = re.compile(r"제\s*(\d)\s*과목")
RE_ANSWER = re.compile(r"(\d{1,2})\.\s*([①②③④])")
RE_FOOTER = re.compile(r"^-\s*\d+\s*-$")
IMAGE_MARK = "\x00IMG\x00"


def norm(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip()


def extract_lines(pdf_path: Path):
    """페이지별 2단 컬럼을 읽기 순서로 펼친 라인 시퀀스. 이미지 위치는 마커로 삽입.

    로고/워터마크처럼 여러 페이지에 같은 크기로 반복되는 장식 이미지와
    높이 20pt 미만의 미세 이미지는 그림 문항 판정에서 제외한다.
    """
    from collections import Counter

    with pdfplumber.open(pdf_path) as pdf:
        n_pages = len(pdf.pages)
        size_count = Counter(
            (round(im["width"]), round(im["height"]))
            for p in pdf.pages for im in p.images
        )
        deco = {s for s, c in size_count.items() if c >= max(2, n_pages * 0.7)}

        lines = []
        for page in pdf.pages:
            w, h = page.width, page.height
            for x0, x1 in ((0, w / 2), (w / 2, w)):
                col = page.crop((x0, 0, x1, h))
                items = []
                for ln in col.extract_text_lines():
                    items.append((ln["top"], norm(ln["text"])))
                for img in col.images:
                    size = (round(img["width"]), round(img["height"]))
                    if size in deco or img["height"] < 20:
                        continue
                    items.append((img["top"], IMAGE_MARK))
                items.sort(key=lambda t: t[0])
                lines.extend(text for _, text in items)
    return lines


def parse_pdf(pdf_path: Path, exam_id: str):
    lines = extract_lines(pdf_path)

    # 정답 섹션: 마지막 '정답' 단독 라인 이후
    ans_idx = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].replace(" ", "") in ("정답", "정답및해설"):
            ans_idx = i
            break
    if ans_idx is None:
        raise ValueError(f"{pdf_path.name}: 정답 섹션을 찾지 못함")

    answers = {}
    for m in RE_ANSWER.finditer(" ".join(lines[ans_idx + 1:])):
        answers[int(m.group(1))] = CIRCLES.index(m.group(2))

    # 본문: 제1과목 이후 ~ 정답 이전
    body = lines[:ans_idx]
    start = next((i for i, l in enumerate(body) if RE_SUBJECT.search(l)), None)
    if start is None:
        raise ValueError(f"{pdf_path.name}: 과목 헤더를 찾지 못함")

    questions = []
    subject = None
    cur = None  # {n, subject, q:[], choices:[[...]], img}
    expected = 1
    pending_img = False  # 보기 4개 완성 후 등장한 이미지 → 다음 문항 소속

    def flush():
        nonlocal cur
        if cur:
            questions.append(cur)
            cur = None

    for raw in body[start:]:
        line = raw
        if not line or RE_FOOTER.match(line):
            continue
        if line == IMAGE_MARK:
            if cur and len(cur["choices"]) >= 4:
                pending_img = True
            elif cur:
                cur["img"] = True
            continue
        msub = RE_SUBJECT.search(line)
        if msub:
            subject = SUBJECTS.get(int(msub.group(1)), f"과목{msub.group(1)}")
            continue

        mq = RE_QNUM.match(line)
        if mq and int(mq.group(1)) == expected:
            flush()
            cur = {"n": expected, "subject": subject, "q": [mq.group(2)],
                   "choices": [], "img": pending_img}
            pending_img = False
            expected += 1
            continue

        if cur is None:
            continue

        if line[0] in CIRCLES:
            # 한 라인에 보기 여러 개가 붙는 경우 분리 ("① 갑 ② 을")
            parts = re.split(r"(?=[①②③④])", line)
            for p in parts:
                p = p.strip()
                if not p:
                    continue
                if p[0] in CIRCLES:
                    cur["choices"].append([p[1:].strip()])
                elif cur["choices"]:
                    cur["choices"][-1].append(p)
        elif cur["choices"]:
            cur["choices"][-1].append(line)  # 보기 이어지는 줄
        else:
            cur["q"].append(line)  # 문제 지문 이어지는 줄
    flush()

    out, skipped = [], []
    for item in questions:
        n = item["n"]
        choices = [" ".join(c).strip() for c in item["choices"]]
        q = {
            "id": f"{exam_id}-{n:02d}",
            "subject": item["subject"],
            "question": " ".join(item["q"]).strip(),
            "choices": choices,
            "answer": answers.get(n),
            "explain": "",
            "hasImage": item["img"],
            "source": exam_id,
        }
        if len(choices) != 4 or any(not c for c in choices) or q["answer"] is None or not q["question"]:
            skipped.append((n, len(choices), q["answer"] is not None))
        else:
            out.append(q)
    return out, skipped, len(answers)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_dir", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("quiz-bank.json"))
    args = ap.parse_args()

    pdfs = sorted(args.pdf_dir.rglob("*.pdf"))
    if not pdfs:
        sys.exit("PDF 없음")

    bank, report = [], []
    for pdf in pdfs:
        name = pdf.stem
        my = re.search(r"(20\d{2})", name)
        ms = re.search(r"상시\s*(\d+)", name)
        exam_id = f"s{my.group(1)}-{int(ms.group(1)):02d}" if my and ms else name
        try:
            qs, skipped, n_ans = parse_pdf(pdf, exam_id)
        except Exception as e:
            report.append(f"{exam_id}: 실패 — {e}")
            continue
        n_img = sum(q["hasImage"] for q in qs)
        bank.extend(qs)
        report.append(
            f"{exam_id}: {len(qs)}문항 (정답표 {n_ans}, 그림 {n_img}, 누락 {len(skipped)}"
            + (f" → {skipped}" if skipped else ")")
        )

    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=1), "utf-8")
    print("\n".join(report))
    print(f"\n총 {len(bank)}문항 → {args.output}")


if __name__ == "__main__":
    main()
