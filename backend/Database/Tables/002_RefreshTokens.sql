-- =========================================================
-- Table: RefreshTokens
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RefreshTokens')
BEGIN
    CREATE TABLE dbo.RefreshTokens
    (
        Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RefreshTokens_Id DEFAULT NEWID(),
        UserId     UNIQUEIDENTIFIER NOT NULL,
        TokenHash  NVARCHAR(256)    NOT NULL,
        ExpiresAt  DATETIME2(3)     NOT NULL,
        RevokedAt  DATETIME2(3)     NULL,
        CreatedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RefreshTokens PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_RefreshTokens_UserId ON dbo.RefreshTokens (UserId);
    CREATE UNIQUE INDEX UX_RefreshTokens_TokenHash ON dbo.RefreshTokens (TokenHash);
END
GO
