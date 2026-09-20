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
$expectedId = [int](Get-Content artifacts/iteration2-release-pid.txt)
$releaseProcess = Get-Process -Id $expectedId -ErrorAction Stop
if ($releaseProcess.Path -ne (Join-Path (Get-Location) 'src-tauri\target\release\parallelade.exe')) { throw 'Wrong release process path' }
[ValidationWindow]::EnumWindows({param($handle,$unused) $ownerId=0; [void][ValidationWindow]::GetWindowThreadProcessId($handle,[ref]$ownerId); if($ownerId -eq $expectedId){$title=[System.Text.StringBuilder]::new(512);[void][ValidationWindow]::GetWindowText($handle,$title,512);if($title.ToString() -eq 'ParallelADE'){[void][ValidationWindow]::PostMessage($handle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)}};return $true},[IntPtr]::Zero) | Out-Null
if (!$releaseProcess.WaitForExit(10000)) { throw 'Release app did not close normally' }
Write-Host 'Closed only the recorded release validation process'
