Add-Type -AssemblyName System.Drawing

$sourcePath = "assets\cse.jpeg"
$src = [System.Drawing.Bitmap]::FromFile($sourcePath)

function Resize-And-Save($targetWidth, $targetHeight, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    
    $parent = Split-Path -Parent $destPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $destPath ($($targetWidth)x$($targetHeight))"
}

# Icon sizes
$iconSizes = @{
    "android\app\src\main\res\mipmap-mdpi" = 48
    "android\app\src\main\res\mipmap-hdpi" = 72
    "android\app\src\main\res\mipmap-xhdpi" = 96
    "android\app\src\main\res\mipmap-xxhdpi" = 144
    "android\app\src\main\res\mipmap-xxxhdpi" = 192
}

foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    Resize-And-Save $size $size "$folder\ic_launcher.png"
    Resize-And-Save $size $size "$folder\ic_launcher_round.png"
    Resize-And-Save ($size * 2) ($size * 2) "$folder\ic_launcher_foreground.png"
}

# Splash sizes
$splashSizes = @{
    "android\app\src\main\res\drawable-port-mdpi\splash.png" = @{w=320; h=480}
    "android\app\src\main\res\drawable-port-hdpi\splash.png" = @{w=480; h=800}
    "android\app\src\main\res\drawable-port-xhdpi\splash.png" = @{w=720; h=1280}
    "android\app\src\main\res\drawable-port-xxhdpi\splash.png" = @{w=960; h=1600}
    "android\app\src\main\res\drawable-port-xxxhdpi\splash.png" = @{w=1280; h=1920}
    "android\app\src\main\res\drawable-land-mdpi\splash.png" = @{w=480; h=320}
    "android\app\src\main\res\drawable-land-hdpi\splash.png" = @{w=800; h=480}
    "android\app\src\main\res\drawable-land-xhdpi\splash.png" = @{w=1280; h=720}
    "android\app\src\main\res\drawable-land-xxhdpi\splash.png" = @{w=1600; h=960}
    "android\app\src\main\res\drawable-land-xxxhdpi\splash.png" = @{w=1920; h=1280}
}

foreach ($dest in $splashSizes.Keys) {
    $dim = $splashSizes[$dest]
    $w = $dim.w
    $h = $dim.h
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 17, 32)) # #0b1120 background
    
    # Draw centered logo
    $logoSize = [Math]::Min($w, $h) * 0.4
    $x = ($w - $logoSize) / 2
    $y = ($h - $logoSize) / 2
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, $x, $y, $logoSize, $logoSize)
    $g.Dispose()
    
    $parent = Split-Path -Parent $dest
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated Splash: $dest ($($w)x$($h))"
}

$src.Dispose()
Write-Host "All icons and splash screens generated successfully!"
