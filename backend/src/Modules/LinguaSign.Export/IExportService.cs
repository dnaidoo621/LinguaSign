namespace LinguaSign.Export;

public record ExportPackage(byte[] Content, string FileName, string ContentType);

public interface IExportService
{
    /// <summary>Builds an audit-package ZIP: the (signed or original) PDF + audit log + metadata.</summary>
    Task<ExportPackage?> BuildAuditPackageAsync(string userId, Guid documentId, CancellationToken ct = default);
}
