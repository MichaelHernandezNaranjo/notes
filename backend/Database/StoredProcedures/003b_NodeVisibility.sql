-- =========================================================
-- SPs: Visibility-aware listing and name search
-- (kept apart from 003_Nodes.sql; every one of these filters by what @UserId may see)
-- =========================================================

-- Children of a folder (or of the root) visible to @UserId.
--  * Root (@ParentId NULL): only the user's own top-level nodes (shared items live in sp_Node_GetSharedWithMe).
--  * Inside a folder: the caller (NodeService) has already verified access to that folder.
CREATE OR ALTER PROCEDURE dbo.sp_Node_GetChildren
    @ParentId UNIQUEIDENTIFIER = NULL,
    @UserId   UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT n.*,
           CASE WHEN f.NodeId IS NOT NULL THEN 1 ELSE 0 END AS IsFavorite
    FROM dbo.Nodes n
    LEFT JOIN dbo.NodeFavorites f ON f.NodeId = n.Id AND f.UserId = @UserId
    WHERE n.IsDeleted = 0
      AND (
            (@ParentId IS NULL AND n.ParentId IS NULL AND n.OwnerId = @UserId)
         OR (@ParentId IS NOT NULL AND n.ParentId = @ParentId)
          )
    ORDER BY n.SortOrder;
END
GO

-- Nodes shared with the user (directly or through a group) that the user does not own.
-- Only the "entry points" are returned: a node whose parent is also shared is reached through that parent.
CREATE OR ALTER PROCEDURE dbo.sp_Node_GetSharedWithMe
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    SELECT n.*,
           CASE WHEN f.NodeId IS NOT NULL THEN 1 ELSE 0 END AS IsFavorite
    FROM dbo.Nodes n
    LEFT JOIN dbo.NodeFavorites f ON f.NodeId = n.Id AND f.UserId = @UserId
    WHERE n.IsDeleted = 0
      AND n.OwnerId <> @UserId
      AND EXISTS (
            SELECT 1 FROM dbo.NodePermissions p
            WHERE p.NodeId = n.Id
              AND (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME())
              AND (
                    (p.GranteeType = 'User' AND p.GranteeId = @UserId)
                 OR (p.GranteeType = 'Group' AND p.GranteeId IN (SELECT GroupId FROM dbo.GroupMembers WHERE UserId = @UserId))
                  )
          )
      -- Hide children whose parent is itself shared with the user (they appear inside the parent).
      AND NOT EXISTS (
            SELECT 1 FROM dbo.NodePermissions pp
            WHERE pp.NodeId = n.ParentId
              AND (pp.ExpiresAt IS NULL OR pp.ExpiresAt > SYSUTCDATETIME())
              AND (
                    (pp.GranteeType = 'User' AND pp.GranteeId = @UserId)
                 OR (pp.GranteeType = 'Group' AND pp.GranteeId IN (SELECT GroupId FROM dbo.GroupMembers WHERE UserId = @UserId))
                  )
          )
    ORDER BY n.Name;
END
GO

-- Name search over everything the user can see (own + shared, directly/group/inherited from a shared folder).
-- Accent- and case-insensitive, matches anywhere in the name, excludes the trash.
CREATE OR ALTER PROCEDURE dbo.sp_Node_Search
    @UserId UNIQUEIDENTIFIER,
    @Query  NVARCHAR(100),
    @Top    INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query = LTRIM(RTRIM(@Query));
    IF @Query = N'' RETURN;
    IF @Top IS NULL OR @Top < 1 OR @Top > 100 SET @Top = 50;

    -- Escape LIKE wildcards so the term is matched literally.
    DECLARE @Esc NVARCHAR(250) = REPLACE(REPLACE(REPLACE(REPLACE(@Query, N'\', N'\\'), N'%', N'\%'), N'_', N'\_'), N'[', N'\[');

    ;WITH Roots AS (
        SELECT n.Id FROM dbo.Nodes n WHERE n.OwnerId = @UserId
        UNION
        SELECT p.NodeId
        FROM dbo.NodePermissions p
        WHERE (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME())
          AND (
                (p.GranteeType = 'User' AND p.GranteeId = @UserId)
             OR (p.GranteeType = 'Group' AND p.GranteeId IN (SELECT GroupId FROM dbo.GroupMembers WHERE UserId = @UserId))
              )
    ),
    -- Everything below a shared node is visible too.
    Visible AS (
        SELECT Id FROM Roots
        UNION ALL
        SELECT c.Id FROM dbo.Nodes c INNER JOIN Visible v ON c.ParentId = v.Id
    ),
    Matches AS (
        SELECT DISTINCT n.Id, n.ParentId, n.Name, n.Type
        FROM dbo.Nodes n
        WHERE n.IsDeleted = 0
          AND n.Id IN (SELECT Id FROM Visible)
          AND n.Name COLLATE Latin1_General_CI_AI LIKE N'%' + @Esc + N'%' ESCAPE N'\'
    ),
    Up AS (
        SELECT m.Id AS NodeId, p.ParentId AS NextId,
               CAST(p.Name AS NVARCHAR(MAX)) AS PathText,
               CAST(CONVERT(NVARCHAR(36), p.Id) AS NVARCHAR(MAX)) AS IdText
        FROM Matches m INNER JOIN dbo.Nodes p ON p.Id = m.ParentId
        UNION ALL
        SELECT u.NodeId, p.ParentId,
               p.Name + N' / ' + u.PathText,
               CONVERT(NVARCHAR(36), p.Id) + N',' + u.IdText
        FROM Up u INNER JOIN dbo.Nodes p ON p.Id = u.NextId
    ),
    Paths AS (
        SELECT NodeId, PathText, IdText FROM Up WHERE NextId IS NULL
    )
    SELECT TOP (@Top) m.Id, m.ParentId, m.Name, m.Type,
           ISNULL(pa.PathText, N'') AS Path,
           ISNULL(pa.IdText, N'') AS PathIds
    FROM Matches m
    LEFT JOIN Paths pa ON pa.NodeId = m.Id
    ORDER BY
        CASE
            WHEN m.Name COLLATE Latin1_General_CI_AI = @Query THEN 0
            WHEN m.Name COLLATE Latin1_General_CI_AI LIKE @Esc + N'%' ESCAPE N'\' THEN 1
            ELSE 2
        END,
        CASE WHEN m.Type = 'Folder' THEN 0 ELSE 1 END,
        m.Name
    OPTION (MAXRECURSION 200);
END
GO
