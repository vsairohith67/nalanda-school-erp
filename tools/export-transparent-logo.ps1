param(
  [string]$SourcePath = (Join-Path $PSScriptRoot "..\public\nalanda-logo.jpg"),
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\public\nalanda-logo-transparent.png")
)

$ErrorActionPreference = "Stop"
$source = [System.IO.Path]::GetFullPath($SourcePath)
$output = [System.IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Official logo source not found: $source"
}
if ([System.IO.Path]::GetExtension($output) -ne ".png") {
  throw "Transparent logo output must be a PNG."
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class NalandaTransparentLogo
{
    public static void Export(string sourcePath, string outputPath)
    {
        using (var source = new Bitmap(sourcePath))
        using (var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.DrawImageUnscaled(source, 0, 0);
            }

            var rectangle = new Rectangle(0, 0, output.Width, output.Height);
            var data = output.LockBits(rectangle, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            try
            {
                var stride = Math.Abs(data.Stride);
                var pixels = new byte[stride * output.Height];
                Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
                var visited = new bool[output.Width * output.Height];
                var queue = new Queue<int>(output.Width * 4);

                Action<int, int> enqueue = (x, y) =>
                {
                    var index = y * output.Width + x;
                    if (visited[index]) return;
                    var offset = y * stride + x * 4;
                    var minimum = Math.Min(pixels[offset], Math.Min(pixels[offset + 1], pixels[offset + 2]));
                    if (minimum < 210) return;
                    visited[index] = true;
                    queue.Enqueue(index);
                };

                for (var x = 0; x < output.Width; x++)
                {
                    enqueue(x, 0);
                    enqueue(x, output.Height - 1);
                }
                for (var y = 0; y < output.Height; y++)
                {
                    enqueue(0, y);
                    enqueue(output.Width - 1, y);
                }

                while (queue.Count > 0)
                {
                    var index = queue.Dequeue();
                    var x = index % output.Width;
                    var y = index / output.Width;
                    var offset = y * stride + x * 4;
                    pixels[offset + 3] = 0;
                    if (x > 0) enqueue(x - 1, y);
                    if (x + 1 < output.Width) enqueue(x + 1, y);
                    if (y > 0) enqueue(x, y - 1);
                    if (y + 1 < output.Height) enqueue(x, y + 1);
                }

                Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
            }
            finally
            {
                output.UnlockBits(data);
            }
            output.Save(outputPath, ImageFormat.Png);
        }
    }
}
"@

[NalandaTransparentLogo]::Export($source, $output)
Write-Output "Transparent logo exported from the governed source: $output"
