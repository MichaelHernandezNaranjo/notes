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
