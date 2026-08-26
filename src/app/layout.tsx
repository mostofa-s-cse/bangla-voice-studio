import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "বাংলা ভয়েস ও অডিও জেনারেটর | Gemini TTS",
  description:
    "যেকোনো বাংলা টেক্সট থেকে Gemini AI দ্বারা প্রাকৃতিক অডিও ভয়েস তৈরি করুন — কাস্টম ভয়েস ক্লোনিং ও ভিডিও সাবটাইটেল সিঙ্ক সহ।",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;600;700;800&family=Galada&family=Hind+Siliguri:wght@400;500;600;700&family=Mina:wght@400;700&family=Noto+Serif+Bengali:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Tiro+Bangla:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-[#0f172a] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
