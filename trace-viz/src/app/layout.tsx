import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TraceViz — Agent Trace Replay',
  description: 'Replay agent traces like a video. Step through tool calls, see reasoning, visualize transitions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
