import crypto from "crypto";
import qs from "qs";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  let vnp_Params: any = {};

  for (const [key, value] of searchParams.entries()) {
    vnp_Params[key] = value;
  }

  const secureHash = vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  function sortObject(obj: any) {
    let sorted: any = {};
    let str = [];
    let key;
    for (key in obj){
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  }

  vnp_Params = sortObject(vnp_Params);
  const secretKey = process.env.VNP_HASHSECRET || "TEST";
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  if (secureHash === signed) {
    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];
    
    if (rspCode === '00') {
      // Payment success
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "paid" },
      });
      return NextResponse.redirect(new URL("/checkout?vnpay=success", req.url)); 
    } else {
      // Payment failed
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "failed" },
      });
      return NextResponse.redirect(new URL("/checkout?vnpay=failed", req.url));
    }
  } else {
    // Checksum failed
    return NextResponse.redirect(new URL("/checkout?vnpay=invalid_signature", req.url));
  }
}
