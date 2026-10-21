Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$static = Join-Path $root 'com.mirabox.streamdock.happ.sdPlugin\static'
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

function Save-Png($canvas, [string]$path) {
    $canvas.Graphics.Dispose()
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Dispose()
}

function Brush([int]$r, [int]$g, [int]$b, [int]$a = 255) {
    New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($a, $r, $g, $b))
}

function Pen([int]$r, [int]$g, [int]$b, [float]$width) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, $r, $g, $b), $width)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

function Draw-Plate($graphics, [int]$size, [int]$r, [int]$g, [int]$b) {
    $fill = Brush 16 20 26
    $ring = Pen $r $g $b ([Math]::Max(6, $size * 0.055))
    $pad = [int]($size * 0.08)
    $box = $size - (2 * $pad)
    $graphics.FillEllipse($fill, $pad, $pad, $box, $box)
    $graphics.DrawEllipse($ring, $pad, $pad, $box, $box)
    $fill.Dispose()
    $ring.Dispose()
}

function Draw-Connect($graphics, [int]$size) {
    $pen = Pen 61 220 151 ([Math]::Max(7, $size * 0.07))
    $cx = $size / 2
    $top = $size * 0.28
    $bottom = $size * 0.62
    $graphics.DrawArc($pen, $cx - $size * 0.16, $top, $size * 0.32, $size * 0.32, 200, 140)
    $graphics.DrawLine($pen, $cx, $top + $size * 0.02, $cx, $bottom)
    $pen.Dispose()
}

function Draw-Disconnect($graphics, [int]$size) {
    $pen = Pen 255 96 96 ([Math]::Max(8, $size * 0.075))
    $a = $size * 0.34
    $b = $size * 0.66
    $graphics.DrawLine($pen, $a, $a, $b, $b)
    $graphics.DrawLine($pen, $b, $a, $a, $b)
    $pen.Dispose()
}

function Draw-Arrows($graphics, [int]$size, [int]$r, [int]$g, [int]$b) {
    $pen = Pen $r $g $b ([Math]::Max(7, $size * 0.065))
    $left = $size * 0.30
    $right = $size * 0.70
    $y1 = $size * 0.40
    $y2 = $size * 0.58
    $graphics.DrawLine($pen, $left, $y1, $right, $y1)
    $graphics.DrawLine($pen, $right - $size * 0.08, $y1 - $size * 0.07, $right, $y1)
    $graphics.DrawLine($pen, $right - $size * 0.08, $y1 + $size * 0.07, $right, $y1)
    $graphics.DrawLine($pen, $right, $y2, $left, $y2)
    $graphics.DrawLine($pen, $left + $size * 0.08, $y2 - $size * 0.07, $left, $y2)
    $graphics.DrawLine($pen, $left + $size * 0.08, $y2 + $size * 0.07, $left, $y2)
    $pen.Dispose()
}

function Draw-Toggle($graphics, [int]$size) { Draw-Arrows $graphics $size 240 186 90 }
function Draw-ToggleOff($graphics, [int]$size) { Draw-Arrows $graphics $size 154 163 176 }
function Draw-ToggleOn($graphics, [int]$size) { Draw-Arrows $graphics $size 61 220 151 }

function Draw-Open($graphics, [int]$size) {
    $pen = Pen 126 182 255 ([Math]::Max(7, $size * 0.06))
    $x = $size * 0.32
    $y = $size * 0.30
    $w = $size * 0.36
    $h = $size * 0.36
    $graphics.DrawRectangle($pen, $x, $y, $w, $h)
    $graphics.DrawLine($pen, $x, $y + $size * 0.10, $x + $w, $y + $size * 0.10)
    $pen.Dispose()
}

function Draw-Close($graphics, [int]$size) {
    $pen = Pen 176 184 196 ([Math]::Max(7, $size * 0.06))
    $x = $size * 0.32
    $y = $size * 0.30
    $w = $size * 0.36
    $h = $size * 0.36
    $graphics.DrawRectangle($pen, $x, $y, $w, $h)
    $graphics.DrawLine($pen, $x + $w * 0.62, $y + $h * 0.18, $x + $w * 0.84, $y + $h * 0.40)
    $graphics.DrawLine($pen, $x + $w * 0.84, $y + $h * 0.18, $x + $w * 0.62, $y + $h * 0.40)
    $pen.Dispose()
}

function Draw-Routing($graphics, [int]$size) {
    $pen = Pen 192 132 252 ([Math]::Max(7, $size * 0.06))
    $brush = Brush 192 132 252
    $graphics.DrawLine($pen, $size * 0.30, $size * 0.62, $size * 0.70, $size * 0.38)
    $graphics.FillEllipse($brush, $size * 0.24, $size * 0.54, $size * 0.12, $size * 0.12)
    $graphics.FillEllipse($brush, $size * 0.64, $size * 0.30, $size * 0.12, $size * 0.12)
    $cut = Pen 255 96 96 ([Math]::Max(6, $size * 0.05))
    $graphics.DrawLine($cut, $size * 0.58, $size * 0.58, $size * 0.74, $size * 0.42)
    $pen.Dispose()
    $brush.Dispose()
    $cut.Dispose()
}

function Draw-Mark([string]$path, [int]$size, [scriptblock]$mark, [int]$r, [int]$g, [int]$b) {
    $canvas = New-Canvas $size
    Draw-Plate $canvas.Graphics $size $r $g $b
    & $mark $canvas.Graphics $size
    Save-Png $canvas $path
}

Draw-Mark (Join-Path $static 'icon.png') 128 ${function:Draw-Connect} 61 220 151
Draw-Mark (Join-Path $static 'connect.png') 200 ${function:Draw-Connect} 61 220 151
Draw-Mark (Join-Path $static 'disconnect.png') 200 ${function:Draw-Disconnect} 255 96 96
function New-HappGlyph([string]$sourcePath) {
    $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
    $glyph = New-Object System.Drawing.Bitmap 256, 256
    for ($y = 0; $y -lt 256; $y++) {
        for ($x = 0; $x -lt 256; $x++) {
            $color = $source.GetPixel($x, $y)
            $luma = ($color.R + $color.G + $color.B) / 3
            $amount = [Math]::Max(0, [Math]::Min(1, ($luma - 60) / (255 - 60)))
            $alpha = [int](255 * $amount)
            $glyph.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
    }
    $source.Dispose()
    return $glyph
}

function Save-HappMark($glyph, [string]$path, [int]$r, [int]$g, [int]$b, [bool]$roomForTitle) {
    $canvas = New-Canvas 200
    if ($roomForTitle) {
        $maxW = 150
        $maxH = 132
    } else {
        $maxW = 190
        $maxH = 190
    }
    $scale = [Math]::Min($maxW / 142.0, $maxH / 174.0)
    $width = [int](142 * $scale)
    $height = [int](174 * $scale)
    $left = [int]((200 - $width) / 2)
    $top = if ($roomForTitle) { 4 } else { [int]((200 - $height) / 2) }
    $matrix = New-Object System.Drawing.Imaging.ColorMatrix
    $matrix.Matrix00 = $r / 255.0
    $matrix.Matrix11 = $g / 255.0
    $matrix.Matrix22 = $b / 255.0
    $matrix.Matrix33 = 1
    $matrix.Matrix44 = 1
    $attrs = New-Object System.Drawing.Imaging.ImageAttributes
    $attrs.SetColorMatrix($matrix)
    $dest = New-Object System.Drawing.Rectangle $left, $top, $width, $height
    $canvas.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $canvas.Graphics.DrawImage($glyph, $dest, 57, 41, 142, 174, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
    $attrs.Dispose()
    Save-Png $canvas $path
}

$logo = Join-Path $PSScriptRoot 'happ-logo-256.png'
$glyph = New-HappGlyph $logo
Save-HappMark $glyph (Join-Path $static 'toggle.png') 255 255 255 $false
Save-HappMark $glyph (Join-Path $static 'toggle-plain.png') 255 255 255 $false
Save-HappMark $glyph (Join-Path $static 'toggle-on.png') 255 255 255 $true
Save-HappMark $glyph (Join-Path $static 'toggle-off.png') 78 78 78 $true
$glyph.Dispose()
Draw-Mark (Join-Path $static 'open.png') 200 ${function:Draw-Open} 126 182 255
Draw-Mark (Join-Path $static 'close.png') 200 ${function:Draw-Close} 176 184 196
Draw-Mark (Join-Path $static 'routing.png') 200 ${function:Draw-Routing} 192 132 252
Write-Output 'happ-icons-ok'
