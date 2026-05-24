using Microsoft.Extensions.DependencyInjection;

namespace LinguaSign.Export;

/// <summary>
/// Export module — signed PDF + audit package generation.
/// Uses PdfSharp/QuestPDF (not iText) for any PDF work. Builds the audit ZIP from
/// the document, signature, and audit trail.
/// </summary>
public static class ExportModule
{
    public static IServiceCollection AddExportModule(this IServiceCollection services)
    {
        services.AddScoped<IExportService, ExportService>();
        return services;
    }
}
