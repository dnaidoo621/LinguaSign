using System.IO.Compression;
using System.Text;
using System.Text.Json;
using LinguaSign.Audit.Services;
using LinguaSign.Documents.Services;
using LinguaSign.Signing.Services;

namespace LinguaSign.Export;

public class ExportService(
    IDocumentService documents,
    ISigningService signing,
    IAuditService audit) : IExportService
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public async Task<ExportPackage?> BuildAuditPackageAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        var doc = await documents.GetAsync(userId, documentId, ct);
        if (doc is null) return null;

        var signature = await signing.GetAsync(userId, documentId, ct);
        var trail = await audit.GetTrailAsync(userId, documentId, ct);

        // Prefer the signed PDF if one exists; otherwise the original.
        var pdf = await signing.OpenSignedPdfAsync(userId, documentId, ct)
                  ?? await documents.OpenFileAsync(userId, documentId, ct);

        using var zipStream = new MemoryStream();
        using (var zip = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
        {
            if (pdf is not null)
            {
                var entry = zip.CreateEntry(pdf.FileName, CompressionLevel.Fastest);
                await using var es = entry.Open();
                await using (pdf.Stream)
                {
                    await pdf.Stream.CopyToAsync(es, ct);
                }
            }

            WriteJsonEntry(zip, "metadata.json", new
            {
                document = new
                {
                    doc.Id,
                    doc.FileName,
                    doc.Status,
                    doc.SourceLanguage,
                    doc.PageCount,
                    doc.CreatedAt,
                },
                signature,
                exportedAt = DateTimeOffset.UtcNow,
                disclaimer = "AI-assisted comprehension tool. Not certified legal translation or legal advice.",
            });

            WriteJsonEntry(zip, "audit.json", trail);
        }

        await audit.RecordAsync(userId, documentId, "ExportGenerated",
            detail: $"Audit package exported ({(signature is null ? "unsigned" : "signed")})", ct: ct);

        var baseName = Path.GetFileNameWithoutExtension(doc.FileName);
        return new ExportPackage(zipStream.ToArray(), $"{baseName}-linguasign-export.zip", "application/zip");
    }

    private static void WriteJsonEntry(ZipArchive zip, string name, object payload)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Fastest);
        using var es = entry.Open();
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, Json);
        es.Write(bytes, 0, bytes.Length);
    }
}
