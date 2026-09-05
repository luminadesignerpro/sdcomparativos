Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\User\.gemini\antigravity-ide\brain\b7b9629f-1a1e-4f88-918d-9d49c457030b\.user_uploaded\media_1788624203438.jpg"
if (-not (Test-Path $srcPath)) {
    $srcPath = "C:\Users\User\.gemini\antigravity-ide\brain\b7b9629f-1a1e-4f88-918d-9d49c457030b\.user_uploaded\media_1788620148319.jpg"
}

Write-Output "Using source image: $srcPath"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-And-Save($destPath, $width, $height, $format) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.DrawImage($srcImg, 0, 0, $width, $height)
    $graphics.Dispose()
    
    $parentDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    
    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    $bmp.Save($destPath, $format)
    $bmp.Dispose()
    Write-Output "Saved: $destPath ($width x $height)"
}

$png = [System.Drawing.Imaging.ImageFormat]::Png
$jpeg = [System.Drawing.Imaging.ImageFormat]::Jpeg

# === 1. sdcomparativos ===
Write-Output "--- Generating icons for sdcomparativos ---"
Resize-And-Save "public\icon-512x512.png" 512 512 $png
Resize-And-Save "public\icon-512.png" 512 512 $png
Resize-And-Save "public\icon-maskable-512x512.png" 512 512 $png
Resize-And-Save "public\icon-384x384.png" 384 384 $png
Resize-And-Save "public\icon-192x192.png" 192 192 $png
Resize-And-Save "public\icon-192.png" 192 192 $png
Resize-And-Save "public\icon-maskable-192x192.png" 192 192 $png
Resize-And-Save "public\icon-180x180.png" 180 180 $png
Resize-And-Save "public\icon-152x152.png" 152 152 $png
Resize-And-Save "public\icon-144x144.png" 144 144 $png
Resize-And-Save "public\icon-128x128.png" 128 128 $png
Resize-And-Save "public\icon-96x96.png" 96 96 $png
Resize-And-Save "public\icon-72x72.png" 72 72 $png
Resize-And-Save "public\icon-64x64.png" 64 64 $png
Resize-And-Save "public\favicon.png" 64 64 $png
Resize-And-Save "public\favicon.jpeg" 64 64 $jpeg
Resize-And-Save "public\images\logo-sd-gold.png" 512 512 $png

# Src assets
Resize-And-Save "src\assets\logo-sd.png" 512 512 $png
Resize-And-Save "src\assets\logo-sd.jpeg" 512 512 $jpeg
Resize-And-Save "src\assets\logo.png" 512 512 $png
Resize-And-Save "src\assets\logo.jpeg" 512 512 $jpeg

# === 2. SDfinanceiro-1 (if present on Desktop) ===
$sdfPath = "C:\Users\User\Desktop\SDfinanceiro-1"
if (Test-Path $sdfPath) {
    Write-Output "--- Generating icons for SDfinanceiro-1 ---"
    Resize-And-Save "$sdfPath\assets\icon-512.png" 512 512 $png
    Resize-And-Save "$sdfPath\assets\icon-384.png" 384 384 $png
    Resize-And-Save "$sdfPath\assets\icon-192.png" 192 192 $png
    Resize-And-Save "$sdfPath\assets\icon-152.png" 152 152 $png
    Resize-And-Save "$sdfPath\assets\icon-144.png" 144 144 $png
    Resize-And-Save "$sdfPath\assets\icon-128.png" 128 128 $png
    Resize-And-Save "$sdfPath\assets\icon-96.png" 96 96 $png
    Resize-And-Save "$sdfPath\assets\icon-72.png" 72 72 $png
    Resize-And-Save "$sdfPath\assets\logo.jpg" 512 512 $jpeg
}

$srcImg.Dispose()
Write-Output "All icons generated successfully!"
