namespace LinguaSign.Signing.Domain;

/// <summary>An electronic signature applied to a document, with evidentiary metadata.</summary>
public class Signature
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public string UserId { get; set; } = default!;

    public string SignerName { get; set; } = default!;

    /// <summary>"Typed", "Drawn", or "Uploaded".</summary>
    public string Type { get; set; } = "Typed";

    public DateTimeOffset SignedAt { get; set; } = DateTimeOffset.UtcNow;

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    /// <summary>SHA-256 of the original document at signing time.</summary>
    public string OriginalHash { get; set; } = default!;

    /// <summary>SHA-256 of the produced signed document.</summary>
    public string SignedHash { get; set; } = default!;

    /// <summary>Storage key of the signed PDF.</summary>
    public string SignedStoragePath { get; set; } = default!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
