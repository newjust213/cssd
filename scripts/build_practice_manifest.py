#!/usr/bin/env python3
"""public/practice/ 를 스캔해 src/data/practice-manifest.json 생성.

구조:
[
  { "group": "기출" | "연습",
    "title": "2011년 1회 E형" | "01 고급필터 수식 (10문제)",
    "files": [{ "name": 파일명, "rel": "practice/이하 경로" }, ...] }
]
파일 정렬: PDF(문제지) 먼저, 그다음 작업파일, 정답파일 마지막.

사용: cssd/ 에서  python3 scripts/build_practice_manifest.py
주의: practice 파일과 매니페스트는 시나공 저작물 기반 — git 미포함.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRACTICE = ROOT / "public" / "practice"
OUT = ROOT / "src" / "data" / "practice-manifest.json"


def sort_key(p: Path):
    name = p.name.lower()
    is_answer = "정답" in p.name
    is_pdf = p.suffix.lower() == ".pdf"
    # 문제 PDF → 작업파일 → 정답
    return (0 if is_pdf and not is_answer else (2 if is_answer else 1), name)


def files_of(d: Path, base: Path):
    out = []
    for f in sorted((x for x in d.rglob("*") if x.is_file()), key=sort_key):
        out.append({"name": f.name, "rel": str(f.relative_to(base)).replace("\\", "/")})
    return out


def session_title(name: str):
    m = re.match(r"(\d{2})년(\d)회(.*)", name)
    if m:
        return f"20{m.group(1)}년 {m.group(2)}회 {m.group(3)}".strip()
    return name


def practice_title(name: str):
    m = re.match(r"유형(\d+)_(.+)", name)
    return f"{m.group(1)} {m.group(2)}" if m else name


def main():
    manifest = []
    for exam_dir in sorted(PRACTICE.glob("기출_*"), reverse=True):
        for session in sorted(p for p in exam_dir.iterdir() if p.is_dir()):
            manifest.append({
                "group": "기출",
                "title": session_title(session.name),
                "files": files_of(session, PRACTICE),
            })
    for t_dir in sorted(PRACTICE.glob("유형*")):
        manifest.append({
            "group": "연습",
            "title": practice_title(t_dir.name),
            "files": files_of(t_dir, PRACTICE),
        })
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), "utf-8")
    n = sum(len(m["files"]) for m in manifest)
    print(f"{len(manifest)}개 세트, {n}개 파일 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
