# Read-only check: does any process on this machine hold a connection to the
# production MongoDB cluster? Resolves the cluster's shard hosts with DNS only
# (no database connection is made) and compares every TCP connection against
# those addresses on any port, plus any remote port 27017 to any host.
$ErrorActionPreference = "Stop"
"Checked at " + (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

"--- 1. Old development processes ---"
foreach ($p in 3548, 18668) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$p"
  if ($proc) { "PID $p STILL RUNNING: $($proc.CommandLine)" } else { "PID $p : not present (exited)" }
}

"--- 2. Production cluster addresses (DNS only) ---"
# cluster0.1za3pdr: the cluster in the pre-isolation .env.local (production).
# a9zxbuj: the cluster hard-coded in scripts/test-mongo.mjs.
$hosts = @()
foreach ($cluster in "cluster0.1za3pdr.mongodb.net", "cluster0.a9zxbuj.mongodb.net") {
  $srv = Resolve-DnsName "_mongodb._tcp.$cluster" -Type SRV -ErrorAction SilentlyContinue | Where-Object { $_.NameTarget }
  "SRV $cluster -> " + $(if ($srv) { ($srv.NameTarget -join ", ") } else { "(no SRV record)" })
  $hosts += $srv.NameTarget
}
$hosts += "ac-yqibwz9-shard-00-00.a9zxbuj.mongodb.net", "ac-yqibwz9-shard-00-01.a9zxbuj.mongodb.net", "ac-yqibwz9-shard-00-02.a9zxbuj.mongodb.net"
$prodIps = @()
foreach ($h in ($hosts | Where-Object { $_ } | Sort-Object -Unique)) {
  $ips = (Resolve-DnsName $h -Type A -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress }).IPAddress
  "$h -> $($ips -join ', ')"
  $prodIps += $ips
}
$prodIps = $prodIps | Sort-Object -Unique
"Production IPs compared: $($prodIps.Count)"

"--- 3. All TCP connections (every state, every process) ---"
$all = Get-NetTCPConnection
"Total TCP entries on this machine: $($all.Count)"
$toProd = $all | Where-Object { $prodIps -contains $_.RemoteAddress }
$to27017 = $all | Where-Object { $_.RemotePort -eq 27017 }
$fromOld = $all | Where-Object { $_.OwningProcess -in 3548, 18668 }
"Connections to a production cluster IP (any port): $($toProd.Count)"
$toProd | ForEach-Object { "  PID $($_.OwningProcess) $($_.LocalAddress):$($_.LocalPort) -> $($_.RemoteAddress):$($_.RemotePort) $($_.State)" }
"Connections to remote port 27017 (any host): $($to27017.Count)"
$to27017 | ForEach-Object { "  PID $($_.OwningProcess) -> $($_.RemoteAddress):$($_.RemotePort) $($_.State)" }
"Connections owned by PID 3548 or 18668: $($fromOld.Count)"

"--- 4. Connections of this project's processes ---"
$projProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*marina e-comm*" }
foreach ($pp in $projProcs) {
  $c = $all | Where-Object { $_.OwningProcess -eq $pp.ProcessId -and $_.RemoteAddress -notin "0.0.0.0", "::" }
  "PID $($pp.ProcessId) ($($pp.Name)): " + (($c | ForEach-Object { "$($_.RemoteAddress):$($_.RemotePort) $($_.State)" } | Sort-Object -Unique) -join "; ")
}
"--- 5. MongoDB-related listeners and the test container ---"
$all | Where-Object { $_.LocalPort -in 27017, 27018 -and $_.State -eq "Listen" } | ForEach-Object { "Listen $($_.LocalAddress):$($_.LocalPort) PID $($_.OwningProcess)" }
