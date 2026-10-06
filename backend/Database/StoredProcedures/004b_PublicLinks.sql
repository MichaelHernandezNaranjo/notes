-- All nodes from @NodeId up to the top (including itself).
CREATE OR ALTER FUNCTION dbo.fn_NodeChain (@NodeId UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    WITH A AS (
        SELECT Id, ParentId, IsDeleted FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id, n.ParentId, n.IsDeleted FROM dbo.Nodes n INNER JOIN A a ON n.Id = a.ParentId
    )
    SELECT Id, ParentId, IsDeleted FROM A
);
GO

-- Root node of a valid link: the link exists, has not expired, and neither the node nor any ancestor is in the trash.
CREATE OR ALTER FUNCTION dbo.fn_PublicLinkRoot (@Token NVARCHAR(64))
RETURNS TABLE
AS
RETURN
(
    SELECT p.Id AS LinkId, p.NodeId AS RootId, p.ExpiresAt
    FROM dbo.NodePermissions p
    WHERE p.GranteeType = 'PublicLink' AND p.ShareToken = @Token
      AND (p.ExpiresAt IS NULL OR p.ExpiresAt > SYSUTCDATETIME())
      AND NOT EXISTS (SELECT 1 FROM dbo.fn_NodeChain(p.NodeId) c WHERE c.IsDeleted = 1)
);
GO

-- A node is readable through the link when the link is valid, the node lies inside the shared subtree and nothing above it is trashed.
CREATE OR ALTER FUNCTION dbo.fn_PublicNodeAllowed (@Token NVARCHAR(64), @NodeId UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    SELECT r.RootId
    FROM dbo.fn_PublicLinkRoot(@Token) r
    WHERE EXISTS (SELECT 1 FROM dbo.fn_NodeChain(@NodeId) c WHERE c.Id = r.RootId)
      AND NOT EXISTS (SELECT 1 FROM dbo.fn_NodeChain(@NodeId) c WHERE c.IsDeleted = 1)
);
GO

CREATE OR ALTER PROCEDURE dbo.sp_Public_Resolve
    @Token NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p SET ViewCount = ViewCount + 1
    FROM dbo.NodePermissions p INNER JOIN dbo.fn_PublicLinkRoot(@Token) r ON r.LinkId = p.Id;

    SELECT n.Id AS NodeId, n.Name AS NodeName, n.Type AS NodeType, r.ExpiresAt
    FROM dbo.fn_PublicLinkRoot(@Token) r
    INNER JOIN dbo.Nodes n ON n.Id = r.RootId;
END
GO

-- Non-trashed subtree (the shared node included) for the viewer's navigation tree.
CREATE OR ALTER PROCEDURE dbo.sp_Public_GetTree
    @Token NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RootId UNIQUEIDENTIFIER = (SELECT RootId FROM dbo.fn_PublicLinkRoot(@Token));
    IF @RootId IS NULL RETURN;

    ;WITH T AS (
        SELECT Id, ParentId, Type, Name, SortOrder FROM dbo.Nodes WHERE Id = @RootId
        UNION ALL
        SELECT n.Id, n.ParentId, n.Type, n.Name, n.SortOrder FROM dbo.Nodes n INNER JOIN T t ON n.ParentId = t.Id WHERE n.IsDeleted = 0
    )
    SELECT Id, CASE WHEN Id = @RootId THEN NULL ELSE ParentId END AS ParentId, Type, Name, SortOrder FROM T ORDER BY SortOrder, Name
    OPTION (MAXRECURSION 1000);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Public_GetNode
    @Token  NVARCHAR(64),
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT n.Id, n.ParentId, n.Type, n.Name, n.ContentYjsState
    FROM dbo.fn_PublicNodeAllowed(@Token, @NodeId) a
    INNER JOIN dbo.Nodes n ON n.Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Public_GetFile
    @Token  NVARCHAR(64),
    @FileId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT f.*
    FROM dbo.NodeFiles f
    CROSS APPLY dbo.fn_PublicNodeAllowed(@Token, f.NodeId) a
    WHERE f.Id = @FileId;
END
GO
