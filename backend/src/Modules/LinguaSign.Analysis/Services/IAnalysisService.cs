using LinguaSign.Analysis.Contracts;

namespace LinguaSign.Analysis.Services;

public interface IAnalysisService
{
    Task<AnalysisSummary> StartAsync(string userId, Guid documentId, CancellationToken ct = default);
    Task<AnalysisDetail?> GetAsync(string userId, Guid documentId, CancellationToken ct = default);
}
