using LinguaSign.Audit.Domain;
using Microsoft.EntityFrameworkCore;

namespace LinguaSign.Audit.Persistence;

public class AuditDbContext(DbContextOptions<AuditDbContext> options) : DbContext(options)
{
    public DbSet<AuditEvent> Events => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("audit");

        b.Entity<AuditEvent>(e =>
        {
            e.ToTable("audit_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).IsRequired();
            e.Property(x => x.EventType).IsRequired().HasMaxLength(64);
            e.HasIndex(x => new { x.DocumentId, x.CreatedAt });
        });
    }
}
