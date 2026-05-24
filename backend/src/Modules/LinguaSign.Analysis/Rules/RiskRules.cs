using LinguaSign.Analysis.Domain;

namespace LinguaSign.Analysis.Rules;

/// <summary>
/// Deterministic keyword rules for known dangerous clause types. Runs on the (English)
/// clause text and is merged with the LLM classification — rules guard against the LLM
/// missing a high-risk clause (false negatives are the worst outcome for a trust product).
/// </summary>
public static class RiskRules
{
    private record Rule(string Type, RiskLevel Level, string[] Keywords);

    // Ordered by priority — first match wins.
    private static readonly Rule[] Rules =
    [
        new("AUTO_RENEWAL", RiskLevel.High,
            ["automatically renew", "auto-renew", "automatic renewal", "renews automatically"]),
        new("PENALTY", RiskLevel.High,
            ["penalty", "liquidated damages", "late fee", "forfeit"]),
        new("NON_COMPETE", RiskLevel.High,
            ["non-compete", "non compete", "noncompete", "restraint of trade"]),
        new("LIABILITY", RiskLevel.High,
            ["limitation of liability", "not be liable", "hold harmless", "indemnif", "waive", "waiver"]),
        new("ARBITRATION", RiskLevel.Medium,
            ["arbitration", "arbitrate"]),
        new("TERMINATION", RiskLevel.Medium,
            ["terminate", "termination"]),
        new("DEPOSIT", RiskLevel.Medium,
            ["security deposit", "deposit"]),
        new("CONFIDENTIALITY", RiskLevel.Low,
            ["confidential", "non-disclosure", "nondisclosure"]),
        new("GOVERNING_LAW", RiskLevel.Low,
            ["governing law", "jurisdiction"]),
    ];

    public static (RiskLevel Level, string Type) Detect(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return (RiskLevel.None, "NONE");
        var lower = text.ToLowerInvariant();
        foreach (var rule in Rules)
            if (rule.Keywords.Any(lower.Contains))
                return (rule.Level, rule.Type);
        return (RiskLevel.None, "NONE");
    }
}
