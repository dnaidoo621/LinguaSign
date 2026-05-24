namespace LinguaSign.Analysis.Domain;

public enum AnalysisStatus
{
    Pending = 0,
    Analyzing = 1,
    Completed = 2,
    Failed = 3,
}

public enum RiskLevel
{
    None = 0,
    Low = 1,
    Medium = 2,
    High = 3,
}
