$validationProcess = Get-Process parallelade | Where-Object { $_.Path -eq (Join-Path (Get-Location) 'src-tauri\target\debug\parallelade.exe') }
$allProcesses = Get-CimInstance Win32_Process
$descendants = [System.Collections.Generic.HashSet[int]]::new()
[void]$descendants.Add($validationProcess.Id)
do { $changed = $false; foreach ($candidate in $allProcesses) { if ($descendants.Contains([int]$candidate.ParentProcessId)) { if ($descendants.Add([int]$candidate.ProcessId)) { $changed = $true } } } } while ($changed)
$sampleBefore = @{}; foreach ($processId in $descendants) { $p = Get-Process -Id $processId -ErrorAction SilentlyContinue; if ($p) { $sampleBefore[$processId] = $p.CPU } }
$clock = [System.Diagnostics.Stopwatch]::StartNew(); Start-Sleep -Seconds 2
$entries = foreach ($processId in $descendants) { $p = Get-Process -Id $processId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{id=$processId;name=$p.ProcessName;workingSetBytes=$p.WorkingSet64;privateBytes=$p.PrivateMemorySize64;cpuPercent=100*($p.CPU-$sampleBefore[$processId])/$clock.Elapsed.TotalSeconds/[Environment]::ProcessorCount} } }
@{sample='20 idle interactive terminals after stress';logicalProcessors=[Environment]::ProcessorCount;processes=@($entries)} | ConvertTo-Json -Depth 5 | Set-Content artifacts/iteration2-process-metrics.json
$entries | Group-Object {if($_.name -in @('parallelade','msedgewebview2')){'App + WebView'}else{'CLI + console'}} | ForEach-Object { [pscustomobject]@{group=$_.Name;processes=$_.Count;workingSetMB=[Math]::Round(($_.Group | Measure-Object workingSetBytes -Sum).Sum/1MB,1);cpuPercent=[Math]::Round(($_.Group | Measure-Object cpuPercent -Sum).Sum,2)} }

