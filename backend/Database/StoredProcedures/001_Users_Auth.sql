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
CREATE OR ALTER PROCEDURE dbo.sp_User_Upsert
    @GoogleId    NVARCHAR(128),
    @Email       NVARCHAR(256),
    @DisplayName NVARCHAR(200),
    @AvatarUrl   NVARCHAR(1024) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.Users AS target
    USING (SELECT @GoogleId AS GoogleId) AS src
        ON target.GoogleId = src.GoogleId
    WHEN MATCHED THEN
        UPDATE SET Email = @Email,
                   DisplayName = @DisplayName,
                   AvatarUrl = @AvatarUrl,
                   UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (GoogleId, Email, DisplayName, AvatarUrl)
        VALUES (@GoogleId, @Email, @DisplayName, @AvatarUrl);

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
    SELECT TOP (1) rt.*, u.Email, u.DisplayName, u.PreferredLanguage
    FROM dbo.RefreshTokens rt
    INNER JOIN dbo.Users u ON u.Id = rt.UserId
    WHERE rt.TokenHash = @TokenHash
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
