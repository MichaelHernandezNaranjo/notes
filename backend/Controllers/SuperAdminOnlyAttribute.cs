using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using NotesApp.Api.Services;

namespace NotesApp.Api.Controllers;

/// <summary>
/// Restricts an action/controller to super admins. The role is read from the database (30 s cache), not from the JWT,
/// so a demotion takes effect almost immediately and a stolen old token cannot keep admin rights.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class SuperAdminOnlyAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var status = await context.HttpContext.RequestServices.GetRequiredService<IUserStatusService>()
            .GetAsync(context.HttpContext.User.GetUserId());
        if (!status.Exists || !status.IsActive || !status.IsSuperAdmin)
        {
            context.Result = new ObjectResult(new { error = "Super admin access required.", code = "forbidden" }) { StatusCode = StatusCodes.Status403Forbidden };
        }
    }
}
