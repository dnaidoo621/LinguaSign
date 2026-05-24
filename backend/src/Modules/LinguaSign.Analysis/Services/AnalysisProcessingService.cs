using LinguaSign.Analysis.Domain;
using LinguaSign.Analysis.Llm;
using LinguaSign.Analysis.Persistence;
using LinguaSign.Analysis.Rules;
using LinguaSign.Audit.Services;
using LinguaSign.Documents.Services;
using LinguaSign.Translation.Services;
using Microsoft.Extensions.Logging;

namespace LinguaSign.Analysis.Services;

public interface IAnalysisProcessingService
{
    Task ProcessAsync(Guid analysisId, CancellationToken ct = default);
}

public class AnalysisProcessingService(
    AnalysisDbContext db,
    IDocumentService documents,
    ITranslationService translations,
    IClauseAnalyzer analyzer,
    IAuditService audit,
    ILogger<AnalysisProcessingService> logger) : IAnalysisProcessingService
{
    public async Task ProcessAsync(Guid analysisId, CancellationToken ct = default)
    {
        var analysis = await db.Analyses.FindAsync([analysisId], ct);
        if (analysis is null)
        {
            logger.LogWarning("Analysis job: {Id} not found", analysisId);
            return;
        }

        try
        {
            analysis.Status = AnalysisStatus.Analyzing;
            analysis.Model = analyzer.Model;
            analysis.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            var doc = await documents.GetAsync(analysis.UserId, analysis.DocumentId, ct)
                      ?? throw new InvalidOperationException("Source document not found.");

            // Prefer the English translation for analysis; fall back to source text.
            var translation = await translations.GetAsync(analysis.UserId, analysis.DocumentId, "en", ct);
            var translatedByBlock = translation?.Segments
                .ToDictionary(s => s.SourceBlockId, s => s.TranslatedText)
                ?? new Dictionary<Guid, string>();

            var highCount = 0;
            foreach (var page in doc.Pages)
            {
                var blocks = page.Blocks.Where(b => !string.IsNullOrWhiteSpace(b.Text)).ToList();
                if (blocks.Count == 0) continue;

                var clauses = blocks
                    .Select(b => new ClauseInput(b.Id, translatedByBlock.GetValueOrDefault(b.Id, b.Text)))
                    .ToList();

                var llm = await analyzer.AnalyzeAsync(clauses, ct);

                foreach (var b in blocks)
                {
                    var text = translatedByBlock.GetValueOrDefault(b.Id, b.Text);
                    var (ruleLevel, ruleType) = RiskRules.Detect(text);
                    llm.TryGetValue(b.Id, out var la);

                    var level = (RiskLevel)Math.Max((int)ruleLevel, (int)(la?.Level ?? RiskLevel.None));
                    var type = la is { Level: > RiskLevel.None }
                        ? la.Type
                        : ruleLevel > RiskLevel.None ? ruleType : la?.Type ?? "NONE";
                    var explanation = !string.IsNullOrWhiteSpace(la?.Explanation)
                        ? la!.Explanation
                        : level > RiskLevel.None
                            ? $"Flagged as {type} ({level} risk)."
                            : "No notable risk detected in this clause.";

                    if (level == RiskLevel.High) highCount++;

                    db.Findings.Add(new ClauseFinding
                    {
                        DocumentAnalysisId = analysis.Id,
                        SourceBlockId = b.Id,
                        PageNumber = page.Number,
                        RiskLevel = level,
                        RiskType = type,
                        Explanation = explanation,
                    });
                }
            }

            analysis.Status = AnalysisStatus.Completed;
            analysis.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            await audit.RecordAsync(analysis.UserId, analysis.DocumentId, "RiskAnalyzed",
                detail: $"{highCount} high-risk clause(s) flagged", model: analysis.Model, ct: ct);

            logger.LogInformation("Analysis {Id} completed ({High} high-risk)", analysisId, highCount);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Analysis failed for {Id}", analysisId);
            analysis.Status = AnalysisStatus.Failed;
            analysis.Error = ex.Message;
            analysis.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }
}
