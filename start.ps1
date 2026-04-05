# ============================================
# VPN Proxy Manager - Start Script (PowerShell)
# ============================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  VPN Proxy Manager" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Activate venv if exists
$venvActivate = "$ScriptDir\backend\venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
}

# Start Backend (use cmd /c for .cmd/.bat shims on Windows)
Write-Host "[Starting] Backend on http://localhost:5000" -ForegroundColor Green
$backend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "cd /d `"$ScriptDir\backend`" && uvicorn app.main:app --reload --port 5000" `
    -PassThru -NoNewWindow

Start-Sleep -Seconds 3

# Start Frontend (npm is a .cmd on Windows, must run via cmd.exe)
Write-Host "[Starting] Frontend on http://localhost:5173" -ForegroundColor Green
$frontend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "cd /d `"$ScriptDir\frontend`" && npm run dev" `
    -PassThru -NoNewWindow

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Both servers are running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor Blue
Write-Host "  Backend:   " -NoNewline; Write-Host "http://localhost:8000" -ForegroundColor Blue
Write-Host "  API Docs:  " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor Blue
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} catch {
    # Wait-Process throws if processes already exited
} finally {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    # Also kill child processes (node, uvicorn, python)
    Get-Process -Name "node", "uvicorn", "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-60) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Green
}
