$ErrorActionPreference = "Stop"
$node = "C:\Users\chago\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $node)) {
  $node = "node"
}

Set-Location $PSScriptRoot
& $node "src\server.js"
