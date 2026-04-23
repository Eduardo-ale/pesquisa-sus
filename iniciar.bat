@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "venv\Scripts\python.exe" (
  echo Crie o ambiente: python -m venv venv
  echo Depois: venv\Scripts\pip install -r requirements.txt
  pause
  exit /b 1
)
"venv\Scripts\python.exe" -m pip install -q -r requirements.txt
echo.
echo Servidor: http://127.0.0.1:8000
echo Aguarde o navegador abrir, ou abra o link acima. Pressione Ctrl+C para encerrar.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8000/"
"venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
