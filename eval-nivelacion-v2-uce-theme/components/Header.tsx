export default function Header() {
  return (
    <header className="bg-uce-green text-white">
      <div className="container py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="UCE" className="h-8 w-8" />
          <div>
            <div className="kicker text-uce-gold">Universidad Central del Ecuador</div>
            <div className="font-semibold">Evaluación Docente — Nivelación</div>
          </div>
        </div>
        <span className="badge">Periodo actual</span>
      </div>
    </header>
  );
}
