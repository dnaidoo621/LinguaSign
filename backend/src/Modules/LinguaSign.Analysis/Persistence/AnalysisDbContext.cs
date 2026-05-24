using LinguaSign.Analysis.Domain;
using Microsoft.EntityFrameworkCore;

namespace LinguaSign.Analysis.Persistence;

public class AnalysisDbContext(DbContextOptions<AnalysisDbContext> options) : DbContext(options)
{
    public DbSet<DocumentAnalysis> Analyses => Set<DocumentAnalysis>();
    public DbSet<ClauseFinding> Findings => Set<ClauseFinding>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("analysis");

        b.Entity<DocumentAnalysis>(e =>
        {
            e.ToTable("document_analyses");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.DocumentId, x.UserId });
            e.HasMany(x => x.Findings)
                .WithOne(f => f.Analysis)
                .HasForeignKey(f => f.DocumentAnalysisId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ClauseFinding>(e =>
        {
            e.ToTable("clause_findings");
            e.HasKey(x => x.Id);
            e.Property(x => x.RiskLevel).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.RiskType).HasMaxLength(40);
            e.HasIndex(x => x.DocumentAnalysisId);
            e.HasIndex(x => x.SourceBlockId);
        });
    }
}
