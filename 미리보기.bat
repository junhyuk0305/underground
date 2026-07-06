@echo off
rem ── 언더그라운드맵 개발 미리보기 (체험/mock 모드) ──
rem 이 파일을 더블클릭하면: 로컬 서버 실행 + 브라우저 자동 오픈
cd /d "%~dp0"
start "" http://localhost:8000/?mock=1
python -m http.server 8000
