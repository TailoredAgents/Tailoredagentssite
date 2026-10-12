import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <section className="section-pad"><div className="content-narrow"><span className="eyebrow">404 · Not found</span><h1 className="page-title" style={{margin:"1.2rem 0"}}>This path does not lead to a <span className="serif-italic">working system.</span></h1><p className="lede">The page may have moved or the address may be incorrect.</p><Link className="button button-dark" href="/"><ArrowLeft size={15}/>Return home</Link></div></section>;
}
