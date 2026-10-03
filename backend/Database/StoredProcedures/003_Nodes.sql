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
    SET XACT_ABORT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    DECLARE @NextSort INT;
    SET @Name = LTRIM(RTRIM(@Name));

    IF @Name = N'' THROW 50002, 'Name cannot be empty.', 1;

    BEGIN TRY
    BEGIN TRAN;

    -- Siblings share one namespace (notes + folders), case-insensitive; trashed items do not count.
    IF EXISTS (SELECT 1 FROM dbo.Nodes WITH (UPDLOCK, HOLDLOCK)
               WHERE ISNULL(ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@ParentId, '00000000-0000-0000-0000-000000000000')
                 AND IsDeleted = 0 AND Name = @Name)
    BEGIN
        THROW 50001, 'A node with this name already exists in this folder.', 1;
    END

    SELECT @NextSort = ISNULL(MAX(SortOrder), 0) + 1
    FROM dbo.Nodes
    WHERE ISNULL(ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@ParentId, '00000000-0000-0000-0000-000000000000')
      AND IsDeleted = 0;

    INSERT INTO dbo.Nodes (Id, ParentId, OwnerId, Type, Name, SortOrder)
    VALUES (@NewId, @ParentId, @OwnerId, @Type, @Name, @NextSort);

    COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH

    SELECT * FROM dbo.Nodes WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Rename
    @NodeId UNIQUEIDENTIFIER,
    @Name   NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @Name = LTRIM(RTRIM(@Name));

    IF @Name = N'' THROW 50002, 'Name cannot be empty.', 1;

    BEGIN TRY
    BEGIN TRAN;

    IF EXISTS (SELECT 1 FROM dbo.Nodes s WITH (UPDLOCK, HOLDLOCK)
               INNER JOIN dbo.Nodes me ON me.Id = @NodeId
               WHERE ISNULL(s.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(me.ParentId, '00000000-0000-0000-0000-000000000000')
                 AND s.IsDeleted = 0 AND s.Id <> @NodeId AND s.Name = @Name)
    BEGIN
        THROW 50001, 'A node with this name already exists in this folder.', 1;
    END

    UPDATE dbo.Nodes
    SET Name = @Name, UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @NodeId;

    COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH

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
    SET XACT_ABORT ON;

    BEGIN TRY
    BEGIN TRAN;

    IF EXISTS (SELECT 1 FROM dbo.Nodes s WITH (UPDLOCK, HOLDLOCK)
               INNER JOIN dbo.Nodes me ON me.Id = @NodeId
               WHERE ISNULL(s.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@NewParentId, '00000000-0000-0000-0000-000000000000')
                 AND s.IsDeleted = 0 AND s.Id <> @NodeId AND s.Name = me.Name)
    BEGIN
        THROW 50001, 'A node with this name already exists in this folder.', 1;
    END

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

    COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH

    SELECT * FROM dbo.Nodes WHERE Id = @NodeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_Duplicate
    @NodeId UNIQUEIDENTIFIER,
    @OwnerId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    DECLARE @ParentId UNIQUEIDENTIFIER, @BaseName NVARCHAR(300), @NewName NVARCHAR(300), @N INT = 1;

    BEGIN TRY
    BEGIN TRAN;

    SELECT @ParentId = ParentId, @BaseName = Name FROM dbo.Nodes WHERE Id = @NodeId;

    -- First free name: "X (copy)", "X (copy 2)", "X (copy 3)", ...
    SET @NewName = LEFT(@BaseName, 280) + N' (copy)';
    WHILE EXISTS (SELECT 1 FROM dbo.Nodes WITH (UPDLOCK, HOLDLOCK)
                  WHERE ISNULL(ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(@ParentId, '00000000-0000-0000-0000-000000000000')
                    AND IsDeleted = 0 AND Name = @NewName)
    BEGIN
        SET @N += 1;
        SET @NewName = LEFT(@BaseName, 270) + N' (copy ' + CAST(@N AS NVARCHAR(10)) + N')';
    END

    INSERT INTO dbo.Nodes (Id, ParentId, OwnerId, Type, Name, ContentJson, ContentYjsState, SortOrder)
    SELECT @NewId, ParentId, @OwnerId, Type, @NewName, ContentJson, ContentYjsState,
           (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Nodes n2
            WHERE ISNULL(n2.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(n.ParentId, '00000000-0000-0000-0000-000000000000') AND n2.IsDeleted = 0)
    FROM dbo.Nodes n
    WHERE n.Id = @NodeId;

    COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH

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
    SET XACT_ABORT ON;

    -- Nodes to bring back: the node, its descendants, and any trashed ancestors (only the chain itself).
    DECLARE @ToRestore TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);

    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    INSERT INTO @ToRestore SELECT Id FROM Descendants;

    ;WITH Ancestors AS (
        SELECT p.Id, p.ParentId, p.IsDeleted FROM dbo.Nodes n INNER JOIN dbo.Nodes p ON p.Id = n.ParentId WHERE n.Id = @NodeId
        UNION ALL
        SELECT p.Id, p.ParentId, p.IsDeleted FROM Ancestors a INNER JOIN dbo.Nodes p ON p.Id = a.ParentId
    )
    INSERT INTO @ToRestore SELECT Id FROM Ancestors WHERE IsDeleted = 1 AND Id NOT IN (SELECT Id FROM @ToRestore);

    -- Restoring must not collide with a live sibling of the same name (nor with another restored node).
    IF EXISTS (SELECT 1
               FROM dbo.Nodes r
               INNER JOIN @ToRestore tr ON tr.Id = r.Id
               WHERE EXISTS (SELECT 1 FROM dbo.Nodes s
                             WHERE ISNULL(s.ParentId, '00000000-0000-0000-0000-000000000000') = ISNULL(r.ParentId, '00000000-0000-0000-0000-000000000000')
                               AND s.IsDeleted = 0 AND s.Id <> r.Id AND s.Name = r.Name))
        THROW 50001, 'A node with this name already exists in this folder.', 1;

    UPDATE dbo.Nodes
    SET IsDeleted = 0, DeletedAt = NULL
    WHERE Id IN (SELECT Id FROM @ToRestore);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Node_HardDelete
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Ids TABLE (Id UNIQUEIDENTIFIER PRIMARY KEY);
    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    INSERT INTO @Ids SELECT Id FROM Descendants;

    BEGIN TRY
    BEGIN TRAN;
    -- AuditLog.NodeId has no cascade: keep the history but detach it from the node being removed.
    UPDATE dbo.AuditLog SET NodeId = NULL WHERE NodeId IN (SELECT Id FROM @Ids);
    DELETE FROM dbo.Nodes WHERE Id IN (SELECT Id FROM @Ids);
    COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
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

    -- Walk up from every trashed node's parent to build its location (root first)
    -- and find the highest trashed ancestor (DeletedRootId) for grouping in the UI.
    ;WITH Trashed AS (
        SELECT * FROM dbo.Nodes WHERE OwnerId = @UserId AND IsDeleted = 1
    ),
    Up AS (
        SELECT t.Id AS NodeId, p.ParentId AS NextId, CAST(p.Name AS NVARCHAR(MAX)) AS PathText,
               CASE WHEN p.IsDeleted = 1 THEN p.Id ELSE NULL END AS TopDeleted
        FROM Trashed t
        INNER JOIN dbo.Nodes p ON p.Id = t.ParentId
        UNION ALL
        SELECT u.NodeId, p.ParentId, p.Name + N' / ' + u.PathText,
               CASE WHEN p.IsDeleted = 1 THEN p.Id ELSE u.TopDeleted END
        FROM Up u
        INNER JOIN dbo.Nodes p ON p.Id = u.NextId
    ),
    Full_ AS (
        SELECT NodeId, PathText, TopDeleted FROM Up WHERE NextId IS NULL
    )
    SELECT t.*,
           ISNULL(f.PathText, N'') AS Path,
           ISNULL(f.TopDeleted, t.Id) AS DeletedRootId
    FROM Trashed t
    LEFT JOIN Full_ f ON f.NodeId = t.Id
    ORDER BY t.DeletedAt DESC
    OPTION (MAXRECURSION 200);
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
