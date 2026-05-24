using LinguaSign.Audit.Persistence;
using LinguaSign.Audit.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LinguaSign.Audit;

/// <summary>
/// Audit module — append-only audit trail (hashes, timestamps, signer identity, model versions).
/// </summary>
public static class AuditModule
{
    public static IServiceCollection AddAuditModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AuditDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Postgres")));

        services.AddScoped<IAuditService, AuditService>();

        return services;
    }
}
