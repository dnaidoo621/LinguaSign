using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using LinguaSign.Analysis.Domain;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LinguaSign.Analysis.Llm;

/// <summary>Classifies clause risk + explanation via an OpenAI-compatible chat endpoint (Ollama).</summary>
public class OllamaClauseAnalyzer(HttpClient http, IConfiguration config, ILogger<OllamaClauseAnalyzer> logger)
    : IClauseAnalyzer
{
    public string Model { get; } = config["Llm:Model"] ?? "qwen2.5-coder:14b";

    public async Task<IReadOnlyDictionary<Guid, ClauseAnalysis>> AnalyzeAsync(
        IReadOnlyList<ClauseInput> clauses, CancellationToken ct = default)
    {
        if (clauses.Count == 0) return new Dictionary<Guid, ClauseAnalysis>();

        var indexed = clauses.Select((c, i) => (Index: i + 1, c.BlockId, c.Text)).ToList();
        var itemsJson = JsonSerializer.Serialize(indexed.Select(x => new { id = x.Index, text = x.Text }));

        const string system =
            "You are a contract risk analyst helping a non-lawyer who is about to sign. " +
            "For each clause, assess the risk to the signer and explain it simply. " +
            "risk must be one of: none, low, medium, high. " +
            "type is a short UPPER_SNAKE tag (e.g. AUTO_RENEWAL, PENALTY, ARBITRATION, NON_COMPETE, " +
            "DEPOSIT, TERMINATION, LIABILITY, CONFIDENTIALITY, GOVERNING_LAW, or NONE). " +
            "explanation is ONE plain-language sentence on what it means for the signer. Be accurate, do not invent terms.";

        var user =
            "Analyze each clause. Respond ONLY with JSON of the form " +
            "{\"analyses\":[{\"id\":<id>,\"risk\":\"<none|low|medium|high>\",\"type\":\"<TAG>\",\"explanation\":\"<one sentence>\"}]}.\n\nClauses:\n" +
            itemsJson;

        var request = new
        {
            model = Model,
            messages = new[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user },
            },
            temperature = 0.1,
            response_format = new { type = "json_object" },
            stream = false,
        };

        using var resp = await http.PostAsJsonAsync("chat/completions", request, ct);
        resp.EnsureSuccessStatusCode();

        var completion = await resp.Content.ReadFromJsonAsync<ChatCompletion>(cancellationToken: ct);
        var content = completion?.Choices?.FirstOrDefault()?.Message?.Content ?? "{}";

        var byIndex = Parse(content);
        var result = new Dictionary<Guid, ClauseAnalysis>();
        foreach (var x in indexed)
            if (byIndex.TryGetValue(x.Index, out var a))
                result[x.BlockId] = a;

        if (result.Count < indexed.Count)
            logger.LogWarning("Analyzer returned {Got}/{Total} clauses", result.Count, indexed.Count);

        return result;
    }

    private static Dictionary<int, ClauseAnalysis> Parse(string content)
    {
        var map = new Dictionary<int, ClauseAnalysis>();
        try
        {
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("analyses", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in arr.EnumerateArray())
                {
                    if (!el.TryGetProperty("id", out var idEl)) continue;
                    var id = idEl.ValueKind == JsonValueKind.Number
                        ? idEl.GetInt32()
                        : int.TryParse(idEl.GetString(), out var p) ? p : -1;
                    if (id <= 0) continue;

                    var risk = el.TryGetProperty("risk", out var r) ? r.GetString() : "none";
                    var type = el.TryGetProperty("type", out var t) ? t.GetString() : "NONE";
                    var explanation = el.TryGetProperty("explanation", out var ex) ? ex.GetString() : "";

                    map[id] = new ClauseAnalysis(
                        ParseLevel(risk),
                        string.IsNullOrWhiteSpace(type) ? "NONE" : type!.Trim(),
                        explanation?.Trim() ?? "");
                }
            }
        }
        catch (JsonException) { /* leave empty; caller falls back to rules */ }
        return map;
    }

    private static RiskLevel ParseLevel(string? risk) => (risk ?? "").Trim().ToLowerInvariant() switch
    {
        "high" => RiskLevel.High,
        "medium" or "med" => RiskLevel.Medium,
        "low" => RiskLevel.Low,
        _ => RiskLevel.None,
    };

    private record ChatCompletion([property: JsonPropertyName("choices")] List<Choice>? Choices);
    private record Choice([property: JsonPropertyName("message")] Message? Message);
    private record Message([property: JsonPropertyName("content")] string? Content);
}
