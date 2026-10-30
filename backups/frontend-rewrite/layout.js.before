import "./globals.css";
import "./admin/admin.css";
import Script from "next/script";

export const metadata = {
title: "Arthur Mall | Smart Shopping Starts Here",
description:
"Shop the Xiaomi Redmi 14C for GH₵ 1,550 at Arthur Mall. Free delivery within Accra and payment on delivery.",
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
