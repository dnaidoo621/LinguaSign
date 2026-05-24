namespace LinguaSign.Analysis.Domain;

/// <summary>Risk classification + plain-language explanation for one clause (aligned to a source block).</summary>
public class ClauseFinding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentAnalysisId { get; set; }

    /// <summary>Loose ref to the source OCR block (drives the risk overlay).</summary>
    public Guid SourceBlockId { get; set; }
    public int PageNumber { get; set; }

    public RiskLevel RiskLevel { get; set; } = RiskLevel.None;

    /// <summary>e.g. "AUTO_RENEWAL", "PENALTY", "ARBITRATION", "NONE".</summary>
    public string RiskType { get; set; } = "NONE";

    /// <summary>Plain-language explanation of what the clause means for the signer.</summary>
    public string Explanation { get; set; } = string.Empty;

    public DocumentAnalysis Analysis { get; set; } = default!;
}
