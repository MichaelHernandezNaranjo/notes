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
