namespace NotesApp.Api.Domain.Enums;

public enum NodeType
{
    Folder,
    Note
}

public enum GroupRole
{
    Owner,
    Admin,
    Member
}

public enum GranteeType
{
    User,
    Group,
    PublicLink
}

public enum AccessLevel
{
    Read,
    Edit,
    Owner
}
