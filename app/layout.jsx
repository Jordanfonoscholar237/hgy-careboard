export const metadata = {
  title: 'LifeView Central',
  description: 'Hospital-wide patient monitoring dashboard and portal.'
};

export default function RootLayout({children}){
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
