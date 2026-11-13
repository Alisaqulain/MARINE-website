# Read-only check of the live environment block of every running Marina Muse
# process. Reads each process's PEB environment from memory (Node on Windows
# writes process.env changes, including the .env.local values Next.js loads,
# into this block). Values are hashed in memory and compared with the
# production credential fingerprints; only names, fingerprints, counts and the
# database host are printed.
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PebEnv {
  [StructLayout(LayoutKind.Sequential)] struct PBI { public IntPtr R1, Peb, R2a, R2b, Pid, Parent; }
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int c, ref PBI p, int l, out int r);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(int a, bool i, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, IntPtr n, out IntPtr r);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static byte[] Read(IntPtr h, IntPtr addr, long n) { var b = new byte[n]; IntPtr r; if (!ReadProcessMemory(h, addr, b, new IntPtr(n), out r)) throw new Exception("ReadProcessMemory failed " + Marshal.GetLastWin32Error()); return b; }
  public static string Get(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid); // QUERY_INFORMATION | VM_READ
    if (h == IntPtr.Zero) throw new Exception("OpenProcess failed " + Marshal.GetLastWin32Error());
    try {
      var p = new PBI(); int ret;
      if (NtQueryInformationProcess(h, 0, ref p, Marshal.SizeOf(p), out ret) != 0) throw new Exception("NtQueryInformationProcess failed");
      IntPtr pp = new IntPtr(BitConverter.ToInt64(Read(h, p.Peb + 0x20, 8), 0));   // PEB.ProcessParameters
      IntPtr env = new IntPtr(BitConverter.ToInt64(Read(h, pp + 0x80, 8), 0));     // RTL_USER_PROCESS_PARAMETERS.Environment
      long size = BitConverter.ToInt64(Read(h, pp + 0x3F0, 8), 0);                 // .EnvironmentSize
      return System.Text.Encoding.Unicode.GetString(Read(h, env, size));
    } finally { CloseHandle(h); }
  }
}
"@

$targets = @{ "0f74c955cd" = "production MONGODB_URI"; "443117db38" = "production DB password"; "8328be9d60" = "production DB user name" }
$sha = [System.Security.Cryptography.SHA256]::Create()
function Fp([string]$v) { (-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($v)) | ForEach-Object { $_.ToString("x2") })).Substring(0, 10) }

"Checked at " + (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$marina = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*marina e-comm*" -and $_.Name -eq "node.exe" -and $_.CommandLine -notlike "*reports/evidence*" }
# Include each server's parent processes (the npx wrapper does not name the project path).
$parents = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and ($marina.ParentProcessId -contains $_.ProcessId) }
$procs = @($marina) + @($parents) | Sort-Object ProcessId -Unique
"Marina Muse node processes: $($procs.Count)"
foreach ($pr in $procs) {
  "`n--- PID $($pr.ProcessId): $($pr.CommandLine -replace '^.*node_modules[\\/]', 'â€¦/') ---"
  try { $block = [PebEnv]::Get([int]$pr.ProcessId) } catch { "  could not read environment: $($_.Exception.Message)"; continue }
  $vars = $block.Split([char]0) | Where-Object { $_ -match "^[^=]+=" }
  "  environment variables: $($vars.Count)"
  $names = $vars | ForEach-Object { ($_ -split "=", 2)[0] }
  "  database-related names: " + (($names | Where-Object { $_ -match "MONGO|DATABASE|DB_" }) -join ", ")
  $found = @{}
  foreach ($v in $vars) {
    $val = ($v -split "=", 2)[1]
    $cands = @($val) + ($val -split '[\s"''`:/?#@\\]+') + ($val -split '[\s"''`:/?#@\\=,;&()\[\]{}<>|]+')
    foreach ($c in $cands | Where-Object { $_.Length -ge 4 }) { $t = $targets[(Fp $c)]; if ($t) { $found[$t] = $true } }
  }
  "  production credential fingerprints in this environment: " + $(if ($found.Count) { "FOUND: " + ($found.Keys -join ", ") } else { "none (0 of 3)" })
  $uri = ($vars | Where-Object { $_ -like "MONGODB_URI=*" } | Select-Object -First 1)
  if ($uri) {
    $val = ($uri -split "=", 2)[1]
    $hostPart = if ($val -match '^mongodb(\+srv)?://(?:[^@/]*@)?([^/?]+)') { $Matches[2] } else { "(unparsed)" }
    "  MONGODB_URI: present, host $hostPart, fingerprint $(Fp $val)"
  } else { "  MONGODB_URI: not in this process's environment" }
  $db = ($vars | Where-Object { $_ -like "MONGODB_DB_NAME=*" } | Select-Object -First 1); if ($db) { "  $db" }
  "  1za3pdr / mongodb.net anywhere in the block: " + $(if ($block -match "1za3pdr|mongodb\.net") { "PRESENT" } else { "absent" })
}
"`n--- Test database container environment (docker inspect) ---"
$cenv = docker inspect marina-dev-mongo --format "{{range .Config.Env}}{{println .}}{{end}}"
"  variable names: " + (($cenv | Where-Object { $_ } | ForEach-Object { ($_ -split "=", 2)[0] }) -join ", ")
"  1za3pdr / mongodb.net: " + $(if (($cenv -join "`n") -match "1za3pdr|mongodb\.net") { "PRESENT" } else { "absent" })

