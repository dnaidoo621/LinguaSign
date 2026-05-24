namespace LinguaSign.Audit.Contracts;

public record AuditEventDto(
    Guid Id,
    string EventType,
    string? Detail,
    string? DocumentHash,
    string? Model,
    DateTimeOffset CreatedAt);
