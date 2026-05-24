using System.Security.Cryptography;
using LinguaSign.Audit.Services;
using LinguaSign.Documents.Services;
using LinguaSign.Documents.Storage;
using LinguaSign.Signing.Contracts;
using LinguaSign.Signing.Domain;
using LinguaSign.Signing.Pdf;
using LinguaSign.Signing.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LinguaSign.Signing.Services;

public class SigningService(
    SigningDbContext db,
    IDocumentService documents,
    IDocumentStorage storage,
    IAuditService audit,
    ILogger<SigningService> logger) : ISigningService
{
    public async Task<SignatureDto> SignAsync(
        string userId, Guid documentId, SignRequest request, string? ip, string? userAgent, CancellationToken ct = default)
    {
        var doc = await documents.GetAsync(userId, documentId, ct)
                  ?? throw new InvalidOperationException("Document not found.");

        var file = await documents.OpenFileAsync(userId, documentId, ct)
                   ?? throw new InvalidOperationException("Document file not found.");

        byte[] original;
        await using (file.Stream)
        {
            using var ms = new MemoryStream();
            await file.Stream.CopyToAsync(ms, ct);
            original = ms.ToArray();
        }

        var originalHash = Hash(original);
        var signerName = string.IsNullOrWhiteSpace(request.SignerName) ? "Unknown signer" : request.SignerName.Trim();
        var signedAt = DateTimeOffset.UtcNow;

        var signedBytes = SignatureStamper.Stamp(original, signerName, signedAt);
        var signedHash = Hash(signedBytes);

        var key = $"{userId}/{documentId}/signed.pdf";
        await storage.SaveAsync(key, new MemoryStream(signedBytes), ct);

        // One active signature per (document, user) — replace on re-sign.
        await db.Signatures.Where(s => s.DocumentId == documentId && s.UserId == userId).ExecuteDeleteAsync(ct);

        var sig = new Signature
        {
            DocumentId = documentId,
            UserId = userId,
            SignerName = signerName,
            Type = string.IsNullOrWhiteSpace(request.Type) ? "Typed" : request.Type!,
            SignedAt = signedAt,
            IpAddress = ip,
            UserAgent = userAgent,
            OriginalHash = originalHash,
            SignedHash = signedHash,
            SignedStoragePath = key,
        };
        db.Signatures.Add(sig);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            userId, documentId, "Signed",
            detail: $"Signed by {signerName} ({sig.Type}) from {ip ?? "unknown"}",
            documentHash: signedHash, ct: ct);

        logger.LogInformation("Document {DocumentId} signed by {Signer}", documentId, signerName);
        return ToDto(sig);
    }

    public async Task<SignatureDto?> GetAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        var sig = await db.Signatures.AsNoTracking()
            .Where(s => s.DocumentId == documentId && s.UserId == userId)
            .OrderByDescending(s => s.SignedAt)
            .FirstOrDefaultAsync(ct);
        return sig is null ? null : ToDto(sig);
    }

    public async Task<DocumentFile?> OpenSignedPdfAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        var sig = await db.Signatures.AsNoTracking()
            .Where(s => s.DocumentId == documentId && s.UserId == userId)
            .OrderByDescending(s => s.SignedAt)
            .FirstOrDefaultAsync(ct);
        if (sig is null) return null;

        var stream = await storage.OpenReadAsync(sig.SignedStoragePath, ct);
        var doc = await documents.GetAsync(userId, documentId, ct);
        var name = doc is null
            ? "signed.pdf"
            : $"{Path.GetFileNameWithoutExtension(doc.FileName)}-signed.pdf";
        return new DocumentFile(stream, name);
    }

    private static string Hash(byte[] bytes)
        => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static SignatureDto ToDto(Signature s)
        => new(s.Id, s.DocumentId, s.SignerName, s.Type, s.SignedAt, s.SignedHash);
}
