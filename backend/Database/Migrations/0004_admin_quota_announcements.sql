-- =========================================================
-- Administration: roles, blocking, last access, storage quotas, announcements.
-- Applied once by db-init (versioned migration); never edit after it has been deployed.
-- =========================================================

-- ---------- Users ----------
IF COL_LENGTH('dbo.Users', 'IsSuperAdmin') IS NULL
    ALTER TABLE dbo.Users ADD IsSuperAdmin BIT NOT NULL CONSTRAINT DF_Users_IsSuperAdmin DEFAULT (0);
GO
IF COL_LENGTH('dbo.Users', 'BlockedAt') IS NULL
    ALTER TABLE dbo.Users ADD BlockedAt DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.Users', 'BlockReason') IS NULL
    ALTER TABLE dbo.Users ADD BlockReason NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.Users', 'LastLoginAt') IS NULL
    ALTER TABLE dbo.Users ADD LastLoginAt DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.Users', 'LastSeenAt') IS NULL
    ALTER TABLE dbo.Users ADD LastSeenAt DATETIME2(3) NULL;
GO
-- NULL = use the default quota (dbo.AppSettings 'Storage.DefaultQuotaBytes').
IF COL_LENGTH('dbo.Users', 'StorageQuotaBytes') IS NULL
    ALTER TABLE dbo.Users ADD StorageQuotaBytes BIGINT NULL;
GO

-- Existing users: approximate last access with their most recent token (login or refresh).
UPDATE u
SET LastLoginAt = x.LastToken, LastSeenAt = x.LastToken
FROM dbo.Users u
INNER JOIN (SELECT UserId, MAX(CreatedAt) AS LastToken FROM dbo.RefreshTokens GROUP BY UserId) x ON x.UserId = u.Id
WHERE u.LastLoginAt IS NULL;
GO

-- ---------- Nodes: size of the stored text (Yjs state + JSON) ----------
IF COL_LENGTH('dbo.Nodes', 'ContentSizeBytes') IS NULL
    ALTER TABLE dbo.Nodes ADD ContentSizeBytes BIGINT NOT NULL CONSTRAINT DF_Nodes_ContentSizeBytes DEFAULT (0);
GO
UPDATE dbo.Nodes
SET ContentSizeBytes = ISNULL(DATALENGTH(ContentYjsState), 0) + ISNULL(DATALENGTH(ContentJson), 0)
WHERE ContentSizeBytes = 0 AND (ContentYjsState IS NOT NULL OR ContentJson IS NOT NULL);
GO

-- ---------- Application settings ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AppSettings')
BEGIN
    CREATE TABLE dbo.AppSettings
    (
        SettingKey   NVARCHAR(100) NOT NULL,
        SettingValue NVARCHAR(400) NOT NULL,
        CONSTRAINT PK_AppSettings PRIMARY KEY CLUSTERED (SettingKey)
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM dbo.AppSettings WHERE SettingKey = N'Storage.DefaultQuotaBytes')
    INSERT dbo.AppSettings (SettingKey, SettingValue) VALUES (N'Storage.DefaultQuotaBytes', N'262144000'); -- 250 MB
GO

-- ---------- Announcements ----------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Announcements')
BEGIN
    CREATE TABLE dbo.Announcements
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Announcements_Id DEFAULT NEWID(),
        Title        NVARCHAR(200)    NOT NULL,
        Message      NVARCHAR(2000)   NOT NULL,
        Severity     NVARCHAR(10)     NOT NULL CONSTRAINT DF_Announcements_Severity DEFAULT ('Info'),
        TargetUserId UNIQUEIDENTIFIER NULL,   -- NULL = everyone
        CreatedBy    UNIQUEIDENTIFIER NOT NULL,
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_Announcements_CreatedAt DEFAULT SYSUTCDATETIME(),
        ExpiresAt    DATETIME2(3)     NULL,

        CONSTRAINT PK_Announcements PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT CK_Announcements_Severity CHECK (Severity IN ('Info', 'Warning', 'Critical')),
        CONSTRAINT FK_Announcements_Target FOREIGN KEY (TargetUserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT FK_Announcements_Creator FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (Id)
    );
    CREATE INDEX IX_Announcements_Target ON dbo.Announcements (TargetUserId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AnnouncementDismissals')
BEGIN
    CREATE TABLE dbo.AnnouncementDismissals
    (
        AnnouncementId UNIQUEIDENTIFIER NOT NULL,
        UserId         UNIQUEIDENTIFIER NOT NULL,
        DismissedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_AnnouncementDismissals_At DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AnnouncementDismissals PRIMARY KEY CLUSTERED (AnnouncementId, UserId),
        CONSTRAINT FK_AnnouncementDismissals_Announcement FOREIGN KEY (AnnouncementId) REFERENCES dbo.Announcements (Id) ON DELETE CASCADE,
        CONSTRAINT FK_AnnouncementDismissals_User FOREIGN KEY (UserId) REFERENCES dbo.Users (Id)
    );
END
GO
