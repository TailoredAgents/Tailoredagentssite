import Image from "next/image";
import logo from "@/public/brand/tailored-agents-logo.png";
import styles from "./brand-logo.module.css";

/** One shared lockup for public pages and the private workspace. */
export function BrandLogo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className={`${styles.logo} ${dark ? styles.dark : ""} ${compact ? styles.compact : ""}`}>
      <Image src={logo} alt="Tailored Agents" sizes={compact ? "160px" : "(max-width: 600px) 156px, 190px"} loading="eager" />
    </span>
  );
}
