Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$static = Join-Path $root 'com.mirabox.streamdock.zapret.sdPlugin\static'
New-Item -ItemType Directory -Force -Path $static | Out-Null

function New-Canvas([int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Mark([string]$path, [System.Drawing.Color]$color) {
    $size = 200
    $canvas = New-Canvas $size
    $graphics = $canvas.Graphics
    $fill = New-Object System.Drawing.SolidBrush $color
    $pad = 10
    $graphics.FillEllipse($fill, $pad, $pad, $size - (2 * $pad), $size - (2 * $pad))
    $fill.Dispose()

    $font = New-Object System.Drawing.Font 'Segoe UI', 78, ([System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $measured = $graphics.MeasureString('Z', $font)
    $x = ($size - $measured.Width) / 2
    $y = ($size - $measured.Height) / 2 - 4
    $graphics.DrawString('Z', $font, $brush, $x, $y)
    $brush.Dispose()
    $font.Dispose()

    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Dispose()
}

Save-Mark (Join-Path $static 'icon.png') ([System.Drawing.Color]::FromArgb(255, 26, 115, 232))
Save-Mark (Join-Path $static 'off.png') ([System.Drawing.Color]::FromArgb(255, 78, 78, 78))
Save-Mark (Join-Path $static 'on.png') ([System.Drawing.Color]::FromArgb(255, 46, 157, 79))
Write-Output $static
