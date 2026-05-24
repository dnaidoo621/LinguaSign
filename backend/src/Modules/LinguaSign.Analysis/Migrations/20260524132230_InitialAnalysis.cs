using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinguaSign.Analysis.Migrations
{
    /// <inheritdoc />
    public partial class InitialAnalysis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "analysis");

            migrationBuilder.CreateTable(
                name: "document_analyses",
                schema: "analysis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Model = table.Column<string>(type: "text", nullable: true),
                    Error = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_document_analyses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "clause_findings",
                schema: "analysis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentAnalysisId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceBlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    PageNumber = table.Column<int>(type: "integer", nullable: false),
                    RiskLevel = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RiskType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clause_findings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clause_findings_document_analyses_DocumentAnalysisId",
                        column: x => x.DocumentAnalysisId,
                        principalSchema: "analysis",
                        principalTable: "document_analyses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_clause_findings_DocumentAnalysisId",
                schema: "analysis",
                table: "clause_findings",
                column: "DocumentAnalysisId");

            migrationBuilder.CreateIndex(
                name: "IX_clause_findings_SourceBlockId",
                schema: "analysis",
                table: "clause_findings",
                column: "SourceBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_document_analyses_DocumentId_UserId",
                schema: "analysis",
                table: "document_analyses",
                columns: new[] { "DocumentId", "UserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "clause_findings",
                schema: "analysis");

            migrationBuilder.DropTable(
                name: "document_analyses",
                schema: "analysis");
        }
    }
}
