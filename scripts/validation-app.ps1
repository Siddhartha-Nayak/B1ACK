$ErrorActionPreference = 'Stop'
$validationData = Join-Path (Get-Location) 'artifacts/iteration2-appdata'
New-Item -ItemType Directory -Force -Path artifacts | Out-Null
@{identifier='io.parallelade.validation';app=@{windows=@(@{label='main';title='ParallelADE Validation';width=1440;height=960;minWidth=360;minHeight=400;dataDirectory=$validationData})}} | ConvertTo-Json -Depth 5 | Set-Content artifacts/iteration2.tauri.conf.json
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224'
$env:CARGO_INCREMENTAL = '0'
npm.cmd run tauri -- dev --no-watch --config artifacts/iteration2.tauri.conf.json
exit $LASTEXITCODE
