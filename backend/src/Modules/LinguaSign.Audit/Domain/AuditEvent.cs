namespace LinguaSign.Audit.Domain;

/// <summary>An immutable, append-only record of something that happened to a document.</summary>
public class AuditEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public string UserId { get; set; } = default!;

    /// <summary>e.g. "Signed", "ExportGenerated".</summary>
    public string EventType { get; set; } = default!;

    /// <summary>Optional human/JSON detail.</summary>
    public string? Detail { get; set; }

    /// <summary>Hash of the document at the time of the event (traceability).</summary>
    public string? DocumentHash { get; set; }

    /// <summary>Relevant model/version (e.g. translation model), if applicable.</summary>
    public string? Model { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
