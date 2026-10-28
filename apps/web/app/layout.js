import "./globals.css";
import "./admin/admin.css";

export const metadata = {
  title: "Arthur's Mall | Smart Shopping Starts Here",
  description:
    "Shop the Xiaomi Redmi 14C for GH₵ 1,550 at Arthur's Mall. Free delivery within Accra and payment on delivery.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
