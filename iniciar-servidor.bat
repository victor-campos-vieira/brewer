@echo off
chcp 65001 > nul
echo ===================================================
echo   Iniciando o servidor local do Brewer...
echo   Abrindo o navegador em http://localhost:3000/index.html
echo ===================================================
start "" "http://localhost:3000/index.html"
node tools/servidor.js
pause
