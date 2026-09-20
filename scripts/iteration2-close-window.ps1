Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class ValidationWindow {
 public delegate bool Callback(IntPtr hwnd, IntPtr param);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr param);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
}
"@
$validationId = (Get-Process parallelade | Where-Object { $_.Path -eq (Join-Path (Get-Location) 'src-tauri\target\debug\parallelade.exe') }).Id
[ValidationWindow]::EnumWindows({param($handle,$unused) $ownerId=0; [void][ValidationWindow]::GetWindowThreadProcessId($handle,[ref]$ownerId); if($ownerId -eq $validationId){$title=[System.Text.StringBuilder]::new(512);[void][ValidationWindow]::GetWindowText($handle,$title,512);if($title.ToString() -eq 'ParallelADE Validation'){[void][ValidationWindow]::PostMessage($handle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero);Write-Host 'Sent normal close to validation window'}};return $true},[IntPtr]::Zero)
Start-Sleep -Seconds 5
$tracked = (Get-Content artifacts/iteration2-process-metrics.json -Raw | ConvertFrom-Json).processes
$survivors = @($tracked | Where-Object { Get-Process -Id $_.id -ErrorAction SilentlyContinue })
@{tracked=$tracked.Count;survivors=$survivors} | ConvertTo-Json -Depth 3 | Set-Content artifacts/iteration2-shutdown-results.json
Get-Content artifacts/iteration2-shutdown-results.json
