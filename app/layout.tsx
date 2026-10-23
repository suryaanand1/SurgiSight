import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SurgiSight | Objective Surgical Practice Analysis",
  description: "A focused workflow for reviewing surgical skills practice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
