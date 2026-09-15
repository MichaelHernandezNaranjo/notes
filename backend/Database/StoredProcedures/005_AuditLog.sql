-- =========================================================
-- SPs: AuditLog
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_Audit_Insert
    @UserId       UNIQUEIDENTIFIER,
    @NodeId       UNIQUEIDENTIFIER = NULL,
    @Action       NVARCHAR(100),
    @MetadataJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.AuditLog (UserId, NodeId, Action, MetadataJson)
    VALUES (@UserId, @NodeId, @Action, @MetadataJson);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Audit_GetByNode
    @NodeId UNIQUEIDENTIFIER,
    @Top    INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Top) a.*, u.DisplayName, u.AvatarUrl
    FROM dbo.AuditLog a
    INNER JOIN dbo.Users u ON u.Id = a.UserId
    WHERE a.NodeId = @NodeId
    ORDER BY a.CreatedAt DESC;
END
GO
