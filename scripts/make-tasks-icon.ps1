Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$static = Join-Path $root 'com.mirabox.streamdock.tasks.sdPlugin\static'
New-Item -ItemType Directory -Force -Path $static | Out-Null

function New-Canvas([int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

$size = 200
$canvas = New-Canvas $size
$graphics = $canvas.Graphics
$fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 26, 115, 232))
$pad = 10
$graphics.FillEllipse($fill, $pad, $pad, $size - (2 * $pad), $size - (2 * $pad))
$fill.Dispose()

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), 10
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLine($pen, 78, 40, 96, 58)
$graphics.DrawLine($pen, 96, 58, 128, 30)
$pen.Dispose()

$canvas.Graphics.Dispose()
$path = Join-Path $static 'icon.png'
$canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Bitmap.Dispose()
Write-Output $path
