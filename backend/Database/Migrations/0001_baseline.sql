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

-- =========================================================
-- Tables: Groups, GroupMembers
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Groups')
BEGIN
    CREATE TABLE dbo.Groups
    (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Groups_Id DEFAULT NEWID(),
        Name        NVARCHAR(200)    NOT NULL,
        Description NVARCHAR(1000)   NULL,
        CreatedBy   UNIQUEIDENTIFIER NOT NULL,
        CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Groups_CreatedAt DEFAULT SYSUTCDATETIME(),
        IsDeleted   BIT              NOT NULL CONSTRAINT DF_Groups_IsDeleted DEFAULT (0),

        CONSTRAINT PK_Groups PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Groups_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GroupMembers')
BEGIN
    CREATE TABLE dbo.GroupMembers
    (
        GroupId  UNIQUEIDENTIFIER NOT NULL,
        UserId   UNIQUEIDENTIFIER NOT NULL,
        Role     NVARCHAR(20)     NOT NULL CONSTRAINT DF_GroupMembers_Role DEFAULT ('Member'), -- Owner, Admin, Member
        JoinedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_GroupMembers_JoinedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_GroupMembers PRIMARY KEY CLUSTERED (GroupId, UserId),
        CONSTRAINT FK_GroupMembers_Groups FOREIGN KEY (GroupId) REFERENCES dbo.Groups (Id) ON DELETE CASCADE,
        CONSTRAINT FK_GroupMembers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION
    );

    CREATE INDEX IX_GroupMembers_UserId ON dbo.GroupMembers (UserId);
END
GO

-- =========================================================
-- Table: Nodes (folders & notes tree)
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Nodes')
BEGIN
    CREATE TABLE dbo.Nodes
    (
        Id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Nodes_Id DEFAULT NEWID(),
        ParentId         UNIQUEIDENTIFIER NULL,
        OwnerId          UNIQUEIDENTIFIER NOT NULL,
        Type             NVARCHAR(10)     NOT NULL, -- 'Folder' | 'Note'
        Name             NVARCHAR(300)    NOT NULL,
        ContentJson      NVARCHAR(MAX)    NULL,      -- BlockNote JSON snapshot
        ContentYjsState  VARBINARY(MAX)   NULL,      -- Yjs binary doc state
        SortOrder        INT              NOT NULL CONSTRAINT DF_Nodes_SortOrder DEFAULT (0),
        IsDeleted        BIT              NOT NULL CONSTRAINT DF_Nodes_IsDeleted DEFAULT (0),
        DeletedAt        DATETIME2(3)     NULL,
        CreatedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_Nodes_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_Nodes_UpdatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Nodes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Nodes_Parent FOREIGN KEY (ParentId) REFERENCES dbo.Nodes (Id),
        CONSTRAINT FK_Nodes_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users (Id),
        CONSTRAINT CK_Nodes_Type CHECK (Type IN ('Folder', 'Note'))
    );

    CREATE INDEX IX_Nodes_ParentId ON dbo.Nodes (ParentId);
    CREATE INDEX IX_Nodes_OwnerId ON dbo.Nodes (OwnerId);
    CREATE INDEX IX_Nodes_IsDeleted ON dbo.Nodes (IsDeleted);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NodeFavorites')
BEGIN
    CREATE TABLE dbo.NodeFavorites
    (
        UserId    UNIQUEIDENTIFIER NOT NULL,
        NodeId    UNIQUEIDENTIFIER NOT NULL,
        CreatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_NodeFavorites_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_NodeFavorites PRIMARY KEY CLUSTERED (UserId, NodeId),
        CONSTRAINT FK_NodeFavorites_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT FK_NodeFavorites_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NodeRecentAccess')
BEGIN
    CREATE TABLE dbo.NodeRecentAccess
    (
        UserId     UNIQUEIDENTIFIER NOT NULL,
        NodeId     UNIQUEIDENTIFIER NOT NULL,
        AccessedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_NodeRecentAccess_AccessedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_NodeRecentAccess PRIMARY KEY CLUSTERED (UserId, NodeId),
        CONSTRAINT FK_NodeRecentAccess_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT FK_NodeRecentAccess_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id) ON DELETE CASCADE
    );
END
GO

-- =========================================================
-- Table: NodePermissions
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NodePermissions')
BEGIN
    CREATE TABLE dbo.NodePermissions
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_NodePermissions_Id DEFAULT NEWID(),
        NodeId       UNIQUEIDENTIFIER NOT NULL,
        GranteeType  NVARCHAR(20)     NOT NULL, -- 'User' | 'Group' | 'PublicLink'
        GranteeId    UNIQUEIDENTIFIER NULL,      -- UserId or GroupId, null for PublicLink
        AccessLevel  NVARCHAR(20)     NOT NULL,  -- 'Read' | 'Edit'
        ShareToken   NVARCHAR(64)     NULL,
        CreatedBy    UNIQUEIDENTIFIER NOT NULL,
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_NodePermissions_CreatedAt DEFAULT SYSUTCDATETIME(),
        ExpiresAt    DATETIME2(3)     NULL,

        CONSTRAINT PK_NodePermissions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_NodePermissions_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id) ON DELETE CASCADE,
        CONSTRAINT FK_NodePermissions_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (Id),
        CONSTRAINT CK_NodePermissions_GranteeType CHECK (GranteeType IN ('User', 'Group', 'PublicLink')),
        CONSTRAINT CK_NodePermissions_AccessLevel CHECK (AccessLevel IN ('Read', 'Edit'))
    );

    CREATE INDEX IX_NodePermissions_NodeId ON dbo.NodePermissions (NodeId);
    CREATE INDEX IX_NodePermissions_GranteeId ON dbo.NodePermissions (GranteeId);
    CREATE UNIQUE INDEX UX_NodePermissions_ShareToken ON dbo.NodePermissions (ShareToken) WHERE ShareToken IS NOT NULL;
END
GO

-- =========================================================
-- Table: AuditLog
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLog')
BEGIN
    CREATE TABLE dbo.AuditLog
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AuditLog_Id DEFAULT NEWID(),
        UserId       UNIQUEIDENTIFIER NOT NULL,
        NodeId       UNIQUEIDENTIFIER NULL,
        Action       NVARCHAR(100)    NOT NULL, -- e.g. 'NodeCreated', 'NodeMoved', 'PermissionGranted'
        MetadataJson NVARCHAR(MAX)    NULL,
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_AuditLog_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_AuditLog PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_AuditLog_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id),
        CONSTRAINT FK_AuditLog_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id)
    );

    CREATE INDEX IX_AuditLog_NodeId ON dbo.AuditLog (NodeId);
    CREATE INDEX IX_AuditLog_UserId ON dbo.AuditLog (UserId);
END
GO
