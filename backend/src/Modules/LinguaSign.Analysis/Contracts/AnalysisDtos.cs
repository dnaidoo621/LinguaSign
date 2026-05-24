namespace LinguaSign.Analysis.Contracts;

public record AnalysisSummary(Guid Id, Guid DocumentId, string Status, string? Model, DateTimeOffset CreatedAt);

public record ClauseFindingDto(
    Guid SourceBlockId,
    int PageNumber,
    string RiskLevel,
    string RiskType,
    string Explanation);

public record AnalysisDetail(
    Guid Id,
    Guid DocumentId,
    string Status,
    string? Model,
    string? Error,
    IReadOnlyList<ClauseFindingDto> Findings);
