# Runs the full-disk fingerprint sweeps in parallel and records each worker's
# exit code. Scan A = all of E: (3 workers over its top-level entries, plus every
# git repository's full object store). Scan B = the Windows user profile and
# related locations. Logs: fingerprint-scan-<part>-20261109-final.log
$ErrorActionPreference = "Stop"
$dir = "reports/evidence/security"
$scanner = "$dir/fingerprint-scan.mjs"
$status = "$dir/disk-scan-status-20261109.log"
"Launched at $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))" | Set-Content $status -Encoding utf8

# Every top-level entry of E:, files and hidden/system folders included, dealt round-robin to 3 workers.
$top = @(Get-ChildItem -LiteralPath "E:\" -Force | Sort-Object Name | ForEach-Object { $_.FullName })
"E:\ top-level entries: $($top.Count)" | Add-Content $status
$groups = @(@(), @(), @())
for ($i = 0; $i -lt $top.Count; $i++) { $groups[$i % 3] += $top[$i] }

# Git repositories anywhere on E: (a folder containing .git), found without descending into node_modules.
$repos = node -e @"
const fs=require('fs'),p=require('path');const out=[];
(function w(d){let e;try{e=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const x of e){if(!x.isDirectory()||x.isSymbolicLink())continue;if(x.name==='.git'){out.push(d);continue}
if(x.name==='node_modules'||x.name==='System Volume Information'||x.name==='`$RECYCLE.BIN')continue;w(p.join(d,x.name))}})('E:\\');
console.log(out.join('\n'))
"@
$repos = @($repos | Where-Object { $_ })
"Git repositories on E:: $($repos.Count)" | Add-Content $status
$repos | ForEach-Object { "  $_" } | Add-Content $status

$jobs = @(
  @{ name = "A1-E-drive"; args = $groups[0] },
  @{ name = "A2-E-drive"; args = $groups[1] },
  @{ name = "A3-E-drive"; args = $groups[2] },
  @{ name = "A4-E-git-history"; args = @($repos | ForEach-Object { "git:$_" }) },
  @{ name = "B-C-profile"; args = @("C:\Users\ali", 'C:\$Recycle.Bin', "C:\Windows\Temp", "C:\Users\Public") }
)
$procs = @()
foreach ($j in $jobs) {
  $log = "$dir/fingerprint-scan-$($j.name)-20261109-final.log"
  $argList = @("--max-old-space-size=4096", $scanner, $log) + $j.args | ForEach-Object { '"' + ($_ -replace '\\$', '\\') + '"' }
  $p = Start-Process -FilePath node -ArgumentList $argList -NoNewWindow -PassThru `
    -RedirectStandardOutput "$dir/fingerprint-scan-$($j.name)-20261109-final.stdout" `
    -RedirectStandardError "$dir/fingerprint-scan-$($j.name)-20261109-final.progress"
  $null = $p.Handle  # keeps the handle so ExitCode is available after exit
  $procs += @{ name = $j.name; proc = $p; roots = $j.args.Count }
  "Started $($j.name): PID $($p.Id), $($j.args.Count) roots" | Add-Content $status
}
foreach ($x in $procs) {
  $x.proc.WaitForExit()
  "Finished $($x.name): exit code $($x.proc.ExitCode) at $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))" | Add-Content $status
}
"All workers finished" | Add-Content $status
Get-Content $status
