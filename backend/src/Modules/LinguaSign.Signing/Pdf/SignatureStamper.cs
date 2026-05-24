using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf.IO;

namespace LinguaSign.Signing.Pdf;

/// <summary>Stamps a visible signature block onto the last page of a PDF.</summary>
public static class SignatureStamper
{
    static SignatureStamper()
    {
        GlobalFontSettings.FontResolver ??= new SimpleFontResolver();
    }

    public static byte[] Stamp(byte[] pdfBytes, string signerName, DateTimeOffset signedAt)
    {
        using var input = new MemoryStream(pdfBytes);
        using var doc = PdfReader.Open(input, PdfDocumentOpenMode.Modify);

        var page = doc.Pages[doc.Pages.Count - 1];
        using var gfx = XGraphics.FromPdfPage(page);

        const double margin = 36, boxW = 250, boxH = 72;
        var x = page.Width.Point - boxW - margin;
        var y = page.Height.Point - boxH - margin;

        gfx.DrawRectangle(new XPen(XColors.Gray, 0.75), XBrushes.White, x, y, boxW, boxH);

        var labelFont = new XFont("Arial", 7, XFontStyleEx.Bold);
        var nameFont = new XFont("Arial", 15);
        var metaFont = new XFont("Arial", 7);

        gfx.DrawString("ELECTRONICALLY SIGNED", labelFont, XBrushes.Gray,
            new XRect(x + 8, y + 6, boxW - 16, 10), XStringFormats.TopLeft);
        gfx.DrawString(signerName, nameFont, XBrushes.Black,
            new XRect(x + 8, y + 20, boxW - 16, 24), XStringFormats.TopLeft);
        gfx.DrawString($"{signedAt.UtcDateTime:yyyy-MM-dd HH:mm} UTC · via LinguaSign", metaFont, XBrushes.Gray,
            new XRect(x + 8, y + 48, boxW - 16, 10), XStringFormats.TopLeft);

        using var output = new MemoryStream();
        doc.Save(output);
        return output.ToArray();
    }
}
