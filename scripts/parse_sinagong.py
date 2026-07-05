#!/usr/bin/env python3
"""시나공 컴활 1급 필기 기출 PDF → quiz-bank.json 파서 (+ 문항 그림 PNG 추출).

PDF 구조 전제:
- A4 세로 2단 레이아웃, 문항 1~60 연속 번호
- "제N과목" 헤더로 과목 구분 (1 컴퓨터 일반 / 2 스프레드시트 일반 / 3 데이터베이스 일반)
- 마지막 페이지 "정답" 섹션에 "N.①" 형식 정답표
- 해설 없음 (프리미엄존 자료에만 존재)

사용:
  python3 parse_sinagong.py <pdf_dir> -o quiz-bank.json --figures public/figures

--figures 지정 시 문항에 귀속된 그림 영역을 PNG로 잘라 저장하고
JSON의 "images" 배열에 파일명을 기록한다. 이미 존재하는 PNG는 건너뛴다(재실행 안전).

주의: 생성물은 길벗/시나공 저작물 기반이므로 개인 학습용으로만 사용할 것.
공개 저장소에 커밋하지 말 것 (.gitignore 처리됨).
"""
import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber

CIRCLES = "①②③④"
SUBJECTS = {1: "컴퓨터 일반", 2: "스프레드시트 일반", 3: "데이터베이스 일반"}

RE_QNUM = re.compile(r"^(\d{1,2})\.\s*(.*)")
RE_SUBJECT = re.compile(r"제\s*(\d)\s*과목")
RE_ANSWER = re.compile(r"(\d{1,2})\.\s*([①②③④])")
RE_FOOTER = re.compile(r"^-\s*\d+\s*-$")

PAD = 4          # 그림 crop 여백(pt)
MERGE_GAP = 20   # 같은 페이지에서 세로 간격이 이내면 하나의 그림으로 병합(pt)
RENDER_DPI = 150


def norm(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip()


def extract_items(pdf):
    """2단 컬럼을 읽기 순서로 펼친 시퀀스.

    ("text", str) 또는 ("img", (page_idx, (x0, top, x1, bottom))) 항목의 리스트.
    로고/워터마크처럼 여러 페이지에 같은 크기로 반복되는 장식 이미지와
    높이 20pt 미만의 미세 이미지는 제외한다.
    """
    n_pages = len(pdf.pages)
    size_count = Counter(
        (round(im["width"]), round(im["height"]))
        for p in pdf.pages for im in p.images
    )
    deco = {s for s, c in size_count.items() if c >= max(2, n_pages * 0.7)}

    items = []
    for pi, page in enumerate(pdf.pages):
        w, h = page.width, page.height
        # 주의: page.crop()은 이미지 bbox를 컬럼 경계로 잘라 반환하므로
        # 크기 기반 필터는 반드시 crop 전 원본 이미지에 적용해야 한다.
        figs = []
        for img in page.images:
            size = (round(img["width"]), round(img["height"]))
            if size in deco or img["height"] < 20:
                continue
            # 배너/저작권 박스 등 두 컬럼에 걸치는 전폭 이미지는 문항 그림이 아님
            if img["width"] > w * 0.55:
                continue
            cx = (img["x0"] + img["x1"]) / 2
            bbox = (max(0, img["x0"]), max(0, img["top"]),
                    min(w, img["x1"]), min(h, img["bottom"]))
            figs.append((cx, img["top"], bbox))

        for x0, x1 in ((0, w / 2), (w / 2, w)):
            col = page.crop((x0, 0, x1, h))
            entries = []
            for ln in col.extract_text_lines():
                entries.append((ln["top"], ("text", norm(ln["text"]))))
            for cx, top, bbox in figs:
                if x0 <= cx < x1:
                    entries.append((top, ("img", (pi, bbox))))
            entries.sort(key=lambda t: t[0])
            items.extend(e for _, e in entries)
    return items


def merge_figs(figs):
    """같은 페이지에서 세로로 인접한 그림 bbox들을 병합 (래스터가 조각난 경우 대응)."""
    merged = []
    for pi, (x0, top, x1, bottom) in sorted(figs, key=lambda f: (f[0], f[1][1])):
        if merged:
            mpi, mb = merged[-1]
            if mpi == pi and top - mb[3] < MERGE_GAP:
                merged[-1] = (pi, (min(mb[0], x0), min(mb[1], top),
                                   max(mb[2], x1), max(mb[3], bottom)))
                continue
        merged.append((pi, (x0, top, x1, bottom)))
    return merged


def parse_pdf(pdf_path: Path, exam_id: str, fig_dir: Path | None):
    with pdfplumber.open(pdf_path) as pdf:
        items = extract_items(pdf)

        # 정답 섹션: 마지막 '정답' 단독 라인 이후
        ans_idx = None
        for i in range(len(items) - 1, -1, -1):
            kind, val = items[i]
            if kind == "text" and val.replace(" ", "") in ("정답", "정답및해설"):
                ans_idx = i
                break
        if ans_idx is None:
            raise ValueError(f"{pdf_path.name}: 정답 섹션을 찾지 못함")

        ans_text = " ".join(v for k, v in items[ans_idx + 1:] if k == "text")
        answers = {int(m.group(1)): CIRCLES.index(m.group(2))
                   for m in RE_ANSWER.finditer(ans_text)}

        # 본문: 제1과목 이후 ~ 정답 이전
        body = items[:ans_idx]
        start = next((i for i, (k, v) in enumerate(body)
                      if k == "text" and RE_SUBJECT.search(v)), None)
        if start is None:
            raise ValueError(f"{pdf_path.name}: 과목 헤더를 찾지 못함")

        questions = []
        subject = None
        cur = None  # {n, subject, q:[], choices:[[...]], figs:[]}
        expected = 1
        pending_figs = []  # 보기 4개 완성 후 등장한 그림 → 다음 문항 소속

        def flush():
            nonlocal cur
            if cur:
                questions.append(cur)
                cur = None

        for kind, val in body[start:]:
            if kind == "img":
                if cur and len(cur["choices"]) >= 4:
                    pending_figs.append(val)
                elif cur:
                    cur["figs"].append(val)
                continue
            line = val
            if not line or RE_FOOTER.match(line):
                continue
            msub = RE_SUBJECT.search(line)
            if msub:
                subject = SUBJECTS.get(int(msub.group(1)), f"과목{msub.group(1)}")
                continue

            mq = RE_QNUM.match(line)
            if mq and int(mq.group(1)) == expected:
                flush()
                cur = {"n": expected, "subject": subject, "q": [mq.group(2)],
                       "choices": [], "figs": list(pending_figs)}
                pending_figs = []
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
            qid = f"{exam_id}-{n:02d}"
            choices = [" ".join(c).strip() for c in item["choices"]]
            images = []
            if fig_dir is not None and item["figs"]:
                for k, (pi, bbox) in enumerate(merge_figs(item["figs"])):
                    name = f"{qid}-{k}.png"
                    path = fig_dir / name
                    if not path.exists():
                        page = pdf.pages[pi]
                        x0 = max(0, bbox[0] - PAD)
                        top = max(0, bbox[1] - PAD)
                        x1 = min(page.width, bbox[2] + PAD)
                        bottom = min(page.height, bbox[3] + PAD)
                        page.crop((x0, top, x1, bottom)).to_image(
                            resolution=RENDER_DPI).save(str(path), format="PNG")
                    images.append(name)
            q = {
                "id": qid,
                "subject": item["subject"],
                "question": " ".join(item["q"]).strip(),
                "choices": choices,
                "answer": answers.get(n),
                "explain": "",
                "hasImage": bool(item["figs"]),
                "images": images,
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
    ap.add_argument("--figures", type=Path, default=None,
                    help="문항 그림 PNG 저장 디렉터리 (미지정 시 추출 안 함)")
    ap.add_argument("--only", default=None, help="파일명 필터 (부분 일치)")
    args = ap.parse_args()

    pdfs = sorted(args.pdf_dir.rglob("*.pdf"))
    if args.only:
        pdfs = [p for p in pdfs if args.only in p.name]
    if not pdfs:
        sys.exit("PDF 없음")
    if args.figures:
        args.figures.mkdir(parents=True, exist_ok=True)

    bank, report = [], []
    for pdf in pdfs:
        name = pdf.stem
        my = re.search(r"(20\d{2})", name)
        ms = re.search(r"상시\s*(\d+)", name)
        exam_id = f"s{my.group(1)}-{int(ms.group(1)):02d}" if my and ms else name
        try:
            qs, skipped, n_ans = parse_pdf(pdf, exam_id, args.figures)
        except Exception as e:
            report.append(f"{exam_id}: 실패 — {e}")
            continue
        n_img = sum(q["hasImage"] for q in qs)
        n_png = sum(len(q["images"]) for q in qs)
        bank.extend(qs)
        report.append(
            f"{exam_id}: {len(qs)}문항 (정답표 {n_ans}, 그림문항 {n_img}, PNG {n_png}, 누락 {len(skipped)}"
            + (f" → {skipped}" if skipped else ")")
        )

    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=1), "utf-8")
    print("\n".join(report))
    print(f"\n총 {len(bank)}문항 → {args.output}")


if __name__ == "__main__":
    main()
