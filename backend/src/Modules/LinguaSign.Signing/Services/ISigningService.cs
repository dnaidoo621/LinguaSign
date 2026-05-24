using LinguaSign.Documents.Services;
using LinguaSign.Signing.Contracts;

namespace LinguaSign.Signing.Services;

public interface ISigningService
{
    Task<SignatureDto> SignAsync(string userId, Guid documentId, SignRequest request, string? ip, string? userAgent, CancellationToken ct = default);
    Task<SignatureDto?> GetAsync(string userId, Guid documentId, CancellationToken ct = default);
    Task<DocumentFile?> OpenSignedPdfAsync(string userId, Guid documentId, CancellationToken ct = default);
}
