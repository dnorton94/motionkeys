import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotionKeys — Play the air",
  description: "A virtual piano powered by MediaPipe hand tracking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
