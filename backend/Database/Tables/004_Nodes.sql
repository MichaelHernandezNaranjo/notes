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
