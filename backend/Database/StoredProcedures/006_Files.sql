-- =========================================================
-- SPs: Files (image metadata; bytes are stored on disk)
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_File_Create
    @NodeId       UNIQUEIDENTIFIER,
    @StoredName   NVARCHAR(100),
    @OriginalName NVARCHAR(260),
    @ContentType  NVARCHAR(100),
    @SizeBytes    BIGINT,
    @CreatedBy    UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.NodeFiles (Id, NodeId, StoredName, OriginalName, ContentType, SizeBytes, CreatedBy)
    VALUES (@NewId, @NodeId, @StoredName, @OriginalName, @ContentType, @SizeBytes, @CreatedBy);

    SELECT * FROM dbo.NodeFiles WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_File_GetById
    @FileId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.NodeFiles WHERE Id = @FileId;
END
GO

-- Files of a node and of all its descendants (used to clean the disk before a permanent delete).
CREATE OR ALTER PROCEDURE dbo.sp_File_ListByNodeTree
    @NodeId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    ;WITH Descendants AS (
        SELECT Id FROM dbo.Nodes WHERE Id = @NodeId
        UNION ALL
        SELECT n.Id FROM dbo.Nodes n INNER JOIN Descendants d ON n.ParentId = d.Id
    )
    SELECT f.* FROM dbo.NodeFiles f WHERE f.NodeId IN (SELECT Id FROM Descendants);
END
GO
