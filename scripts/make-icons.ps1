Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$static = Join-Path $root 'com.mirabox.streamdock.timer.sdPlugin\static'

function New-Canvas([int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png($canvas, [string]$path) {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Dispose()
}

function Draw-Knob([string]$path, [int]$r, [int]$g, [int]$b) {
    $canvas = New-Canvas 200
    $graphics = $canvas.Graphics
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 20, 26))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, $r, $g, $b), 16)
    $graphics.FillEllipse($fill, 28, 28, 144, 144)
    $graphics.DrawEllipse($pen, 16, 16, 168, 168)
    $pen.Dispose()
    $fill.Dispose()
    Save-Png $canvas $path
}

function Draw-Icon([string]$path) {
    $canvas = New-Canvas 128
    $graphics = $canvas.Graphics
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 20, 26))
    $ring = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 61, 220, 151), 8)
    $hand = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 6)
    $hand.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hand.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.FillEllipse($fill, 6, 6, 116, 116)
    $graphics.DrawEllipse($ring, 10, 10, 108, 108)
    $graphics.DrawLine($hand, 64, 66, 64, 30)
    $graphics.DrawLine($hand, 64, 66, 90, 80)
    $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $graphics.FillEllipse($dot, 59, 61, 10, 10)
    $hand.Dispose()
    $ring.Dispose()
    $fill.Dispose()
    $dot.Dispose()
    Save-Png $canvas $path
}

Draw-Icon (Join-Path $static 'icon.png')
Draw-Knob (Join-Path $static 'idle.png') 122 162 214
Draw-Knob (Join-Path $static 'running.png') 61 220 151
Draw-Knob (Join-Path $static 'paused.png') 240 186 90
Draw-Knob (Join-Path $static 'alarm.png') 255 96 96
Write-Output 'icons-ok'
