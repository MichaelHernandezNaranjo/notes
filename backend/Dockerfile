FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NotesApp.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish NotesApp.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
# Image storage: a new named volume inherits this ownership, so the non-root user can write to it.
RUN mkdir -p /data/files && chown $APP_UID /data/files
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Files__RootPath=/data/files
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "NotesApp.Api.dll"]
