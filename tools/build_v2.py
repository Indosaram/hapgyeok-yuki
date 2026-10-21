#!/usr/bin/env python3
"""v2: v2_cache/*.json (markdown + structures) -> chapters_v2/*.md + 구조식 SVG -> 해설 PDF.
사용법: /tmp/dapji-venv/bin/python scripts/build_v2.py <프로젝트이름> [책 제목]"""
import json, re, subprocess, sys, html
from pathlib import Path
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Chem import rdDepictor
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
bad = []


def svg_for(smiles):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    rdDepictor.SetPreferCoordGen(True)
    rdDepictor.Compute2DCoords(mol)
    n = mol.GetNumHeavyAtoms()
    w = 170 if n <= 8 else 220 if n <= 16 else 280
    d = rdMolDraw2D.MolDraw2DSVG(w, int(w * 0.72))
    o = d.drawOptions()
    o.addStereoAnnotation = False
    o.bondLineWidth = 1.6
    o.fixedBondLength = 26
    o.clearBackground = False
    rdMolDraw2D.PrepareAndDrawMolecule(d, mol)
    d.FinishDrawing()
    s = d.GetDrawingText()
    return s[s.find("<svg"):]


def render(ch, nn, data):
    structs = {s["id"]: s for s in data.get("structures", [])}
    used = set()

    def repl(m):
        ids = [x.strip() for x in m.group(1).split(",") if x.strip()]
        cells = []
        for i in ids:
            s = structs.get(i)
            if not s:
                continue
            svg = svg_for(s["smiles"])
            if svg is None:
                bad.append(f"ch{ch}-{nn} {i} {s['smiles']}")
                continue
            used.add(i)
            cap = html.escape(s["name"]) + "<br><span class='f'>" + re.sub(r"(\d+)", r"<sub>\1</sub>", html.escape(s["formula"])) + "</span>"
            cells.append(f"<figure class='mol'>{svg}<figcaption>{cap}</figcaption></figure>")
        if not cells:
            return ""
        return "\n\n```{=html}\n<div class='mols'>" + "".join(cells) + "</div>\n```\n\n"

    md = re.sub(r"\{\{\s*([A-Za-z0-9_,\s]+?)\s*\}\}", repl, data["markdown"])
    return md.strip() + "\n"


def main():
    name = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else name
    proj = ROOT / "projects" / name
    cache = proj / "v2_cache"
    outdir = proj / "chapters_v2"
    outdir.mkdir(exist_ok=True)
    for old in sorted((proj / "chapters").glob("ch*.md")):
        ch = old.stem[2:]
        text = old.read_text()
        parts = re.split(r"\n(?=## \d{2}  정답)", text)
        head = parts[0].strip()
        body = [head + "\n"]
        for p in parts[1:]:
            nn = p[3:5]
            f = cache / f"ch{ch}_{nn}.json"
            if not f.exists():
                sys.exit(f"missing {f}")
            body.append(render(ch, nn, json.loads(f.read_text())))
        (outdir / old.name).write_text("\n\n".join(body))
    mds = sorted(outdir.glob("ch*.md"))
    html_body = subprocess.run(["pandoc", "-f", "markdown+hard_line_breaks+raw_html+raw_attribute-tex_math_dollars-subscript-superscript", "-t", "html", *map(str, mds)],
                               check=True, capture_output=True, text=True).stdout
    css = (ROOT / "templates" / "style.css").read_text() + """
.mols { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 6px 0 10px; page-break-inside: avoid; }
.mol { margin: 0; text-align: center; border: 1px solid #dde5ef; border-radius: 6px; padding: 4px 6px; background: #fbfdff; }
.mol svg { display: block; margin: 0 auto; }
.mol figcaption { font-size: 8.8pt; color: #1f4e79; line-height: 1.3; }
.mol .f { color: #666; font-size: 8.2pt; }
"""
    doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="cover"><div class="t">{title}</div><div class="s">연습문제 해답 · 상세 해설 (구조식 포함 개정판)</div></div>
<div style="page-break-after:always"></div>{html_body}</body></html>"""
    out_html = proj / "output" / "answers_v2.html"
    out_html.write_text(doc)
    out_pdf = proj / "output" / f"{name}_해설_v2.pdf"
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        pg.goto(out_html.as_uri())
        pg.pdf(path=str(out_pdf), format="A4", print_background=True, display_header_footer=True,
               header_template="<span></span>",
               footer_template='<div style="width:100%;text-align:center;font-size:8px;color:#888"><span class="pageNumber"></span></div>',
               margin={"top": "16mm", "bottom": "16mm", "left": "15mm", "right": "15mm"})
        b.close()
    print(out_pdf)
    print("bad smiles:", len(bad))
    for x in bad:
        print("  ", x)


if __name__ == "__main__":
    main()
