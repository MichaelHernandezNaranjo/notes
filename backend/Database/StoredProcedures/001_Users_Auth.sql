-- =========================================================
-- SPs: Users & Refresh Tokens
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_User_GetByGoogleId
    @GoogleId NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (1) *
    FROM dbo.Users
    WHERE GoogleId = @GoogleId AND IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetById
    @Id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (1) *
    FROM dbo.Users
    WHERE Id = @Id AND IsActive = 1;
END
GO

-- Upsert: creates the user on first Google login, updates profile data on subsequent logins.
-- @TermsVersion is the Terms/Privacy version the user explicitly accepted at this login (recorded with a timestamp).
CREATE OR ALTER PROCEDURE dbo.sp_User_Upsert
    @GoogleId     NVARCHAR(128),
    @Email        NVARCHAR(256),
    @DisplayName  NVARCHAR(200),
    @AvatarUrl    NVARCHAR(1024) = NULL,
    @TermsVersion NVARCHAR(20)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.Users AS target
    USING (SELECT @GoogleId AS GoogleId) AS src
        ON target.GoogleId = src.GoogleId
    -- Blocked users (IsActive = 0) are matched but never updated: the caller sees IsActive = 0 and refuses the login.
    WHEN MATCHED AND target.IsActive = 1 THEN
        UPDATE SET Email = @Email,
                   DisplayName = @DisplayName,
                   AvatarUrl = @AvatarUrl,
                   -- Keep the original acceptance date while the accepted version is unchanged.
                   TermsAcceptedAt = CASE WHEN @TermsVersion IS NOT NULL AND ISNULL(target.TermsAcceptedVersion, N'') <> @TermsVersion
                                          THEN SYSUTCDATETIME() ELSE target.TermsAcceptedAt END,
                   TermsAcceptedVersion = ISNULL(@TermsVersion, target.TermsAcceptedVersion),
                   LastLoginAt = SYSUTCDATETIME(),
                   LastSeenAt = SYSUTCDATETIME(),
                   UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (GoogleId, Email, DisplayName, AvatarUrl, TermsAcceptedVersion, TermsAcceptedAt, LastLoginAt, LastSeenAt)
        VALUES (@GoogleId, @Email, @DisplayName, @AvatarUrl, @TermsVersion,
                CASE WHEN @TermsVersion IS NULL THEN NULL ELSE SYSUTCDATETIME() END,
                SYSUTCDATETIME(), SYSUTCDATETIME());

    SELECT TOP (1) * FROM dbo.Users WHERE GoogleId = @GoogleId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_UpdatePreferredLanguage
    @UserId  UNIQUEIDENTIFIER,
    @Language NVARCHAR(5)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
    SET PreferredLanguage = @Language, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Create
    @UserId    UNIQUEIDENTIFIER,
    @TokenHash NVARCHAR(256),
    @ExpiresAt DATETIME2(3)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt)
    VALUES (@UserId, @TokenHash, @ExpiresAt);

    SELECT TOP (1) * FROM dbo.RefreshTokens WHERE TokenHash = @TokenHash;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Validate
    @TokenHash NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    -- Renewing a session counts as activity (throttled to once every 2 minutes).
    UPDATE u SET LastSeenAt = SYSUTCDATETIME()
    FROM dbo.Users u INNER JOIN dbo.RefreshTokens rt ON rt.UserId = u.Id
    WHERE rt.TokenHash = @TokenHash AND rt.RevokedAt IS NULL AND u.IsActive = 1
      AND (u.LastSeenAt IS NULL OR u.LastSeenAt < DATEADD(MINUTE, -2, SYSUTCDATETIME()));

    SELECT TOP (1) rt.*, u.Email, u.DisplayName, u.PreferredLanguage
    FROM dbo.RefreshTokens rt
    INNER JOIN dbo.Users u ON u.Id = rt.UserId
    WHERE rt.TokenHash = @TokenHash
      AND u.IsActive = 1
      AND rt.RevokedAt IS NULL
      AND rt.ExpiresAt > SYSUTCDATETIME();
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_Revoke
    @TokenHash NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens
    SET RevokedAt = SYSUTCDATETIME()
    WHERE TokenHash = @TokenHash;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken_RevokeAllForUser
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.RefreshTokens
    SET RevokedAt = SYSUTCDATETIME()
    WHERE UserId = @UserId AND RevokedAt IS NULL;
END
GO
