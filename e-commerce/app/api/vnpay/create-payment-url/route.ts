import crypto from "crypto";
import qs from "qs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items, amount } = body;

  const tmnCode = process.env.VNP_TMNCODE || "TEST";
  const secretKey = process.env.VNP_HASHSECRET || "TEST";
  let vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = process.env.VNP_RETURNURL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/vnpay/vnpay-return`;

  const createDate = new Date();
  
  // Format YYYYMMDDHHmmss
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  const createDateStr = `${createDate.getFullYear()}${pad(createDate.getMonth() + 1)}${pad(createDate.getDate())}${pad(createDate.getHours())}${pad(createDate.getMinutes())}${pad(createDate.getSeconds())}`;
  
  const orderId = createDate.getTime().toString(); // vnp_TxnRef

  // save pending order so returnUrl can update it
  await prisma.order.create({
      data: {
        userId: currentUser.id,
        amount: amount,
        currency: "vnd",
        paymentMethod: "VNPAY",
        status: "pending",
        deliveryStatus: "pending",
        products: items,
        paymentIntentId: orderId, // use paymentIntentId to store vnp_TxnRef
      },
  });

  const ipAddr = "127.0.0.1"; // simplified for test

  let vnp_Params: any = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = 'vn';
  vnp_Params['vnp_CurrCode'] = 'VND';
  vnp_Params['vnp_TxnRef'] = orderId;
  vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = amount * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = ipAddr;
  vnp_Params['vnp_CreateDate'] = createDateStr;

  vnp_Params = Object.keys(vnp_Params).sort().reduce((acc: any, key) => {
    acc[key] = vnp_Params[key];
    return acc;
  }, {});

  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
  vnp_Params['vnp_SecureHash'] = signed;
  vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

  return NextResponse.json({ url: vnpUrl });
}
