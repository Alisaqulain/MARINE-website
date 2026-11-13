# Re-run (10 Nov 2026) of the full-disk fingerprint sweeps whose v1 workers were killed
# by the 9 Nov 18:54:45Z power-off before writing any result (see disk-scan-status-20261109.log).
# Uses fingerprint-scan-v2.mjs (journaled, resumable). Re-running this script resumes:
# finished units recorded in each <log>.journal are not scanned again.
#   A1/A2/A3 = every top-level entry of E:, sorted by name, dealt round-robin (same split as v1)
#   B        = Windows user profile, Recycle Bin, Windows Temp, Public (same roots as v1)
#   D        = D:\ and C:\ProgramData (new: not covered by v1)
$ErrorActionPreference = "Stop"
$dir = "reports/evidence/security"
$scanner = "$dir/fingerprint-scan-v2.mjs"
$status = "$dir/disk-scan-status-20261110.log"
$now = { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# Keep the PC from idle-sleeping while this script waits (ES_CONTINUOUS | ES_SYSTEM_REQUIRED).
# A user-initiated shutdown still ends the workers; the journals make that resumable.
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[void][Win32.Power]::SetThreadExecutionState([uint32]"0x80000001")

"Launched at $(& $now) (runner PID $PID)" | Add-Content $status -Encoding utf8
$top = @(Get-ChildItem -LiteralPath "E:\" -Force | Sort-Object Name | ForEach-Object { $_.FullName })
"E:\ top-level entries: $($top.Count)" | Add-Content $status
$groups = @(@(), @(), @())
for ($i = 0; $i -lt $top.Count; $i++) { $groups[$i % 3] += $top[$i] }

$jobs = @(
  @{ name = "A1-E-drive"; args = $groups[0] },
  @{ name = "A2-E-drive"; args = $groups[1] },
  @{ name = "A3-E-drive"; args = $groups[2] },
  @{ name = "B-C-profile"; args = @("C:\Users\ali", 'C:\$Recycle.Bin', "C:\Windows\Temp", "C:\Users\Public") },
  @{ name = "D-drive-ProgramData"; args = @("D:\", "C:\ProgramData") }
)
$procs = @()
foreach ($j in $jobs) {
  $log = "$dir/fingerprint-scan-$($j.name)-20261110-v2.log"
  if (Test-Path $log) { "Skipped $($j.name): already complete ($log)" | Add-Content $status; continue }
  $argList = @("--max-old-space-size=3072", $scanner, $log) + $j.args | ForEach-Object { '"' + ($_ -replace '\\$', '\\') + '"' }
  $p = Start-Process -FilePath node -ArgumentList $argList -NoNewWindow -PassThru `
    -RedirectStandardOutput "$dir/fingerprint-scan-$($j.name)-20261110-v2.stdout" `
    -RedirectStandardError "$dir/fingerprint-scan-$($j.name)-20261110-v2.stderr"
  $null = $p.Handle
  $procs += @{ name = $j.name; proc = $p }
  "Started $($j.name): PID $($p.Id), $($j.args.Count) roots: $($j.args -join ' | ')" | Add-Content $status
}
foreach ($x in $procs) {
  $x.proc.WaitForExit()
  "Finished $($x.name): PID $($x.proc.Id) exit code $($x.proc.ExitCode) at $(& $now)" | Add-Content $status
}
"All workers finished at $(& $now)" | Add-Content $status
[void][Win32.Power]::SetThreadExecutionState([uint32]"0x80000000")
Get-Content $status
