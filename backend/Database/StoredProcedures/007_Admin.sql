-- =========================================================
-- SPs: Storage quota, administration and announcements
-- =========================================================

-- Default quota (bytes) from dbo.AppSettings; 250 MB if the setting is missing.
CREATE OR ALTER FUNCTION dbo.fn_DefaultQuotaBytes()
RETURNS BIGINT
AS
BEGIN
    RETURN ISNULL((SELECT TRY_CAST(SettingValue AS BIGINT) FROM dbo.AppSettings WHERE SettingKey = N'Storage.DefaultQuotaBytes'), 262144000);
END
GO

-- Bytes used by a user: text of every node they own (trash included) + images attached to those nodes.
CREATE OR ALTER FUNCTION dbo.fn_UsedBytes(@UserId UNIQUEIDENTIFIER)
RETURNS BIGINT
AS
BEGIN
    RETURN ISNULL((SELECT SUM(ContentSizeBytes) FROM dbo.Nodes WHERE OwnerId = @UserId), 0)
         + ISNULL((SELECT SUM(f.SizeBytes) FROM dbo.NodeFiles f INNER JOIN dbo.Nodes n ON n.Id = f.NodeId WHERE n.OwnerId = @UserId), 0);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Storage_GetUsage
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT dbo.fn_UsedBytes(u.Id) AS UsedBytes,
           CASE WHEN u.IsSuperAdmin = 1 THEN NULL ELSE ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) END AS QuotaBytes
    FROM dbo.Users u
    WHERE u.Id = @UserId;
END
GO

-- Raises 50003 when adding @AddBytes would take the owner over their quota (super admins are unlimited).
CREATE OR ALTER PROCEDURE dbo.sp_Storage_AssertAllowance
    @OwnerId  UNIQUEIDENTIFIER,
    @AddBytes BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    IF @AddBytes <= 0 RETURN;

    DECLARE @Quota BIGINT, @IsAdmin BIT;
    SELECT @IsAdmin = IsSuperAdmin, @Quota = ISNULL(StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) FROM dbo.Users WHERE Id = @OwnerId;
    IF @IsAdmin = 1 OR @Quota IS NULL RETURN;

    IF dbo.fn_UsedBytes(@OwnerId) + @AddBytes > @Quota
        THROW 50003, 'Storage limit reached.', 1;
END
GO

-- Checked before persisting a note snapshot: only growth is limited; shrinking is always allowed.
CREATE OR ALTER PROCEDURE dbo.sp_Node_AssertContentAllowance
    @NodeId   UNIQUEIDENTIFIER,
    @NewBytes BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Owner UNIQUEIDENTIFIER, @Current BIGINT, @Json BIGINT;
    SELECT @Owner = OwnerId, @Current = ContentSizeBytes, @Json = ISNULL(DATALENGTH(ContentJson), 0) FROM dbo.Nodes WHERE Id = @NodeId;
    IF @Owner IS NULL RETURN;

    DECLARE @Delta BIGINT = (@NewBytes + @Json) - @Current;
    EXEC dbo.sp_Storage_AssertAllowance @Owner, @Delta;
END
GO

-- ---------- Presence / last access ----------
CREATE OR ALTER PROCEDURE dbo.sp_User_TouchSeen
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET LastSeenAt = SYSUTCDATETIME()
    WHERE Id = @UserId AND (LastSeenAt IS NULL OR LastSeenAt < DATEADD(MINUTE, -2, SYSUTCDATETIME()));
END
GO

-- ---------- Admin: users ----------
CREATE OR ALTER PROCEDURE dbo.sp_Admin_ListUsers
    @Search NVARCHAR(100) = NULL,
    @Filter NVARCHAR(20)  = 'all',   -- all | active | blocked | admins | over | online
    @Sort   NVARCHAR(20)  = 'lastLogin', -- lastLogin | name | created | usage
    @Offset INT = 0,
    @Limit  INT = 25,
    @OnlineIds NVARCHAR(MAX) = NULL  -- comma-separated user ids with an open presence connection (filter 'online')
AS
BEGIN
    SET NOCOUNT ON;
    IF @Limit IS NULL OR @Limit < 1 OR @Limit > 100 SET @Limit = 25;
    IF @Offset IS NULL OR @Offset < 0 SET @Offset = 0;

    DECLARE @Esc NVARCHAR(250) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> N''
        SET @Esc = REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(@Search)), N'\', N'\\'), N'%', N'\%'), N'_', N'\_'), N'[', N'\[');

    ;WITH U AS (
        SELECT u.Id, u.Email, u.DisplayName, u.AvatarUrl, u.CreatedAt, u.LastLoginAt, u.LastSeenAt,
               u.IsActive, u.BlockedAt, u.BlockReason, u.IsSuperAdmin, u.StorageQuotaBytes,
               CASE WHEN u.IsSuperAdmin = 1 THEN NULL ELSE ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) END AS EffectiveQuotaBytes,
               dbo.fn_UsedBytes(u.Id) AS UsedBytes,
               (SELECT COUNT(*) FROM dbo.Nodes n WHERE n.OwnerId = u.Id AND n.Type = 'Note' AND n.IsDeleted = 0) AS NoteCount
        FROM dbo.Users u
        WHERE (@Esc IS NULL
               OR u.Email COLLATE Latin1_General_CI_AI LIKE N'%' + @Esc + N'%' ESCAPE N'\'
               OR u.DisplayName COLLATE Latin1_General_CI_AI LIKE N'%' + @Esc + N'%' ESCAPE N'\')
    )
    SELECT *, COUNT(*) OVER () AS TotalCount
    FROM U
    WHERE (@Filter = 'all'
           OR (@Filter = 'active' AND IsActive = 1)
           OR (@Filter = 'blocked' AND IsActive = 0)
           OR (@Filter = 'admins' AND IsSuperAdmin = 1)
           OR (@Filter = 'over' AND EffectiveQuotaBytes IS NOT NULL AND UsedBytes > EffectiveQuotaBytes)
           OR (@Filter = 'online' AND Id IN (SELECT TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) FROM STRING_SPLIT(ISNULL(@OnlineIds, N''), N',') WHERE LTRIM(RTRIM(value)) <> N'')))
    ORDER BY
        CASE WHEN @Sort = 'usage'   THEN UsedBytes END DESC,
        CASE WHEN @Sort = 'name'    THEN DisplayName END ASC,
        CASE WHEN @Sort = 'created' THEN CreatedAt END DESC,
        CASE WHEN @Sort = 'lastLogin' OR @Sort NOT IN ('usage', 'name', 'created') THEN ISNULL(LastLoginAt, '0001-01-01') END DESC,
        DisplayName
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_GetUser
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, Email, DisplayName, IsActive, IsSuperAdmin FROM dbo.Users WHERE Id = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_SetBlocked
    @UserId  UNIQUEIDENTIFIER,
    @Blocked BIT,
    @Reason  NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Users
        SET IsActive = CASE WHEN @Blocked = 1 THEN 0 ELSE 1 END,
            BlockedAt = CASE WHEN @Blocked = 1 THEN SYSUTCDATETIME() ELSE NULL END,
            BlockReason = CASE WHEN @Blocked = 1 THEN @Reason ELSE NULL END,
            UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @UserId;

        -- Blocking ends every session: refresh tokens can no longer be renewed.
        IF @Blocked = 1
            UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND RevokedAt IS NULL;
        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- NULL = back to the default quota.
CREATE OR ALTER PROCEDURE dbo.sp_Admin_SetQuota
    @UserId     UNIQUEIDENTIFIER,
    @QuotaBytes BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @QuotaBytes IS NOT NULL AND @QuotaBytes < 0 THROW 50005, 'Quota cannot be negative.', 1;
    UPDATE dbo.Users SET StorageQuotaBytes = @QuotaBytes, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
END
GO

-- Refuses (50004) to remove the last super admin.
CREATE OR ALTER PROCEDURE dbo.sp_Admin_SetSuperAdmin
    @UserId       UNIQUEIDENTIFIER,
    @IsSuperAdmin BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRAN;
        IF @IsSuperAdmin = 0
           AND NOT EXISTS (SELECT 1 FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE IsSuperAdmin = 1 AND Id <> @UserId AND IsActive = 1)
            THROW 50004, 'At least one super admin must remain.', 1;

        UPDATE dbo.Users SET IsSuperAdmin = @IsSuperAdmin, UpdatedAt = SYSUTCDATETIME() WHERE Id = @UserId;
        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- ---------- Admin: metrics ----------
CREATE OR ALTER PROCEDURE dbo.sp_Admin_Overview
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM dbo.Users) AS TotalUsers,
        (SELECT COUNT(*) FROM dbo.Users WHERE IsActive = 0) AS BlockedUsers,
        (SELECT COUNT(*) FROM dbo.Users WHERE IsSuperAdmin = 1) AS SuperAdmins,
        (SELECT COUNT(*) FROM dbo.Users WHERE LastSeenAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS Active7d,
        (SELECT COUNT(*) FROM dbo.Users WHERE LastSeenAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Active30d,
        (SELECT COUNT(*) FROM dbo.Users WHERE CreatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS NewUsers7d,
        (SELECT COUNT(*) FROM dbo.Nodes WHERE Type = 'Note' AND IsDeleted = 0) AS Notes,
        (SELECT COUNT(*) FROM dbo.Nodes WHERE Type = 'Folder' AND IsDeleted = 0) AS Folders,
        (SELECT COUNT(*) FROM dbo.Nodes WHERE IsDeleted = 1) AS TrashedItems,
        (SELECT COUNT(*) FROM dbo.NodeFiles) AS Images,
        ISNULL((SELECT SUM(ContentSizeBytes) FROM dbo.Nodes), 0) AS TextBytes,
        ISNULL((SELECT SUM(SizeBytes) FROM dbo.NodeFiles), 0) AS ImageBytes,
        (SELECT COUNT(*) FROM dbo.Users u
          WHERE u.IsSuperAdmin = 0 AND dbo.fn_UsedBytes(u.Id) > ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes())) AS OverQuotaUsers,
        dbo.fn_DefaultQuotaBytes() AS DefaultQuotaBytes;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_DatabaseSize
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(SUM(CAST(size AS BIGINT)) * 8192 AS BIGINT) AS DataBytes
    FROM sys.database_files
    WHERE type = 0;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Admin_TopUsers
    @Top INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    IF @Top IS NULL OR @Top < 1 OR @Top > 50 SET @Top = 10;
    SELECT TOP (@Top) u.Id, u.DisplayName, u.Email, dbo.fn_UsedBytes(u.Id) AS UsedBytes,
           CASE WHEN u.IsSuperAdmin = 1 THEN NULL ELSE ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) END AS QuotaBytes
    FROM dbo.Users u
    ORDER BY dbo.fn_UsedBytes(u.Id) DESC;
END
GO

-- One row per day for the last @Days days: sign-ups, audited actions and distinct users that acted.
CREATE OR ALTER PROCEDURE dbo.sp_Admin_Activity
    @Days INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    IF @Days IS NULL OR @Days < 1 OR @Days > 90 SET @Days = 30;

    ;WITH Days AS (
        SELECT CAST(DATEADD(DAY, -(@Days - 1), CAST(SYSUTCDATETIME() AS DATE)) AS DATE) AS Day
        UNION ALL
        SELECT DATEADD(DAY, 1, Day) FROM Days WHERE Day < CAST(SYSUTCDATETIME() AS DATE)
    )
    SELECT d.Day,
           (SELECT COUNT(*) FROM dbo.Users u WHERE CAST(u.CreatedAt AS DATE) = d.Day) AS Signups,
           (SELECT COUNT(*) FROM dbo.AuditLog a WHERE CAST(a.CreatedAt AS DATE) = d.Day) AS Actions,
           (SELECT COUNT(DISTINCT a.UserId) FROM dbo.AuditLog a WHERE CAST(a.CreatedAt AS DATE) = d.Day) AS ActiveUsers
    FROM Days d
    ORDER BY d.Day
    OPTION (MAXRECURSION 100);
END
GO

-- ---------- Announcements ----------
CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Create
    @Title        NVARCHAR(200),
    @Message      NVARCHAR(2000),
    @Severity     NVARCHAR(10) = 'Info',
    @TargetUserId UNIQUEIDENTIFIER = NULL,
    @ExpiresAt    DATETIME2(3) = NULL,
    @CreatedBy    UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Id UNIQUEIDENTIFIER = NEWID();
    INSERT dbo.Announcements (Id, Title, Message, Severity, TargetUserId, CreatedBy, ExpiresAt)
    VALUES (@Id, @Title, @Message, @Severity, @TargetUserId, @CreatedBy, @ExpiresAt);

    SELECT a.Id, a.Title, a.Message, a.Severity, a.TargetUserId, NULL AS TargetName, a.CreatedAt, a.ExpiresAt, 0 AS DismissedCount
    FROM dbo.Announcements a WHERE a.Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Update
    @Id        UNIQUEIDENTIFIER,
    @Title     NVARCHAR(200),
    @Message   NVARCHAR(2000),
    @Severity  NVARCHAR(10),
    @ExpiresAt DATETIME2(3) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Announcements SET Title = @Title, Message = @Message, Severity = @Severity, ExpiresAt = @ExpiresAt WHERE Id = @Id;
    -- An edited notice is shown again to people who had dismissed the old text.
    DELETE FROM dbo.AnnouncementDismissals WHERE AnnouncementId = @Id;

    SELECT a.Id, a.Title, a.Message, a.Severity, a.TargetUserId, t.DisplayName AS TargetName, a.CreatedAt, a.ExpiresAt, 0 AS DismissedCount
    FROM dbo.Announcements a LEFT JOIN dbo.Users t ON t.Id = a.TargetUserId WHERE a.Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Delete
    @Id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Announcements WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_ListAdmin
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.Id, a.Title, a.Message, a.Severity, a.TargetUserId, t.DisplayName AS TargetName, a.CreatedAt, a.ExpiresAt,
           (SELECT COUNT(*) FROM dbo.AnnouncementDismissals d WHERE d.AnnouncementId = a.Id) AS DismissedCount
    FROM dbo.Announcements a
    LEFT JOIN dbo.Users t ON t.Id = a.TargetUserId
    ORDER BY a.CreatedAt DESC;
END
GO

-- Notices that apply to the user, are not expired and have not been dismissed.
CREATE OR ALTER PROCEDURE dbo.sp_Announcement_ListPending
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.Id, a.Title, a.Message, a.Severity, a.CreatedAt, a.ExpiresAt
    FROM dbo.Announcements a
    WHERE (a.ExpiresAt IS NULL OR a.ExpiresAt > SYSUTCDATETIME())
      AND (a.TargetUserId IS NULL OR a.TargetUserId = @UserId)
      AND NOT EXISTS (SELECT 1 FROM dbo.AnnouncementDismissals d WHERE d.AnnouncementId = a.Id AND d.UserId = @UserId)
    ORDER BY a.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Announcement_Dismiss
    @UserId UNIQUEIDENTIFIER,
    @Id     UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Announcements WHERE Id = @Id)
       AND NOT EXISTS (SELECT 1 FROM dbo.AnnouncementDismissals WHERE AnnouncementId = @Id AND UserId = @UserId)
        INSERT dbo.AnnouncementDismissals (AnnouncementId, UserId) VALUES (@Id, @UserId);
END
GO
