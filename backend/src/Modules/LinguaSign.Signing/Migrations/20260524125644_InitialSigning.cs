using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinguaSign.Signing.Migrations
{
    /// <inheritdoc />
    public partial class InitialSigning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "signing");

            migrationBuilder.CreateTable(
                name: "signatures",
                schema: "signing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    SignerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SignedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    OriginalHash = table.Column<string>(type: "text", nullable: false),
                    SignedHash = table.Column<string>(type: "text", nullable: false),
                    SignedStoragePath = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_signatures", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_signatures_DocumentId_UserId",
                schema: "signing",
                table: "signatures",
                columns: new[] { "DocumentId", "UserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "signatures",
                schema: "signing");
        }
    }
}
