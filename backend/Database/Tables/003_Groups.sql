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
