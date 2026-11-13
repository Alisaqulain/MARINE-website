# Isolation proof for a running isolated test server (read-only). For every Marina node process
# listening on the given port (and its node parents), reads the live environment block from process
# memory and reports, per env-registry variable, only whether it is EMPTY or SET. For the secrets the
# isolated launcher generates, it prints their SHA-256 fingerprints (10 hex) so they can be matched
# with `node scripts/isolated-env.mjs` (the server must hold the fresh session values, never .env.local's).
#   powershell -File reports/evidence/phase2/isolation-proof.ps1 -Port 3939 -Names <file with names>
param([int]$Port = 3939, [string]$NamesFile)
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PebEnv2 {
  [StructLayout(LayoutKind.Sequential)] struct PBI { public IntPtr R1, Peb, R2a, R2b, Pid, Parent; }
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int c, ref PBI p, int l, out int r);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(int a, bool i, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, IntPtr n, out IntPtr r);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static byte[] Read(IntPtr h, IntPtr addr, long n) { var b = new byte[n]; IntPtr r; if (!ReadProcessMemory(h, addr, b, new IntPtr(n), out r)) throw new Exception("ReadProcessMemory failed " + Marshal.GetLastWin32Error()); return b; }
  public static string Get(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) throw new Exception("OpenProcess failed " + Marshal.GetLastWin32Error());
    try {
      var p = new PBI(); int ret;
      if (NtQueryInformationProcess(h, 0, ref p, Marshal.SizeOf(p), out ret) != 0) throw new Exception("NtQueryInformationProcess failed");
      IntPtr pp = new IntPtr(BitConverter.ToInt64(Read(h, p.Peb + 0x20, 8), 0));
      IntPtr env = new IntPtr(BitConverter.ToInt64(Read(h, pp + 0x80, 8), 0));
      long size = BitConverter.ToInt64(Read(h, pp + 0x3F0, 8), 0);
      return System.Text.Encoding.Unicode.GetString(Read(h, env, size));
    } finally { CloseHandle(h); }
  }
}
"@
$sha = [System.Security.Cryptography.SHA256]::Create()
function Fp([string]$v) { (-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($v)) | ForEach-Object { $_.ToString("x2") })).Substring(0, 10) }
$names = Get-Content $NamesFile | Where-Object { $_ }
$generated = "AUTH_SECRET","CRON_SECRET","VAPI_WEBHOOK_SECRET","META_WEBHOOK_VERIFY_TOKEN","EXOTEL_WEBHOOK_TOKEN","META_APP_SECRET"
"Checked at " + (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") + " (port $Port)"
# (State is reported blank for the IPv6 "::" listener in some sessions, so filter on the local port only)
$listen = @(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique)
if (-not $listen.Count) { "No process listens on port $Port"; exit 2 }
$pids = New-Object System.Collections.Generic.List[int]
foreach ($l in $listen) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$l"; while ($p -and $p.Name -eq "node.exe") { if (-not $pids.Contains([int]$p.ProcessId)) { $pids.Add([int]$p.ProcessId) }; $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" } }
foreach ($id in $pids) {
  $cl = (Get-CimInstance Win32_Process -Filter "ProcessId=$id").CommandLine
  "`n--- PID ${id}: $($cl -replace '^.*node_modules[\\/]', '.../') ---"
  $block = [PebEnv2]::Get($id)
  $vars = @{}
  foreach ($kv in $block.Split([char]0)) { if ($kv -match '^([^=]+)=(.*)$') { $vars[$Matches[1]] = $Matches[2] } }
  "  MARINA_ISOLATED_TEST=" + $vars["MARINA_ISOLATED_TEST"] + "  NODE_ENV=" + $vars["NODE_ENV"]
  $set = @(); $empty = @(); $absent = @()
  foreach ($n in $names) { if (-not $vars.ContainsKey($n)) { $absent += $n } elseif ($vars[$n].Trim()) { $set += $n } else { $empty += $n } }
  "  registry variables SET ($($set.Count)): " + ($set -join ", ")
  "  registry variables EMPTY ($($empty.Count))"
  "  registry variables ABSENT ($($absent.Count)): " + ($absent -join ", ")
  "  generated-secret fingerprints: " + (($generated | ForEach-Object { if ($vars[$_]) { "$_=" + (Fp $vars[$_]) } else { "$_=(empty)" } }) -join "; ")
  $db = $vars["MONGODB_URI"]; if ($db -match '^mongodb(\+srv)?://(?:[^@/]*@)?([^/?]+)') { "  MONGODB_URI host: " + $Matches[2] } else { "  MONGODB_URI: absent" }
}
