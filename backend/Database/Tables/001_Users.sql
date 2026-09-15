-- =========================================================
-- Table: Users
-- Idempotent creation script
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE dbo.Users
    (
        Id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_Id DEFAULT NEWID(),
        GoogleId          NVARCHAR(128)    NOT NULL,
        Email             NVARCHAR(256)    NOT NULL,
        DisplayName       NVARCHAR(200)    NOT NULL,
        AvatarUrl         NVARCHAR(1024)   NULL,
        PreferredLanguage NVARCHAR(5)      NOT NULL CONSTRAINT DF_Users_Lang DEFAULT ('es'),
        IsActive          BIT              NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id)
    );

    CREATE UNIQUE INDEX UX_Users_GoogleId ON dbo.Users (GoogleId);
    CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (Email);
END
GO
