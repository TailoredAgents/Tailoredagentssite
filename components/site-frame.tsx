"use client";

import { usePathname } from "next/navigation";

const applicationRoutes = ["/dashboard", "/sign-in"];

export function SiteFrame({
  children,
  header,
  footer,
  structuredData,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  structuredData: React.ReactNode;
}) {
  const pathname = usePathname();
  const isApplicationRoute = applicationRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isApplicationRoute) {
    return <main id="main-content" className="application-main">{children}</main>;
  }

  return (
    <>
      {header}
      <main id="main-content">{children}</main>
      {footer}
      {structuredData}
    </>
  );
}
