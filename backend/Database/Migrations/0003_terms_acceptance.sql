-- =========================================================
-- Legal acceptance: which version of the Terms & Privacy Policy each user accepted, and when.
-- Applied once by db-init (versioned migration); never edit after it has been deployed.
-- =========================================================
IF COL_LENGTH('dbo.Users', 'TermsAcceptedVersion') IS NULL
    ALTER TABLE dbo.Users ADD TermsAcceptedVersion NVARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.Users', 'TermsAcceptedAt') IS NULL
    ALTER TABLE dbo.Users ADD TermsAcceptedAt DATETIME2(3) NULL;
GO
