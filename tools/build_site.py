#!/usr/bin/env python3
"""답지제작 웹사이트 빌드: 유기편 해설(v2_cache) + 무기화학 교재(textbook.md) -> 정적 사이트.
사용법: python tools/build_site.py [PretendardJPVariable.ttf 경로]
필요: pandoc, rdkit, fonttools, brotli (build_v2.py가 playwright도 import)"""
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v2 as b  # render(): 구조식 SVG 인라인

ROOT = Path(__file__).resolve().parent.parent
if (ROOT / "content").exists():  # hapgyeok-yuki 레포 구조
    SITE, SRC, DIST = ROOT / "tools", ROOT / "web", ROOT / "docs"
    ORG, INO = ROOT / "content" / "organic", ROOT / "content" / "inorganic"
else:  # ~/Documents/답지제작 작업 폴더 구조
    SITE = ROOT / "site"
    SRC, DIST = SITE / "src", SITE / "dist"
    ORG, INO = ROOT / "projects" / "합격화학_유기편", ROOT / "projects" / "무기화학_정리본"
FONT = Path(sys.argv[1]) if len(sys.argv) > 1 else SITE / "font-src" / "PretendardJPVariable.ttf"

BANDS = {31: "#c8102e", 32: "#0b5cad", 33: "#0f7a3d", 34: "#d4621a", 35: "#6a2c91", 36: "#8a5a17", 37: "#00727c"}
INO_BAND = "#3b4a56"
FROM = "markdown+hard_line_breaks+raw_html+raw_attribute-tex_math_dollars-subscript-superscript"
SECS = {"문제 요지": "gist", "핵심 개념": "core", "풀이": "solve", "선지별 해설": "opts", "포인트": "point", "구조식으로 보기": "mols"}


def md2html(md):
    # 원문은 목록 앞 빈 줄이 없는 곳이 많아 pandoc이 "- "를 글자로 남긴다 -> 목록 시작 앞에 빈 줄을 넣는다.
    out, prev = [], ""
    for line in md.split("\n"):
        is_item = re.match(r"\s*(?:[-*] |\d+\. )", line)
        prev_item = re.match(r"\s*(?:[-*] |\d+\. )", prev) or (prev.startswith("  ") and out and out[-1] != "")
        if is_item and prev.strip() and not prev_item and not prev.lstrip().startswith(("|", ">")):
            out.append("")
        out.append(line)
        prev = line
    md = "\n".join(out)
    return subprocess.run(["pandoc", "-f", FROM, "-t", "html", "--wrap=none"], input=md, check=True,
                          capture_output=True, text=True).stdout


def decorate(h):
    def sec(m):
        name, closed = m.group(1), m.group(2)
        out = f'<h3 class="sec sec-{SECS[name]}">{name}</h3>'
        return out if closed else out + "<p>"

    h = re.sub(r"<p><strong>(" + "|".join(SECS) + r")</strong>\s*[:：]?\s*(</p>)?(?:\s*<br\s*/?>)?", sec, h)
    h = re.sub(r"<p>\s*</p>", "", h)
    h = re.sub(r"<li>((?:<p>)?\s*[①-⑳][^<]{0,60}?\(정답\))", r'<li class="opt-ok">\1', h)
    h = re.sub(r"<blockquote>\s*<p>⚠", '<blockquote class="warn"><p>⚠', h)
    h = re.sub(r"<table>", '<div class="tbl"><table>', h)
    h = re.sub(r"</table>", "</table></div>", h)
    return h


def plain(h):
    t = re.sub(r"<svg.*?</svg>", " ", h, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def organic():
    chapters = json.loads((ORG / "chapters.json").read_text())
    jobs = []
    for c in chapters:
        ch = str(c["no"])
        for f in sorted((ORG / "v2_cache").glob(f"ch{ch}_*.json")):
            jobs.append((c, ch, f.stem.split("_")[1], json.loads(f.read_text())))

    def one(job):
        c, ch, nn, data = job
        head = data["markdown"].split("\n", 1)[0]
        m = re.match(r"## (\d{2})\s+정답\s+(.+)", head)
        assert m and m.group(1) == nn, (ch, nn, head)
        md = b.render(ch, nn, data).split("\n", 1)[1]
        g = re.search(r"\*\*문제 요지\*\*\s*[:：]\s*(.+)", data["markdown"])
        gist = re.sub(r"\*\*|`", "", g.group(1)).strip() if g else ""
        body = decorate(md2html(md))
        return ch, nn, m.group(2).strip(), gist, body

    with ThreadPoolExecutor(12) as ex:
        rows = list(ex.map(one, jobs))
    index, search = [], []
    for c in chapters:
        ch = str(c["no"])
        mine = [r for r in rows if r[0] == ch]
        (DIST / "data" / f"o{ch}.json").write_text(json.dumps({r[1]: r[4] for r in mine}, ensure_ascii=False))
        index.append({"no": c["no"], "title": c["title"], "band": BANDS[c["no"]],
                      "problems": [{"n": r[1], "a": r[2], "g": r[3][:140]} for r in mine]})
        for r in mine:
            search.append({"k": f"o/{ch}/{r[1]}", "t": f"{ch}장 {r[1]}번 · 정답 {r[2]}", "s": c["title"], "x": plain(r[4])})
    return index, search, len(rows)


def inorganic():
    text = (INO / "textbook.md").read_text()
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    parts = re.split(r"^(?=# )", text, flags=re.M)
    if parts and not parts[0].lstrip().startswith("# "):
        parts = parts[1:]  # 머리말은 사이트 소개글이 대신한다
    index, data, search = [], {}, []
    for p in parts:
        if not p.strip():
            continue
        head, body = p.split("\n", 1)
        m = re.match(r"# (\d+) (.+?) \{#([a-z]+)\}", head)
        assert m, head
        no, title, sid = int(m.group(1)), m.group(2), m.group(3)
        h = decorate(md2html(body))
        h = re.sub(r"<blockquote>\s*<p>원본 오타", '<blockquote class="erratum"><p>원본 오타', h)
        h = h.replace("<blockquote>", '<blockquote class="tip">')
        data[sid] = h
        lead = plain(md2html(body.strip().split("\n\n", 1)[0]))
        index.append({"id": sid, "no": no, "title": title, "lead": lead[:120]})
        search.append({"k": f"i/{sid}", "t": f"무기 {no}. {title}", "s": "무기화학 교재", "x": plain(h)})
    (DIST / "data" / "inorg.json").write_text(json.dumps(data, ensure_ascii=False))
    return index, search


C = {"淡緑色": ("연녹색", "#a9d18e"), "黄褐色": ("황갈색", "#b8862b"), "青色": ("청색", "#2f6fd6"), "緑色": ("녹색", "#3c9a4a"),
     "黄色": ("노랑", "#f2c94c"), "橙赤色": ("등적색", "#e8622c"), "赤紫色": ("적자색", "#a0277a"), "深青色": ("짙은 청색", "#1f3a93"),
     "白色": ("흰색", "#ffffff"), "淡黄色": ("연노랑", "#f4e7a1"), "黒色": ("검정", "#1a1a1a"), "赤色": ("빨강", "#c62828"),
     "褐色": ("갈색", "#6d4c2f"), "赤褐色": ("적갈색", "#8b3a1e"), "緑白色": ("녹백색", "#d9ead3"), "青白色": ("청백색", "#cfe3f3"),
     "灰緑色": ("회녹색", "#7d8f74"), "淡桃色": ("연분홍", "#f6c9d0")}
COLORS = [("Fe²⁺", "淡緑色"), ("Fe³⁺", "黄褐色"), ("Cu²⁺", "青色"), ("Cr³⁺", "緑色"), ("Ni²⁺", "緑色"), ("CrO₄²⁻", "黄色"),
          ("Cr₂O₇²⁻", "橙赤色"), ("MnO₄⁻", "赤紫色"), ("[Cu(NH₃)₄]²⁺", "深青色"), ("AgCl", "白色"), ("PbCl₂", "白色"),
          ("Hg₂Cl₂", "白色"), ("AgBr", "淡黄色"), ("AgI", "黄色"), ("CaSO₄", "白色"), ("SrSO₄", "白色"), ("BaSO₄", "白色"),
          ("PbSO₄", "白色"), ("탄산염(일반)", "白色"), ("CuO", "黒色"), ("Cu₂O", "赤色"), ("Ag₂O", "褐色"), ("MnO₂", "黒色"),
          ("FeO", "黒色"), ("Fe₃O₄", "黒色"), ("Fe₂O₃", "赤褐色"), ("ZnO", "白色"), ("수산화물(일반)", "白色"),
          ("Fe(OH)₂", "緑白色"), ("Fe(OH)₃", "赤褐色"), ("Cu(OH)₂", "青白色"), ("Cr(OH)₃", "灰緑色"), ("BaCrO₄", "黄色"),
          ("PbCrO₄", "黄色"), ("Ag₂CrO₄", "赤褐色"), ("황화물(일반)", "黒色"), ("ZnS", "白色"), ("CdS", "黄色"), ("MnS", "淡桃色")]
FLAME = [("Li⁺", "赤", "빨강", "#d32f2f"), ("Na⁺", "黄", "노랑", "#f5c518"), ("K⁺", "赤紫", "적자색", "#9c3f9a"),
         ("Cu²⁺", "青緑", "청록", "#1f9e8f"), ("Ca²⁺", "橙赤", "등적색", "#ef6c2a"), ("Sr²⁺", "深赤", "짙은 빨강", "#b0102a"),
         ("Ba²⁺", "黄緑", "황록", "#a6c93a")]
GAS = [("아연 + 묽은 황산", "H₂", "Zn + H₂SO₄ → ZnSO₄ + H₂↑", "금속 홑원소물질 + 산"),
       ("과산화수소 + MnO₂(촉매)", "O₂", "2H₂O₂ → 2H₂O + O₂↑", "분해반응"),
       ("염소산칼륨 + MnO₂(촉매), 가열", "O₂", "2KClO₃ → 2KCl + 3O₂↑", "분해반응"),
       ("산소 속 무성방전", "O₃", "3O₂ → 2O₃", "무성방전 · 자외선"),
       ("아질산암모늄 가열", "N₂", "NH₄NO₂ → N₂↑ + 2H₂O", "분해반응"),
       ("MnO₂ + 진한 염산, 가열", "Cl₂", "MnO₂ + 4HCl → MnCl₂ + 2H₂O + Cl₂↑", "산화환원"),
       ("표백분 + 묽은 염산", "Cl₂", "CaCl(ClO)·H₂O + 2HCl → CaCl₂ + 2H₂O + Cl₂↑", "산화환원"),
       ("형석 CaF₂ + 진한 황산, 가열", "HF", "CaF₂ + H₂SO₄ → CaSO₄ + 2HF↑", "휘발성 산의 유리"),
       ("NaCl + 진한 황산, 가열", "HCl", "NaCl + H₂SO₄ → NaHSO₄ + HCl↑", "휘발성 산의 유리"),
       ("폼산 + 진한 황산, 가열", "CO", "HCOOH → H₂O + CO↑", "탈수작용"),
       ("석회석 + 묽은 염산", "CO₂", "CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑", "약산의 유리"),
       ("NH₄Cl + Ca(OH)₂, 가열", "NH₃", "2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2H₂O + 2NH₃↑", "약염기의 유리"),
       ("구리 + 묽은 질산", "NO", "3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 4H₂O + 2NO↑", "산화환원"),
       ("구리 + 진한 질산", "NO₂", "Cu + 4HNO₃ → Cu(NO₃)₂ + 2H₂O + 2NO₂↑", "산화환원"),
       ("황화철(II) + 묽은 황산", "H₂S", "FeS + H₂SO₄ → FeSO₄ + H₂S↑", "약산의 유리"),
       ("구리 + 진한 황산, 가열", "SO₂", "Cu + 2H₂SO₄ → CuSO₄ + 2H₂O + SO₂↑", "산화작용"),
       ("아황산수소나트륨 + 묽은 황산", "SO₂", "2NaHSO₃ + H₂SO₄ → Na₂SO₄ + 2H₂O + 2SO₂↑", "약산의 유리")]
TRAP = [("NH₃를 말릴 수 있는 건조제는?", "소다석회 (CaCl₂는 CaCl₂·8NH₃를 만들어 안 됨)"),
        ("진한 황산으로 말리면 안 되는 기체 2개", "NH₃ (중화), H₂S (산화됨)"),
        ("상방치환으로 모으는 기체", "NH₃ (물에 잘 녹고 공기보다 가벼움)"),
        ("수상치환으로 모으는 기체", "H₂, O₂, N₂, NO, CO"),
        ("유일한 염기성 기체", "NH₃"),
        ("썩은 달걀 냄새가 나는 기체", "H₂S"),
        ("황록색 기체", "Cl₂"),
        ("적갈색 기체", "NO₂"),
        ("석회수를 뿌옇게 만드는 기체", "CO₂"),
        ("공기에 닿으면 적갈색이 되는 기체", "NO (2NO + O₂ → 2NO₂)"),
        ("KI 녹말종이를 청자색으로 바꾸는 기체", "O₃ (Cl₂도 같은 변화를 보임)"),
        ("NH₃와 만나 흰 연기를 내는 기체", "HCl (NH₄Cl 생성)"),
        ("부동태가 되는 금속 3개", "Al, Fe, Ni (진한 질산·뜨거운 진한 황산)"),
        ("양쪽성 금속 4개", "Al, Zn, Sn, Pb"),
        ("Zn²⁺ 착이온(배위수 4)의 모양", "정사면체형"),
        ("Cu²⁺ 착이온(배위수 4)의 모양", "정사각형"),
        ("왕수의 부피비", "진한 질산 : 진한 염산 = 1 : 3"),
        ("SO₂ → SO₃ 촉매 (접촉법)", "V₂O₅"),
        ("NH₃ → NO 촉매 (오스트발트법)", "Pt"),
        ("구리 전해정련에서 순동을 얻는 전극", "음극")]


def decks():
    return {
        "color": {"title": "이온·침전의 색", "hint": "무슨 색일까요?", "cards": [
            {"q": f, "a": C[c][0], "s": c, "sw": C[c][1]} for f, c in COLORS]},
        "flame": {"title": "불꽃반응", "hint": "불꽃 색은?", "cards": [
            {"q": f, "a": k, "s": j + "色", "sw": sw} for f, j, k, sw in FLAME]},
        "gas": {"title": "기체의 제법", "hint": "어떤 기체가 나올까요?", "cards": [
            {"q": q, "a": g, "s": eq, "n": why} for q, g, eq, why in GAS]},
        "trap": {"title": "단골 함정 20", "hint": "답은?", "cards": [{"q": q, "a": a} for q, a in TRAP]},
    }


def subset_font(chars):
    from fontTools import subset
    (DIST / "fonts").mkdir(parents=True, exist_ok=True)
    tf = SITE / ".font-chars.txt"
    tf.write_text("".join(sorted(chars)))
    subset.main([str(FONT), f"--text-file={tf}", "--flavor=woff2", "--layout-features=*",
                 f"--output-file={DIST / 'fonts' / 'pjp.woff2'}"])
    tf.unlink()


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "data").mkdir(parents=True)
    org, s1, n = organic()
    ino, s2 = inorganic()
    dk = decks()
    (DIST / "data" / "index.json").write_text(json.dumps({
        "organic": org, "inorganic": ino, "band": INO_BAND,
        "decks": [{"id": k, "title": v["title"], "count": len(v["cards"])} for k, v in dk.items()]}, ensure_ascii=False))
    (DIST / "data" / "decks.json").write_text(json.dumps(dk, ensure_ascii=False))
    (DIST / "data" / "search.json").write_text(json.dumps(s1 + s2, ensure_ascii=False))
    for f in SRC.iterdir():
        shutil.copy(f, DIST / f.name)
    v = hashlib.sha1(b"".join((SRC / x).read_bytes() for x in ("app.js", "app.css"))).hexdigest()[:8]
    idx = DIST / "index.html"
    idx.write_text(idx.read_text().replace("__V__", v))
    (DIST / ".nojekyll").write_text("")
    chars = set(chr(i) for i in range(0x20, 0x7f)) | set("·–—…“”‘’→←↑↓⇄≥≤×①②③④⑤⑥⑦⑧⑨")
    for f in DIST.rglob("*"):
        if f.suffix in (".json", ".html", ".js", ".css"):
            chars |= set(f.read_text())
    subset_font(chars)
    print(f"{DIST}  problems={n}  inorganic={len(ino)}  decks={len(dk)}  bad smiles={len(b.bad)}")
    for x in b.bad:
        print("  ", x)


if __name__ == "__main__":
    main()
