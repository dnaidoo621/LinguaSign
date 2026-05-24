using PdfSharp.Fonts;

namespace LinguaSign.Signing.Pdf;

/// <summary>
/// Minimal PdfSharp font resolver — PdfSharp 6 needs a resolver to embed fonts.
/// Returns one Unicode-capable system TTF for all faces (enough for a signature stamp).
/// </summary>
public class SimpleFontResolver : IFontResolver
{
    private static readonly byte[] FontData = Load();

    public byte[]? GetFont(string faceName) => FontData;

    public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
        => new FontResolverInfo("LinguaSignFont");

    private static byte[] Load()
    {
        string[] candidates =
        [
            "/Library/Fonts/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ];
        foreach (var path in candidates)
            if (File.Exists(path)) return File.ReadAllBytes(path);

        throw new FileNotFoundException("No usable TTF font found for PDF signature stamping.");
    }
}
