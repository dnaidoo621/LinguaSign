using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LinguaSign.Signing.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SigningDbContext>
{
    public SigningDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("LINGUASIGN_DB")
                   ?? "Host=localhost;Port=5432;Database=linguasign;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<SigningDbContext>().UseNpgsql(conn).Options;
        return new SigningDbContext(options);
    }
}
