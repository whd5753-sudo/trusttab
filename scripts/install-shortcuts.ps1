# TrustTab — 바탕화면 아이콘 만들기 (더블클릭 실행). 선택: 로그인할 때 AI 오라클 자동 실행
#
#   실행:           powershell -ExecutionPolicy Bypass -File scripts\install-shortcuts.ps1
#   자동 실행까지:   powershell -ExecutionPolicy Bypass -File scripts\install-shortcuts.ps1 -Startup
#
#   바탕화면 'TrustTab'      = AI 오라클 + 배포 사이트 (Edge)
#   바탕화면 'TrustTab 개발'  = AI 오라클 + 화면 개발 서버 + http://trusttab.localhost:5173/
#   -Startup                = Windows 에 로그인하면 오라클을 작은 창(최소화)으로 자동으로 켬
#                             (오라클은 내 컴퓨터 안(127.0.0.1)에서만 열리고, 허락한 사이트만 받는다)
# 지우기: scripts\uninstall.ps1

param([switch]$Startup)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $PSScriptRoot 'TrustTab.ico'
$shell = New-Object -ComObject WScript.Shell

function New-TrustTabShortcut([string]$path, [string]$target, [string]$arguments, [string]$description, [int]$style) {
  $s = $shell.CreateShortcut($path)
  $s.TargetPath = $target
  $s.Arguments = $arguments
  $s.WorkingDirectory = $root
  $s.IconLocation = $icon
  $s.Description = $description
  $s.WindowStyle = $style   # 1 = 보통 창, 7 = 최소화
  $s.Save()
  Write-Host "  만듦: $path"
}

$desktop = [Environment]::GetFolderPath('Desktop')
New-TrustTabShortcut (Join-Path $desktop 'TrustTab.lnk') (Join-Path $root 'TrustTab.cmd') '' 'TrustTab: AI 오라클 + 사이트 열기' 1
New-TrustTabShortcut (Join-Path $desktop 'TrustTab 개발.lnk') (Join-Path $root 'TrustTab-dev.cmd') '' 'TrustTab: 오라클 + 화면 개발 서버' 1

if ($Startup) {
  $startupDir = [Environment]::GetFolderPath('Startup')
  New-TrustTabShortcut (Join-Path $startupDir 'TrustTab 오라클.lnk') (Join-Path $root 'TrustTab.cmd') '--oracle-only --no-open' 'TrustTab AI 오라클 (로그인할 때 자동)' 7
  Write-Host "로그인할 때 AI 오라클이 자동으로 켜집니다 (작업 표시줄의 최소화된 창)." -ForegroundColor Yellow
}
Write-Host "완료: 바탕화면에 TrustTab 아이콘을 만들었습니다." -ForegroundColor Green
