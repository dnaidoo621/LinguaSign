namespace LinguaSign.Analysis.Domain;

/// <summary>A risk-analysis pass over a document's clauses.</summary>
public class DocumentAnalysis
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public string UserId { get; set; } = default!;

    public AnalysisStatus Status { get; set; } = AnalysisStatus.Pending;
    public string? Model { get; set; }
    public string? Error { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<ClauseFinding> Findings { get; set; } = [];
}
