# hapgyeok-yuki

합격화학 스터디 사이트: 『합격화학 연습문제 유기편』 350문항 해설과 무기화학 정리 교재를 담았습니다.

- 사이트: https://indosaram.github.io/hapgyeok-yuki/
- 유기 해설: 제31–37장. 장마다 주기율표처럼 칸을 놓고, 칸 하나에 번호·정답·문제 요지를 넣었습니다. 문항마다 상세 해설과 RDKit으로 그린 구조식이 있습니다.
- 赤シート: 정답을 붉은 시트로 가립니다. 풀었음·별표는 브라우저 localStorage에만 저장합니다.
- 무기 교재: 일본어 정리 노트와 「気体の実験的製法」「色」 표를 한국어로 옮긴 10개 단원입니다.
- 암기 카드: 이온·침전의 색, 불꽃반응, 기체의 제법, 단골 함정을 카드로 연습합니다.
- 검색: 해설과 교재 전체를 검색합니다. 「33장 20번」처럼 입력하면 해당 문항으로 바로 이동합니다.

## 구조

```
content/organic/    v2_cache/*.json (문항별 해설 + 구조식 SMILES), chapters/*.md, chapters.json
content/inorganic/  textbook.md (무기화학 한국어 교재 원고)
web/                index.html, app.css, app.js (프레임워크 없는 SPA)
tools/              build_site.py (사이트 빌드), build_v2.py (구조식 SVG 렌더)
docs/               빌드 결과물 (GitHub Pages가 이 폴더를 배포)
```

## 빌드

```sh
# 필요: pandoc, python3 + rdkit, playwright, fonttools, brotli
# Pretendard JP 가변 폰트(OFL)를 tools/font-src/PretendardJPVariable.ttf 에 둔 뒤 실행
python tools/build_site.py
```

빌드할 때 사이트에 실제로 쓰인 글자만 남기도록 폰트를 서브셋합니다(약 400KB). 결과물은 `docs/`에 생기고, push하면 GitHub Pages에 반영됩니다.
