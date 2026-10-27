import "server-only";
import sharp from "sharp";
import {FactoryInputError} from "./types";

/** Shared by the HTTP upload endpoint and standalone worker; no Next.js runtime imports. */
export async function normalizeFactoryImage(bytes:Uint8Array){
  const signature=Buffer.from(bytes.buffer,bytes.byteOffset,Math.min(bytes.byteLength,12));
  if(!(signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(signature[0]===255&&signature[1]===216)||(signature.toString("ascii",0,4)==="RIFF"&&signature.toString("ascii",8,12)==="WEBP")))throw new FactoryInputError("Choose a PNG, JPEG, or WebP image.");
  try{
    const image=sharp(bytes,{limitInputPixels:24_000_000,animated:false,failOn:"error"}),meta=await image.metadata();
    if(!["png","jpeg","webp"].includes(meta.format||"")||!meta.width||!meta.height||(meta.pages||1)!==1)throw new FactoryInputError("Choose a still PNG, JPEG, or WebP image.");
    const output=await image.rotate().resize({width:1800,height:1800,fit:"inside",withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
    if(output.byteLength>8_000_000)throw new FactoryInputError("This image is too large after processing. Choose a smaller image.");
    return output;
  }catch(error){if(error instanceof FactoryInputError)throw error;throw new FactoryInputError("This image could not be decoded. Choose a valid PNG, JPEG, or WebP image.");}
}
