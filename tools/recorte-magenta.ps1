# Recorta fundo magenta (#FF00FF) de um sprite e salva PNG transparente aparado.
# Uso: powershell -File tools/recorte-magenta.ps1 -In entrada.png -Out saida.png
param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$Out)

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class Magenta {
  static int C(int v){ return v<0?0:(v>255?255:v); }
  public static void Run(string src, string dst){
    Bitmap b0 = new Bitmap(src);
    Bitmap b = new Bitmap(b0.Width, b0.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(b)) g.DrawImage(b0, 0, 0, b0.Width, b0.Height);
    b0.Dispose();
    int w=b.Width, h=b.Height, minX=w, minY=h, maxX=-1, maxY=-1;
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){
      Color p=b.GetPixel(x,y);
      int r=p.R, gg=p.G, bl=p.B;
      // "magenta-ness": quanto R e B superam G
      int m = Math.Min(r,bl) - gg;
      int a = 255;
      if (m > 150 && Math.Abs(r-bl) < 90) a = 0;
      else if (m > 60) a = C(255 - (m-60)*255/90);
      if (a < 255 && a > 0 || (m > 25 && a==255)) {
        // despill: puxa R e B em direção ao G
        int lim = gg + Math.Max(0, Math.Min(r,bl) - gg) / 3;
        if (r > lim && bl > lim) { r = Math.Min(r, Math.Max(gg, (r+gg)/2)); bl = Math.Min(bl, Math.Max(gg, (bl+gg)/2)); }
      }
      b.SetPixel(x,y, Color.FromArgb(a, C(r), C(gg), C(bl)));
      if (a > 20){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
    }
    if (maxX < 0) throw new Exception("imagem vazia apos recorte");
    int pad=2; minX=Math.Max(0,minX-pad); minY=Math.Max(0,minY-pad); maxX=Math.Min(w-1,maxX+pad); maxY=Math.Min(h-1,maxY+pad);
    Bitmap o = b.Clone(new Rectangle(minX,minY,maxX-minX+1,maxY-minY+1), PixelFormat.Format32bppArgb);
    o.Save(dst, ImageFormat.Png);
    Console.WriteLine(dst + " " + o.Width + "x" + o.Height);
    o.Dispose(); b.Dispose();
  }
}
"@
[Magenta]::Run((Resolve-Path $In).Path, [IO.Path]::GetFullPath($Out))
