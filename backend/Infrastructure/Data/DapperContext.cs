using System.Data;
using Microsoft.Data.SqlClient;

namespace NotesApp.Api.Infrastructure.Data;

/// <summary>
/// Factory for ADO.NET connections used by Dapper. Every query executed
/// through connections created here MUST invoke a Stored Procedure
/// (CommandType.StoredProcedure) -- no inline SQL is allowed per the
/// project's data-access constraint.
/// </summary>
public sealed class DapperContext
{
    private readonly string _connectionString;

    public DapperContext(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("SqlServer")
            ?? throw new InvalidOperationException("Missing 'SqlServer' connection string.");
    }

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
