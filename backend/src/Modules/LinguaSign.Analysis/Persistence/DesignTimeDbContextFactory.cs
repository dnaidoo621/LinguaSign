using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LinguaSign.Analysis.Persistence;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AnalysisDbContext>
{
    public AnalysisDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("LINGUASIGN_DB")
                   ?? "Host=localhost;Port=5432;Database=linguasign;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AnalysisDbContext>().UseNpgsql(conn).Options;
        return new AnalysisDbContext(options);
    }
}
