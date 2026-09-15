export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl p-8 text-sm text-neutral-300">
      <h2 className="mb-4 text-xl font-semibold text-white">Acerca de</h2>
      <p className="mb-4">
        Collaborative Workspace &amp; Note App es una plataforma modular de gestión de notas y archivos con
        edición colaborativa en tiempo real.
      </p>
      <h3 className="mb-2 mt-6 text-base font-medium text-white">Arquitectura</h3>
      <ul className="list-inside list-disc space-y-1">
        <li>Frontend: React + TypeScript + TailwindCSS</li>
        <li>Editor: BlockNote sobre un documento Yjs (CRDT)</li>
        <li>Tiempo real: ASP.NET Core SignalR</li>
        <li>Backend: .NET 10 Web API, arquitectura por capas</li>
        <li>Datos: SQL Server + Dapper, 100% a través de Stored Procedures</li>
      </ul>
    </div>
  );
}
