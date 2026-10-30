import "./globals.css";
import "./admin/admin.css";
import Script from "next/script";

export const metadata = {
  metadataBase: new URL("https://www.arthurmall.store"),

  title: {
    default: "Arthur's Mall | Smartphones & Electronics in Ghana",
    template: "%s | Arthur's Mall",
  },

  description:
    "Shop smartphones and electronics at Arthur's Mall. Discover quality products at competitive prices, enjoy convenient ordering, free delivery within Accra and payment on delivery.",

  applicationName: "Arthur's Mall",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "en_GH",
    url: "https://www.arthurmall.store",
    siteName: "Arthur's Mall",
    title: "Arthur's Mall | Smartphones & Electronics in Ghana",
    description:
      "Discover quality smartphones and electronics at competitive prices. Enjoy convenient ordering and free delivery within Accra.",
  },

  twitter: {
    card: "summary",
    title: "Arthur's Mall | Smartphones & Electronics in Ghana",
    description:
      "Shop smartphones and electronics at Arthur's Mall. Convenient ordering and delivery within Accra.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}

        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1751073295975492');
              fbq('track', 'PageView');
            `,
          }}
        />
      </body>
    </html>
  );
}
