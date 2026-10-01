using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Localization;
using Microsoft.IdentityModel.Tokens;
using NotesApp.Api.Domain.Interfaces;
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

// ---------- Auth infrastructure ----------
builder.Services.AddHttpClient();
builder.Services.AddScoped<IGoogleOAuthService, GoogleOAuthService>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

// ---------- Application services ----------
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INodeService, NodeService>();
builder.Services.AddScoped<IGroupService, GroupService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();

// ---------- Realtime ----------
builder.Services.AddSingleton<IYjsDocumentStore, YjsDocumentStore>();
builder.Services.AddSignalR();

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
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<CollaborativeNoteHub>("/hubs/collaborative-note");

app.Run();
