-- =========================================================
-- SPs: Permissions & Sharing
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_Permission_Grant
    @NodeId      UNIQUEIDENTIFIER,
    @GranteeType NVARCHAR(20),
    @GranteeId   UNIQUEIDENTIFIER = NULL,
    @AccessLevel NVARCHAR(20),
    @CreatedBy   UNIQUEIDENTIFIER,
    @ExpiresAt   DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.NodePermissions (Id, NodeId, GranteeType, GranteeId, AccessLevel, CreatedBy, ExpiresAt)
    VALUES (@NewId, @NodeId, @GranteeType, @GranteeId, @AccessLevel, @CreatedBy, @ExpiresAt);

    SELECT * FROM dbo.NodePermissions WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Permission_CreateShareLink
    @NodeId      UNIQUEIDENTIFIER,
    @AccessLevel NVARCHAR(20),
    @ShareToken  NVARCHAR(64),
    @CreatedBy   UNIQUEIDENTIFIER,
    @ExpiresAt   DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.NodePermissions (Id, NodeId, GranteeType, GranteeId, AccessLevel, ShareToken, CreatedBy, ExpiresAt)
    VALUES (@NewId, @NodeId, 'PublicLink', NULL, @AccessLevel, @ShareToken, @CreatedBy, @ExpiresAt);

    SELECT * FROM dbo.NodePermissions WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Permission_Revoke
    @PermissionId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.NodePermissions WHERE Id = @PermissionId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Permission_ListByNode
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.*,
           u.DisplayName AS UserDisplayName, u.Email AS UserEmail,
           g.Name AS GroupName
    FROM dbo.NodePermissions p
    LEFT JOIN dbo.Users u ON p.GranteeType = 'User' AND u.Id = p.GranteeId
    LEFT JOIN dbo.Groups g ON p.GranteeType = 'Group' AND g.Id = p.GranteeId
    WHERE p.NodeId = @NodeId
    ORDER BY p.CreatedAt DESC;
END
GO

-- Resolves the effective access level a user has over a node, walking up the
-- parent chain (folder-level shares cascade to children) and considering group membership.
-- Returns a single row: AccessLevel ('Owner' | 'Edit' | 'Read' | NULL if no access)
CREATE OR ALTER PROCEDURE dbo.sp_Permission_CheckAccess
    @NodeId UNIQUEIDENTIFIER,
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Nodes WHERE Id = @NodeId AND OwnerId = @UserId)
    BEGIN
        SELECT 'Owner' AS AccessLevel;
        RETURN;
    END

    ;WITH Ancestors AS (
        SELECT Id, ParentId FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id, n.ParentId FROM dbo.Nodes n INNER JOIN Ancestors a ON n.Id = a.ParentId
    ),
    EffectivePermissions AS (
        SELECT p.AccessLevel
        FROM dbo.NodePermissions p
        WHERE p.NodeId IN (SELECT Id FROM Ancestors)
          AND (
                (p.GranteeType = 'User' AND p.GranteeId = @UserId)
             OR (p.GranteeType = 'Group' AND p.GranteeId IN (
                    SELECT GroupId FROM dbo.GroupMembers WHERE UserId = @UserId))
              )
          AND (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME())
    )
    SELECT TOP (1) AccessLevel
    FROM EffectivePermissions
    ORDER BY CASE AccessLevel WHEN 'Edit' THEN 0 ELSE 1 END;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Permission_GetByShareToken
    @ShareToken NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (1) p.*, n.Name AS NodeName, n.Type AS NodeType
    FROM dbo.NodePermissions p
    INNER JOIN dbo.Nodes n ON n.Id = p.NodeId
    WHERE p.ShareToken = @ShareToken
      AND (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME());
END
GO
