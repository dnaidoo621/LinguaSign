namespace LinguaSign.Signing.Contracts;

public record SignRequest(string SignerName, string? Type, string? ImageDataUrl);

public record SignatureDto(
    Guid Id,
    Guid DocumentId,
    string SignerName,
    string Type,
    DateTimeOffset SignedAt,
    string SignedHash);
