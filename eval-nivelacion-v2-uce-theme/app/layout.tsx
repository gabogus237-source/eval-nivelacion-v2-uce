import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Evaluación de Docentes — UCE',
  description: 'Encuesta de Nivelación',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <div className="container py-6">{children}</div>
      </body>
    </html>
  );
}
