using LinguaSign.Signing.Domain;
using Microsoft.EntityFrameworkCore;

namespace LinguaSign.Signing.Persistence;

public class SigningDbContext(DbContextOptions<SigningDbContext> options) : DbContext(options)
{
    public DbSet<Signature> Signatures => Set<Signature>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("signing");

        b.Entity<Signature>(e =>
        {
            e.ToTable("signatures");
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).IsRequired();
            e.Property(x => x.SignerName).IsRequired().HasMaxLength(200);
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.OriginalHash).IsRequired();
            e.Property(x => x.SignedHash).IsRequired();
            e.Property(x => x.SignedStoragePath).IsRequired();
            e.HasIndex(x => new { x.DocumentId, x.UserId });
        });
    }
}
