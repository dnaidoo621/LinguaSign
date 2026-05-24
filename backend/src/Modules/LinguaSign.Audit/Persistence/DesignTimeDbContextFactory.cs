using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LinguaSign.Audit.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AuditDbContext>
{
    public AuditDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("LINGUASIGN_DB")
                   ?? "Host=localhost;Port=5432;Database=linguasign;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AuditDbContext>().UseNpgsql(conn).Options;
        return new AuditDbContext(options);
    }
}
