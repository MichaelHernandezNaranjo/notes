-- =========================================================
-- SPs: Nodes (tree CRUD, move, favorites, recent, trash)
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_Node_Create
    @ParentId UNIQUEIDENTIFIER = NULL,
    @OwnerId  UNIQUEIDENTIFIER,
    @Type     NVARCHAR(10),
    @Name     NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    DECLARE @NextSort INT;

    SELECT @NextSort = ISNULL(MAX(SortOrder), 0) + 1
    FROM dbo.Nodes
    WHERE ISNULL(ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@ParentId, '00000000-0000-0000-0000-000000000000')
      AND IsDeleted = 0;

    INSERT INTO dbo.Nodes (Id, ParentId, OwnerId, Type, Name, SortOrder)
    VALUES (@NewId, @ParentId, @OwnerId, @Type, @Name, @NextSort);

    SELECT * FROM dbo.Nodes WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Rename
    @NodeId UNIQUEIDENTIFIER,
    @Name   NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Nodes
    SET Name = @Name, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @NodeId;

    SELECT * FROM dbo.Nodes WHERE Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Move
    @NodeId      UNIQUEIDENTIFIER,
    @NewParentId UNIQUEIDENTIFIER = NULL,
    @NewSortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Sort INT = @NewSortOrder;
    IF @Sort IS NULL
    BEGIN
        SELECT @Sort = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.Nodes
        WHERE ISNULL(ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@NewParentId, '00000000-0000-0000-0000-000000000000')
          AND IsDeleted = 0;
    END

    UPDATE dbo.Nodes
    SET ParentId = @NewParentId, SortOrder = @Sort, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @NodeId;

    SELECT * FROM dbo.Nodes WHERE Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Duplicate
    @NodeId UNIQUEIDENTIFIER,
    @OwnerId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.Nodes (Id, ParentId, OwnerId, Type, Name, ContentJson, ContentYjsState, SortOrder)
    SELECT @NewId, ParentId, @OwnerId, Type, Name + N' (copy)', ContentJson, ContentYjsState,
           (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Nodes n2
            WHERE ISNULL(n2.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(n.ParentId, '00000000-0000-0000-0000-000000000000') AND n2.IsDeleted = 0)
    FROM dbo.Nodes n
    WHERE n.Id = @NodeId;

    SELECT * FROM dbo.Nodes WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_SoftDelete
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    UPDATE dbo.Nodes
    SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME()
    WHERE Id IN (SELECT Id FROM Descendants);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Restore
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    UPDATE dbo.Nodes
    SET IsDeleted = 0, DeletedAt = NULL
    WHERE Id IN (SELECT Id FROM Descendants);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_HardDelete
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    DELETE FROM dbo.Nodes WHERE Id IN (SELECT Id FROM Descendants);
END
GO

-- Returns the full tree (non-deleted) accessible/owned by the user (owned nodes only; shared nodes are merged at the service layer with NodePermissions results)
CREATE OR ALTER PROCEDURE dbo.sp_Node_GetTreeByUser
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT n.*,
           CASE WHEN f.NodeId IS NOT NULL THEN 1 ELSE 0 END AS IsFavorite
    FROM dbo.Nodes n
    LEFT JOIN dbo.NodeFavorites f ON f.NodeId = n.Id AND f.UserId = @UserId
    WHERE n.OwnerId = @UserId AND n.IsDeleted = 0
    ORDER BY n.ParentId, n.SortOrder;
END
GO

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
    WHERE ISNULL(n.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@ParentId, '00000000-0000-0000-0000-000000000000')
      AND n.IsDeleted = 0
    ORDER BY n.SortOrder;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_GetById
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.Nodes WHERE Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_GetRecent
    @UserId UNIQUEIDENTIFIER,
    @Top    INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Top) n.*, ra.AccessedAt
    FROM dbo.NodeRecentAccess ra
    INNER JOIN dbo.Nodes n ON n.Id = ra.NodeId
    WHERE ra.UserId = @UserId AND n.IsDeleted = 0
    ORDER BY ra.AccessedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_TouchRecent
    @UserId UNIQUEIDENTIFIER,
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.NodeRecentAccess AS target
    USING (SELECT @UserId AS UserId, @NodeId AS NodeId) AS src
        ON target.UserId = src.UserId AND target.NodeId = src.NodeId
    WHEN MATCHED THEN UPDATE SET AccessedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (UserId, NodeId) VALUES (@UserId, @NodeId);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_ToggleFavorite
    @UserId UNIQUEIDENTIFIER,
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.NodeFavorites WHERE UserId = @UserId AND NodeId = @NodeId)
    BEGIN
        DELETE FROM dbo.NodeFavorites WHERE UserId = @UserId AND NodeId = @NodeId;
        SELECT CAST(0 AS BIT) AS IsFavorite;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.NodeFavorites (UserId, NodeId) VALUES (@UserId, @NodeId);
        SELECT CAST(1 AS BIT) AS IsFavorite;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_GetFavorites
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT n.*, f.CreatedAt AS FavoritedAt
    FROM dbo.NodeFavorites f
    INNER JOIN dbo.Nodes n ON n.Id = f.NodeId
    WHERE f.UserId = @UserId AND n.IsDeleted = 0
    ORDER BY f.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_GetTrash
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.Nodes
    WHERE OwnerId = @UserId AND IsDeleted = 1
    ORDER BY DeletedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_SaveContent
    @NodeId          UNIQUEIDENTIFIER,
    @ContentJson     NVARCHAR(MAX)  = NULL,
    @ContentYjsState VARBINARY(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Nodes
    SET ContentJson = COALESCE(@ContentJson, ContentJson),
        ContentYjsState = COALESCE(@ContentYjsState, ContentYjsState),
        UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_GetContent
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, ContentJson, ContentYjsState, UpdatedAt
    FROM dbo.Nodes
    WHERE Id = @NodeId;
END
GO
