using LinguaSign.Audit.Contracts;

namespace LinguaSign.Audit.Services;

/// <summary>Append-only audit trail. Other modules record events here.</summary>
public interface IAuditService
{
    Task RecordAsync(
        string userId,
        Guid documentId,
        string eventType,
        string? detail = null,
        string? documentHash = null,
        string? model = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<AuditEventDto>> GetTrailAsync(string userId, Guid documentId, CancellationToken ct = default);
}
