-- =========================================================
-- SPs: Groups & GroupMembers
-- =========================================================
CREATE OR ALTER PROCEDURE dbo.sp_Group_Create
    @Name        NVARCHAR(200),
    @Description NVARCHAR(1000) = NULL,
    @CreatedBy   UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.Groups (Id, Name, Description, CreatedBy)
    VALUES (@NewId, @Name, @Description, @CreatedBy);

    INSERT INTO dbo.GroupMembers (GroupId, UserId, Role)
    VALUES (@NewId, @CreatedBy, 'Owner');

    SELECT * FROM dbo.Groups WHERE Id = @NewId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Group_AddMember
    @GroupId UNIQUEIDENTIFIER,
    @UserId  UNIQUEIDENTIFIER,
    @Role    NVARCHAR(20) = 'Member'
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.GroupMembers WHERE GroupId = @GroupId AND UserId = @UserId)
    BEGIN
        INSERT INTO dbo.GroupMembers (GroupId, UserId, Role)
        VALUES (@GroupId, @UserId, @Role);
    END
    SELECT * FROM dbo.GroupMembers WHERE GroupId = @GroupId AND UserId = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Group_RemoveMember
    @GroupId UNIQUEIDENTIFIER,
    @UserId  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.GroupMembers WHERE GroupId = @GroupId AND UserId = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Group_GetMembers
    @GroupId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT gm.GroupId, gm.UserId, gm.Role, gm.JoinedAt,
           u.Email, u.DisplayName, u.AvatarUrl
    FROM dbo.GroupMembers gm
    INNER JOIN dbo.Users u ON u.Id = gm.UserId
    WHERE gm.GroupId = @GroupId
    ORDER BY gm.JoinedAt ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Group_ListByUser
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT g.*, gm.Role
    FROM dbo.Groups g
    INNER JOIN dbo.GroupMembers gm ON gm.GroupId = g.Id
    WHERE gm.UserId = @UserId AND g.IsDeleted = 0
    ORDER BY g.Name ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Group_Delete
    @GroupId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Groups SET IsDeleted = 1 WHERE Id = @GroupId;
END
GO
