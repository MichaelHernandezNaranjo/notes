-- =========================================================
-- Table: NodeFiles (metadata of images stored on disk; bytes live in the files volume)
-- =========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NodeFiles')
BEGIN
    CREATE TABLE dbo.NodeFiles
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_NodeFiles_Id DEFAULT NEWID(),
        NodeId       UNIQUEIDENTIFIER NOT NULL,
        StoredName   NVARCHAR(100)    NOT NULL, -- random file name on disk (<guid>.<ext>)
        OriginalName NVARCHAR(260)    NOT NULL,
        ContentType  NVARCHAR(100)    NOT NULL,
        SizeBytes    BIGINT           NOT NULL,
        CreatedBy    UNIQUEIDENTIFIER NOT NULL,
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_NodeFiles_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_NodeFiles PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_NodeFiles_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id) ON DELETE CASCADE,
        CONSTRAINT FK_NodeFiles_Users FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (Id)
    );

    CREATE INDEX IX_NodeFiles_NodeId ON dbo.NodeFiles (NodeId);
END
GO
