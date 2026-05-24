using LinguaSign.Audit.Contracts;
using LinguaSign.Audit.Domain;
using LinguaSign.Audit.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LinguaSign.Audit.Services;

public class AuditService(AuditDbContext db) : IAuditService
{
    public async Task RecordAsync(
        string userId,
        Guid documentId,
        string eventType,
        string? detail = null,
        string? documentHash = null,
        string? model = null,
        CancellationToken ct = default)
    {
        db.Events.Add(new AuditEvent
        {
            UserId = userId,
            DocumentId = documentId,
            EventType = eventType,
            Detail = detail,
            DocumentHash = documentHash,
            Model = model,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AuditEventDto>> GetTrailAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        return await db.Events
            .AsNoTracking()
            .Where(e => e.DocumentId == documentId && e.UserId == userId)
            .OrderBy(e => e.CreatedAt)
            .Select(e => new AuditEventDto(e.Id, e.EventType, e.Detail, e.DocumentHash, e.Model, e.CreatedAt))
            .ToListAsync(ct);
    }
}
