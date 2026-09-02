import "./globals.css";

export const metadata = {
  title: "HESH AI STUDIO",
  description: "Created by Dinidu Heshan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="si">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

