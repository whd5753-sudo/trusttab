# TrustTab — install-command.ps1 · install-shortcuts.ps1 로 만든 것 지우기
#   실행: powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1
# 저장소 파일 · 블록체인 기록 · oracle/.env 는 건드리지 않는다.

$ErrorActionPreference = 'Stop'
$profilePath = $PROFILE.CurrentUserAllHosts
if (Test-Path $profilePath) {
  $text = [System.IO.File]::ReadAllText($profilePath)
  $pattern = '(?s)\r?\n?' + [regex]::Escape('# >>> trusttab >>>') + '.*?' + [regex]::Escape('# <<< trusttab <<<') + '\r?\n?'
  $new = [regex]::Replace($text, $pattern, "`r`n").Trim()
  if ($new -ne $text.Trim()) {
    [System.IO.File]::WriteAllText($profilePath, $new + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
    Write-Host "  지움: 프로필의 trusttab 명령"
  }
}
$targets = @(
  @('Desktop', 'TrustTab.lnk'),
  @('Desktop', 'TrustTab 개발.lnk'),
  @('Startup', 'TrustTab 오라클.lnk')
)
foreach ($t in $targets) {
  $dir = [Environment]::GetFolderPath($t[0])
  if (-not $dir) { continue }
  $l = Join-Path $dir $t[1]
  if (Test-Path -LiteralPath $l) { Remove-Item -LiteralPath $l; Write-Host "  지움: $l" }
}
Write-Host "완료" -ForegroundColor Green
