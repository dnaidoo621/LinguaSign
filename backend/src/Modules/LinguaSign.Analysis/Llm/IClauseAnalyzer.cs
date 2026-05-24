using LinguaSign.Analysis.Domain;

namespace LinguaSign.Analysis.Llm;

public record ClauseInput(Guid BlockId, string Text);

public record ClauseAnalysis(RiskLevel Level, string Type, string Explanation);

/// <summary>LLM pass that classifies clause risk and produces a plain-language explanation.</summary>
public interface IClauseAnalyzer
{
    string Model { get; }

    Task<IReadOnlyDictionary<Guid, ClauseAnalysis>> AnalyzeAsync(
        IReadOnlyList<ClauseInput> clauses, CancellationToken ct = default);
}
