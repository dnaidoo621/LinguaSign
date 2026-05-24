using LinguaSign.Analysis.Contracts;
using LinguaSign.Analysis.Domain;
using LinguaSign.Analysis.Persistence;
using LinguaSign.Documents.Services;
using Microsoft.EntityFrameworkCore;

namespace LinguaSign.Analysis.Services;

public class AnalysisService(AnalysisDbContext db, IDocumentService documents) : IAnalysisService
{
    public async Task<AnalysisSummary> StartAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        var doc = await documents.GetAsync(userId, documentId, ct)
                  ?? throw new InvalidOperationException("Document not found.");
        if (!string.Equals(doc.Status, "Extracted", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Document is not ready for analysis (status: {doc.Status}).");

        var existing = await db.Analyses.FirstOrDefaultAsync(a => a.DocumentId == documentId && a.UserId == userId, ct);
        if (existing is null)
        {
            existing = new DocumentAnalysis { DocumentId = documentId, UserId = userId, Status = AnalysisStatus.Pending };
            db.Analyses.Add(existing);
        }
        else
        {
            await db.Findings.Where(f => f.DocumentAnalysisId == existing.Id).ExecuteDeleteAsync(ct);
            existing.Status = AnalysisStatus.Pending;
            existing.Error = null;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return new AnalysisSummary(existing.Id, existing.DocumentId, existing.Status.ToString(), existing.Model, existing.CreatedAt);
    }

    public async Task<AnalysisDetail?> GetAsync(string userId, Guid documentId, CancellationToken ct = default)
    {
        var a = await db.Analyses
            .AsNoTracking()
            .Include(x => x.Findings.OrderBy(f => f.PageNumber))
            .FirstOrDefaultAsync(x => x.DocumentId == documentId && x.UserId == userId, ct);
        if (a is null) return null;

        var findings = a.Findings
            .Select(f => new ClauseFindingDto(f.SourceBlockId, f.PageNumber, f.RiskLevel.ToString(), f.RiskType, f.Explanation))
            .ToList();

        return new AnalysisDetail(a.Id, a.DocumentId, a.Status.ToString(), a.Model, a.Error, findings);
    }
}
