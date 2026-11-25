# TrustTab — PowerShell 어디서나 'trusttab' 명령을 쓸 수 있게 한다 (한 번만 실행)
#
#   실행:  저장소 폴더에서  powershell -ExecutionPolicy Bypass -File scripts\install-command.ps1
#   그다음 새 터미널에서:
#     trusttab            AI 오라클 + 배포 사이트 열기
#     trusttab dev        AI 오라클 + 화면 개발 서버 + http://trusttab.localhost:5173/
#     trusttab oracle     AI 오라클만
#     trusttab --help     도움말
#
# 하는 일: PowerShell 프로필(모든 PowerShell · VS Code 터미널 공통) 끝에 아래 세 줄을 넣는다.
#   # >>> trusttab >>>
#   function trusttab { node "<이 저장소>\start.mjs" @args }
#   # <<< trusttab <<<
# 지우기: scripts\uninstall.ps1  (또는 프로필에서 위 세 줄을 직접 지움)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$start = Join-Path $root 'start.mjs'
if (-not (Test-Path $start)) { throw "start.mjs 를 찾지 못했습니다: $start" }

$profilePath = $PROFILE.CurrentUserAllHosts
$begin = '# >>> trusttab >>>'
$end = '# <<< trusttab <<<'
$block = $begin + "`r`n" + 'function trusttab { node "' + $start + '" @args }' + "`r`n" + $end

if (-not (Test-Path $profilePath)) {
  New-Item -ItemType File -Path $profilePath -Force | Out-Null
}
$text = [System.IO.File]::ReadAllText($profilePath)
# 예전에 넣은 블록이 있으면 지우고 새로 넣는다 (여러 번 실행해도 한 번만 들어감)
$pattern = '(?s)\r?\n?' + [regex]::Escape($begin) + '.*?' + [regex]::Escape($end) + '\r?\n?'
$text = [regex]::Replace($text, $pattern, "`r`n")
$text = $text.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
[System.IO.File]::WriteAllText($profilePath, $text.TrimStart(), (New-Object System.Text.UTF8Encoding($true)))

Write-Host "완료: 'trusttab' 명령을 PowerShell 프로필에 넣었습니다." -ForegroundColor Green
Write-Host "  프로필: $profilePath"
Write-Host "  새 터미널을 열고  trusttab  을 입력하세요. (이 창에서 바로 쓰려면:  . `$PROFILE.CurrentUserAllHosts )"
