using System.Text.Json;

namespace NotesApp.Api.Infrastructure.Auth;

public sealed record GoogleUserInfo(string GoogleId, string Email, string DisplayName, string? AvatarUrl);

public interface IGoogleOAuthService
{
    /// <summary>
    /// Exchanges the OAuth 2.0 authorization code (obtained by the frontend redirect flow)
    /// for Google tokens, then retrieves and returns the authenticated user's profile.
    /// The client secret never leaves the backend.
    /// </summary>
    Task<GoogleUserInfo> ExchangeCodeAndGetProfileAsync(string code, string redirectUri);
}

public sealed class GoogleOAuthService : IGoogleOAuthService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public GoogleOAuthService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<GoogleUserInfo> ExchangeCodeAndGetProfileAsync(string code, string redirectUri)
    {
        var googleSection = _configuration.GetSection("Authentication:Google");
        var clientId = googleSection["ClientId"]!;
        var clientSecret = googleSection["ClientSecret"]!;

        using var http = _httpClientFactory.CreateClient();

        // Step 1: exchange authorization code for access_token / id_token
        var tokenResponse = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code"
        }));

        tokenResponse.EnsureSuccessStatusCode();
        await using var tokenStream = await tokenResponse.Content.ReadAsStreamAsync();
        using var tokenDoc = await JsonDocument.ParseAsync(tokenStream);
        var accessToken = tokenDoc.RootElement.GetProperty("access_token").GetString()!;

        // Step 2: fetch user profile using the access token
        using var profileRequest = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v3/userinfo");
        profileRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var profileResponse = await http.SendAsync(profileRequest);
        profileResponse.EnsureSuccessStatusCode();
        await using var profileStream = await profileResponse.Content.ReadAsStreamAsync();
        using var profileDoc = await JsonDocument.ParseAsync(profileStream);
        var root = profileDoc.RootElement;

        return new GoogleUserInfo(
            GoogleId: root.GetProperty("sub").GetString()!,
            Email: root.GetProperty("email").GetString()!,
            DisplayName: root.TryGetProperty("name", out var name) ? name.GetString()! : root.GetProperty("email").GetString()!,
            AvatarUrl: root.TryGetProperty("picture", out var picture) ? picture.GetString() : null);
    }
}
