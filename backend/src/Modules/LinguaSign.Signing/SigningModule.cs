using LinguaSign.Signing.Persistence;
using LinguaSign.Signing.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LinguaSign.Signing;

/// <summary>
/// Signing module — electronic signature workflow (visible stamp + evidentiary metadata).
/// MVP: simple in-app signatures. Documenso/AES is the post-validation upgrade path.
/// </summary>
public static class SigningModule
{
    public static IServiceCollection AddSigningModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<SigningDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Postgres")));

        services.AddScoped<ISigningService, SigningService>();

        return services;
    }
}
