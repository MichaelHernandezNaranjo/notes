-- =========================================================
-- Sharing: invitations by e-mail, one public read-only link per node, audit columns.
-- Applied once by db-init (versioned migration); never edit after it has been deployed.
-- =========================================================

-- Public links never worked (no enforcement path existed): drop the old rows, they are re-created from the UI.
DELETE FROM dbo.NodePermissions WHERE GranteeType = 'PublicLink';
GO

-- Duplicate direct grants (same node + user) would break the new unique index: keep the most permissive one.
;WITH d AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY NodeId, GranteeId
                                  ORDER BY CASE AccessLevel WHEN 'Edit' THEN 0 ELSE 1 END, CreatedAt) AS rn
    FROM dbo.NodePermissions WHERE GranteeType = 'User')
DELETE FROM dbo.NodePermissions WHERE Id IN (SELECT Id FROM d WHERE rn > 1);
GO

IF COL_LENGTH('dbo.NodePermissions', 'UpdatedAt') IS NULL
    ALTER TABLE dbo.NodePermissions ADD UpdatedAt DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.NodePermissions', 'UpdatedBy') IS NULL
    ALTER TABLE dbo.NodePermissions ADD UpdatedBy UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('dbo.NodePermissions', 'ViewCount') IS NULL
    ALTER TABLE dbo.NodePermissions ADD ViewCount INT NOT NULL CONSTRAINT DF_NodePermissions_ViewCount DEFAULT (0);
GO

-- A public link can only ever be read-only.
IF OBJECT_ID('dbo.CK_NodePermissions_LinkReadOnly', 'C') IS NULL
    ALTER TABLE dbo.NodePermissions ADD CONSTRAINT CK_NodePermissions_LinkReadOnly
        CHECK (GranteeType <> 'PublicLink' OR AccessLevel = 'Read');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_NodePermissions_User')
    CREATE UNIQUE INDEX UX_NodePermissions_User ON dbo.NodePermissions (NodeId, GranteeId) WHERE GranteeType = 'User';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_NodePermissions_Link')
    CREATE UNIQUE INDEX UX_NodePermissions_Link ON dbo.NodePermissions (NodeId) WHERE GranteeType = 'PublicLink';
GO

-- Pending invitations for people without an account yet; redeemed at their first verified sign-in.
IF OBJECT_ID('dbo.ShareInvitations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ShareInvitations (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ShareInvitations PRIMARY KEY DEFAULT NEWID(),
        NodeId      UNIQUEIDENTIFIER NOT NULL,
        Email       NVARCHAR(256)    NOT NULL,
        AccessLevel NVARCHAR(20)     NOT NULL,
        CreatedBy   UNIQUEIDENTIFIER NOT NULL,
        CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_ShareInvitations_CreatedAt DEFAULT SYSUTCDATETIME(),
        ExpiresAt   DATETIME2(3)     NOT NULL,
        CONSTRAINT FK_ShareInvitations_Nodes FOREIGN KEY (NodeId) REFERENCES dbo.Nodes (Id) ON DELETE CASCADE,
        CONSTRAINT CK_ShareInvitations_Level CHECK (AccessLevel IN ('Read', 'Edit'))
    );
    CREATE UNIQUE INDEX UX_ShareInvitations_NodeEmail ON dbo.ShareInvitations (NodeId, Email);
    CREATE INDEX IX_ShareInvitations_Email ON dbo.ShareInvitations (Email);
END
GO
