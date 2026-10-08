using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Localization;
using Microsoft.IdentityModel.Tokens;
using NotesApp.Api.Domain.Interfaces;
using NotesApp.Api.Controllers;
using NotesApp.Api.Hubs;
using NotesApp.Api.Infrastructure.Auth;
using NotesApp.Api.Infrastructure.Data;
using NotesApp.Api.Infrastructure.Data.Repositories;
using NotesApp.Api.Infrastructure.Realtime;
using NotesApp.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------- Localization (ES/EN) ----------
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var supportedCultures = new[] { "es", "en" };
    options.SetDefaultCulture(supportedCultures[0])
           .AddSupportedCultures(supportedCultures)
           .AddSupportedUICultures(supportedCultures);
});

// ---------- MVC / API ----------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// ---------- CORS (frontend dev server) ----------
const string FrontendCorsPolicy = "FrontendCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ---------- Data access (Dapper) ----------
builder.Services.AddSingleton<DapperContext>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IGroupRepository, GroupRepository>();
builder.Services.AddScoped<INodeRepository, NodeRepository>();
builder.Services.AddScoped<IPermissionRepository, PermissionRepository>();
builder.Services.AddScoped<IAuditRepository, AuditRepository>();
builder.Services.AddScoped<IFileRepository, FileRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();

// ---------- Auth infrastructure ----------
builder.Services.AddHttpClient();
builder.Services.AddScoped<IGoogleOAuthService, GoogleOAuthService>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

// ---------- Application services ----------
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INodeService, NodeService>();
builder.Services.AddScoped<IGroupService, GroupService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<IUserStatusService, UserStatusService>();
builder.Services.AddScoped<INoteContentService, NoteContentService>();

// ---------- Realtime ----------
builder.Services.AddSingleton<IYjsDocumentStore, YjsDocumentStore>();
builder.Services.AddSingleton<IPresenceTracker, PresenceTracker>();
builder.Services.AddSingleton<INoteConnectionTracker, NoteConnectionTracker>();
builder.Services.AddSingleton<INoteAccessEnforcer, NoteAccessEnforcer>();
// Only live deltas and awareness travel over the socket now (full snapshots go over HTTP), so a modest cap is plenty and bounds abuse.
builder.Services.AddSignalR(o => o.MaximumReceiveMessageSize = 4 * 1024 * 1024);

// Anonymous public-link endpoints: per-IP throttle so tokens cannot be brute-forced or the viewer scraped.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("public", httpContext => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions { PermitLimit = 240, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// ---------- JWT Authentication (HTTP + SignalR WebSocket) ----------
var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Secret"]!)),
            NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub
        };

        // SignalR sends the JWT via query string (?access_token=...) because
        // browsers cannot set custom headers on the WebSocket handshake.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Behind Cloudflare Tunnel TLS is terminated upstream; trust X-Forwarded-* headers.
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                     | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
};
forwardedOptions.KnownNetworks.Clear();
forwardedOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedOptions);

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (TermsNotAcceptedException ex) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = "terms_not_accepted", requiredVersion = ex.RequiredVersion });
    }
    catch (AccountBlockedException ex) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = "account_blocked" });
    }
    catch (Microsoft.Data.SqlClient.SqlException ex) when (!context.Response.HasStarted && ex.Number is 50003 or 50004 or 50005)
    {
        // 50003 = storage quota exceeded, 50004 = last super admin, 50005 = invalid quota.
        var (status, code) = ex.Number switch
        {
            50003 => (StatusCodes.Status413PayloadTooLarge, "quota_exceeded"),
            50004 => (StatusCodes.Status409Conflict, "last_admin"),
            _ => (StatusCodes.Status400BadRequest, "invalid_quota")
        };
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code });
    }
    catch (Microsoft.Data.SqlClient.SqlException ex) when (!context.Response.HasStarted && (ex.Number == 50001 || ex.Number == 50002))
    {
        // 50001 = duplicate sibling name, 50002 = empty name (raised by the Node stored procedures).
        context.Response.StatusCode = ex.Number == 50001 ? StatusCodes.Status409Conflict : StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = ex.Number == 50001 ? "duplicate_name" : "empty_name" });
    }
    catch (NoteTooLargeException ex) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = "note_too_large", maxBytes = ex.MaxBytes });
    }
    catch (SharingException ex) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = ex.Code });
    }
    catch (Microsoft.Data.SqlClient.SqlException ex) when (!context.Response.HasStarted && ex.Number is 50010 or 50011 or 50012)
    {
        // 50010 invalid access level, 50011 invalid e-mail, 50012 cannot share with the owner / yourself.
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = ex.Number switch { 50010 => "invalid_access", 50011 => "invalid_email", _ => "cannot_share_owner" } });
    }
    catch (KeyNotFoundException ex) when (!context.Response.HasStarted)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message, code = "not_found" });
    }
    catch (UnauthorizedAccessException ex) when (!context.Response.HasStarted)
    {
        var isAuthenticated = context.User.Identity?.IsAuthenticated == true;
        context.Response.StatusCode = isAuthenticated ? StatusCodes.Status403Forbidden : StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.UseRequestLocalization();
// No HTTPS redirection: dev goes through the Vite HTTP proxy and production sits behind
// Cloudflare Tunnel, which already terminates TLS (a redirect would drop Authorization).
app.UseCors(FrontendCorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();

// A valid token is not enough: the account must still be active. Checked against the database (30 s cache) so a block
// takes effect almost immediately, including for already-issued access tokens and for SignalR connections.
app.Use(async (context, next) =>
{
    var isAuthApi = context.Request.Path.StartsWithSegments("/api/auth");
    if (!isAuthApi && context.User.Identity?.IsAuthenticated == true)
    {
        var status = await context.RequestServices.GetRequiredService<IUserStatusService>().GetAsync(context.User.GetUserId());
        if (!status.Exists || !status.IsActive)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { error = "This account has been blocked.", code = "account_blocked" });
            return;
        }
    }
    await next();
});

app.UseAuthorization();

app.MapControllers();
app.MapHub<CollaborativeNoteHub>("/hubs/collaborative-note");
app.MapHub<PresenceHub>("/hubs/presence");

app.Run();
