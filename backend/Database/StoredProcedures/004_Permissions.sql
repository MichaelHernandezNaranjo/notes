-- =========================================================
-- SPs: Permissions, sharing, public links and invitations
-- Access model:
--   * Owner  : owns the node or any ancestor folder.
--   * Edit / Read : direct or group grant on the node or an ancestor; the grant closest to the node wins
--                   (a Read on a sub-folder restricts an Edit on its parent).
--   * Public links are read-only, anonymous, and resolved only by the dbo.sp_Public_* procedures.
-- Errors: 50010 invalid access level, 50011 invalid e-mail, 50012 cannot share with the owner/yourself.
-- =========================================================

-- Kept for compatibility with older databases; the API no longer calls it.
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
    THROW 50010, 'Use sp_Permission_ShareWithEmail.', 1;
END
GO

-- Shares a node with a person by e-mail. Existing user -> real grant (or level change); unknown e-mail -> pending invitation.
CREATE OR ALTER PROCEDURE dbo.sp_Permission_ShareWithEmail
    @NodeId      UNIQUEIDENTIFIER,
    @Email       NVARCHAR(256),
    @AccessLevel NVARCHAR(20),
    @CreatedBy   UNIQUEIDENTIFIER,
    @ExpiresAt   DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @Email = LOWER(LTRIM(RTRIM(ISNULL(@Email, ''))));
    IF @AccessLevel NOT IN ('Read', 'Edit') THROW 50010, 'Invalid access level.', 1;
    IF @Email NOT LIKE '_%@_%._%' OR LEN(@Email) > 256 THROW 50011, 'Invalid e-mail address.', 1;

    DECLARE @UserId UNIQUEIDENTIFIER = (SELECT TOP (1) Id FROM dbo.Users WHERE Email = @Email);
    DECLARE @OwnerId UNIQUEIDENTIFIER = (SELECT OwnerId FROM dbo.Nodes WHERE Id = @NodeId);
    IF @OwnerId IS NULL THROW 50011, 'Node not found.', 1;
    IF @UserId IS NOT NULL AND (@UserId = @CreatedBy OR @UserId = @OwnerId) THROW 50012, 'You cannot share with the owner.', 1;
    IF @UserId IS NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @CreatedBy AND Email = @Email) THROW 50012, 'You cannot share with yourself.', 1;

    IF @UserId IS NOT NULL
    BEGIN
        DELETE FROM dbo.ShareInvitations WHERE NodeId = @NodeId AND Email = @Email;

        DECLARE @Id UNIQUEIDENTIFIER = (SELECT Id FROM dbo.NodePermissions WHERE NodeId = @NodeId AND GranteeType = 'User' AND GranteeId = @UserId);
        IF @Id IS NULL
        BEGIN
            SET @Id = NEWID();
            INSERT INTO dbo.NodePermissions (Id, NodeId, GranteeType, GranteeId, AccessLevel, CreatedBy, ExpiresAt)
            VALUES (@Id, @NodeId, 'User', @UserId, @AccessLevel, @CreatedBy, @ExpiresAt);
        END
        ELSE
            UPDATE dbo.NodePermissions SET AccessLevel = @AccessLevel, ExpiresAt = @ExpiresAt, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @CreatedBy WHERE Id = @Id;

        SELECT CAST('Permission' AS NVARCHAR(20)) AS Kind, @Id AS Id, @UserId AS UserId, @Email AS Email;
        RETURN;
    END

    DECLARE @InvId UNIQUEIDENTIFIER = (SELECT Id FROM dbo.ShareInvitations WHERE NodeId = @NodeId AND Email = @Email);
    IF @InvId IS NULL
    BEGIN
        SET @InvId = NEWID();
        INSERT INTO dbo.ShareInvitations (Id, NodeId, Email, AccessLevel, CreatedBy, ExpiresAt)
        VALUES (@InvId, @NodeId, @Email, @AccessLevel, @CreatedBy, DATEADD(DAY, 30, SYSUTCDATETIME()));
    END
    ELSE
        UPDATE dbo.ShareInvitations SET AccessLevel = @AccessLevel, ExpiresAt = DATEADD(DAY, 30, SYSUTCDATETIME()) WHERE Id = @InvId;

    SELECT CAST('Invitation' AS NVARCHAR(20)) AS Kind, @InvId AS Id, CAST(NULL AS UNIQUEIDENTIFIER) AS UserId, @Email AS Email;
END
GO

-- Changes the level / expiry of a grant. Scoped to the node. Returns the affected user (to refresh live sessions).
CREATE OR ALTER PROCEDURE dbo.sp_Permission_Update
    @PermissionId UNIQUEIDENTIFIER,
    @NodeId       UNIQUEIDENTIFIER,
    @AccessLevel  NVARCHAR(20),
    @ExpiresAt    DATETIME2(3) = NULL,
    @UpdatedBy    UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    IF @AccessLevel NOT IN ('Read', 'Edit') THROW 50010, 'Invalid access level.', 1;

    UPDATE dbo.NodePermissions
       SET AccessLevel = @AccessLevel, ExpiresAt = @ExpiresAt, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
    OUTPUT inserted.GranteeId AS UserId
     WHERE Id = @PermissionId AND NodeId = @NodeId AND GranteeType IN ('User', 'Group');
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Permission_Revoke
    @PermissionId UNIQUEIDENTIFIER,
    @NodeId       UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.NodePermissions
    OUTPUT deleted.GranteeId AS UserId
    WHERE Id = @PermissionId AND NodeId = @NodeId AND GranteeType IN ('User', 'Group');
END
GO

-- People with access: direct grants on the node plus the ones inherited from ancestor folders.
CREATE OR ALTER PROCEDURE dbo.sp_Permission_ListByNode
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH A AS (
        SELECT Id, ParentId, Name, 0 AS Depth FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id, n.ParentId, n.Name, a.Depth + 1 FROM dbo.Nodes n INNER JOIN A a ON n.Id = a.ParentId
    )
    SELECT p.Id, p.NodeId, p.GranteeType, p.GranteeId, p.AccessLevel, p.CreatedBy, p.CreatedAt, p.ExpiresAt, p.UpdatedAt,
           u.DisplayName AS UserDisplayName, u.Email AS UserEmail, u.AvatarUrl AS UserAvatarUrl,
           g.Name AS GroupName,
           a.Id AS SourceNodeId, a.Name AS SourceNodeName,
           CAST(CASE WHEN a.Depth > 0 THEN 1 ELSE 0 END AS BIT) AS Inherited
    FROM A a
    INNER JOIN dbo.NodePermissions p ON p.NodeId = a.Id AND p.GranteeType IN ('User', 'Group')
    LEFT JOIN dbo.Users u ON p.GranteeType = 'User' AND u.Id = p.GranteeId
    LEFT JOIN dbo.Groups g ON p.GranteeType = 'Group' AND g.Id = p.GranteeId
    ORDER BY a.Depth, u.DisplayName, p.CreatedAt
    OPTION (MAXRECURSION 1000);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Invitation_ListByNode
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, NodeId, Email, AccessLevel, CreatedAt, ExpiresAt
    FROM dbo.ShareInvitations
    WHERE NodeId = @NodeId AND ExpiresAt > SYSUTCDATETIME()
    ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Invitation_Revoke
    @InvitationId UNIQUEIDENTIFIER,
    @NodeId       UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.ShareInvitations WHERE Id = @InvitationId AND NodeId = @NodeId;
    SELECT @@ROWCOUNT AS Affected;
END
GO

-- Called after a verified sign-in: turns the pending invitations of that e-mail into real grants.
CREATE OR ALTER PROCEDURE dbo.sp_User_RedeemInvitations
    @UserId UNIQUEIDENTIFIER,
    @Email  NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SET @Email = LOWER(LTRIM(RTRIM(@Email)));

    INSERT INTO dbo.NodePermissions (Id, NodeId, GranteeType, GranteeId, AccessLevel, CreatedBy)
    SELECT NEWID(), i.NodeId, 'User', @UserId, i.AccessLevel, i.CreatedBy
    FROM dbo.ShareInvitations i
    INNER JOIN dbo.Nodes n ON n.Id = i.NodeId
    WHERE i.Email = @Email AND i.ExpiresAt > SYSUTCDATETIME() AND n.OwnerId <> @UserId
      AND NOT EXISTS (SELECT 1 FROM dbo.NodePermissions p WHERE p.NodeId = i.NodeId AND p.GranteeType = 'User' AND p.GranteeId = @UserId);

    DECLARE @Redeemed INT = @@ROWCOUNT;
    DELETE FROM dbo.ShareInvitations WHERE Email = @Email;
    SELECT @Redeemed AS Redeemed;
END
GO

-- ---------- Public read-only link (one per node) ----------
CREATE OR ALTER PROCEDURE dbo.sp_ShareLink_Get
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, NodeId, ShareToken, CreatedAt, ExpiresAt, ViewCount
    FROM dbo.NodePermissions WHERE NodeId = @NodeId AND GranteeType = 'PublicLink';
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ShareLink_Upsert
    @NodeId     UNIQUEIDENTIFIER,
    @Token      NVARCHAR(64),
    @CreatedBy  UNIQUEIDENTIFIER,
    @ExpiresAt  DATETIME2(3) = NULL,
    @Regenerate BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.NodePermissions WHERE NodeId = @NodeId AND GranteeType = 'PublicLink')
        UPDATE dbo.NodePermissions
           SET ExpiresAt = @ExpiresAt,
               ShareToken = CASE WHEN @Regenerate = 1 THEN @Token ELSE ShareToken END,
               ViewCount = CASE WHEN @Regenerate = 1 THEN 0 ELSE ViewCount END,
               UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @CreatedBy
         WHERE NodeId = @NodeId AND GranteeType = 'PublicLink';
    ELSE
        INSERT INTO dbo.NodePermissions (Id, NodeId, GranteeType, GranteeId, AccessLevel, ShareToken, CreatedBy, ExpiresAt)
        VALUES (NEWID(), @NodeId, 'PublicLink', NULL, 'Read', @Token, @CreatedBy, @ExpiresAt);

    EXEC dbo.sp_ShareLink_Get @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ShareLink_Disable
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.NodePermissions WHERE NodeId = @NodeId AND GranteeType = 'PublicLink';
END
GO

-- Replaced by sp_Public_Resolve.
IF OBJECT_ID('dbo.sp_Permission_CreateShareLink', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Permission_CreateShareLink;
GO
IF OBJECT_ID('dbo.sp_Permission_GetByShareToken', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Permission_GetByShareToken;
GO

-- Effective access of a user over a node: 'Owner' | 'Edit' | 'Read' | no row.
CREATE OR ALTER PROCEDURE dbo.sp_Permission_CheckAccess
    @NodeId UNIQUEIDENTIFIER,
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH A AS (
        SELECT Id, ParentId, OwnerId, 0 AS Depth FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id, n.ParentId, n.OwnerId, a.Depth + 1 FROM dbo.Nodes n INNER JOIN A a ON n.Id = a.ParentId
    ),
    Candidates AS (
        SELECT CAST('Owner' AS NVARCHAR(20)) AS AccessLevel, Depth FROM A WHERE OwnerId = @UserId
        UNION ALL
        SELECT p.AccessLevel, a.Depth
        FROM A a
        INNER JOIN dbo.NodePermissions p ON p.NodeId = a.Id
        WHERE (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME())
          AND (
                (p.GranteeType = 'User' AND p.GranteeId = @UserId)
             OR (p.GranteeType = 'Group' AND p.GranteeId IN (SELECT GroupId FROM dbo.GroupMembers WHERE UserId = @UserId))
              )
    )
    SELECT TOP (1) AccessLevel
    FROM Candidates
    ORDER BY CASE WHEN AccessLevel = 'Owner' THEN 0 ELSE 1 END, Depth, CASE AccessLevel WHEN 'Edit' THEN 0 ELSE 1 END
    OPTION (MAXRECURSION 1000);
END
GO

-- =========================================================
-- Anonymous read access through a public link
-- =========================================================

