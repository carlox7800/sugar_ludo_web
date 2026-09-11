$env:JAVA_HOME = "D:\Nueva carpeta\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

Write-Host "1. Building Next.js (Static Export)..."
cmd.exe /c "npm run build"

Write-Host "2. Syncing Capacitor (Clean sync before adding large binaries to out/)..."
cmd.exe /c "npx cap sync android"

Write-Host "3. Building Electron EXE (v9.2.7)..."
cmd.exe /c "npx electron-builder --win --x64"

Write-Host "4. Storing EXE in releases folder..."
if (!(Test-Path "releases")) { New-Item -ItemType Directory -Path "releases" | Out-Null }
if (Test-Path "releases\SugarLudo-Setup.zip") { Remove-Item "releases\SugarLudo-Setup.zip" -Force }
if (Test-Path "out\SugarLudo-Setup.zip") { Remove-Item "out\SugarLudo-Setup.zip" -Force }

$latestExe = Get-ChildItem -Path "dist" -Filter "Sugar Ludo Setup*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestExe) {
    Copy-Item -Path $latestExe.FullName -Destination "releases\SugarLudo-Setup.exe" -Force
    Write-Host "Injected latest EXE: $($latestExe.Name)"
}

Write-Host "5. Injecting downloads into out/ for Next.js Static Server..."
if (Test-Path "releases\SugarLudo-Setup.exe") {
    Copy-Item -Path "releases\SugarLudo-Setup.exe" -Destination "out\SugarLudo-Setup.exe" -Force
}
if (Test-Path "releases\SugarLudo.apk") {
    Copy-Item -Path "releases\SugarLudo.apk" -Destination "out\SugarLudo.apk" -Force
}

Write-Host "ALL DONE!"
