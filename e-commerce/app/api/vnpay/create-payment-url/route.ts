import crypto from "crypto";
import qs from "qs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { getOrderItems } from "@/libs/orderItems";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const delivery = getOrderDelivery(body);
  if (!delivery) return NextResponse.json({ error: "Please provide a valid recipient name, phone number and delivery address." }, { status: 400 });
  const cart = getOrderItems(body?.items);
  if (!cart) return NextResponse.json({ error: "Please review the products and quantities in your cart" }, { status: 400 });
  const { items, amount } = cart;

  const tmnCode = process.env.VNP_TMNCODE?.trim();
  const secretKey = process.env.VNP_HASHSECRET?.trim();
  if (!tmnCode || !secretKey || tmnCode === "TEST" || secretKey === "TEST") {
    return NextResponse.json({
      error: "VNPay is currently unavailable. Please choose another payment method.",
      code: "VNPAY_NOT_CONFIGURED",
    }, { status: 503 });
  }
  let vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = process.env.VNP_RETURNURL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/vnpay/vnpay-return`;

  const createDate = new Date();
  
  // VNPay requires GMT+7 even when the server runs in UTC.
  const createDateStr = new Date(createDate.getTime() + 7 * 60 * 60 * 1000)
    .toISOString().replace(/[-:T]/g, "").slice(0, 14);
  
  const orderId = createDate.getTime().toString(); // vnp_TxnRef

  // save pending order so returnUrl can update it
  await prisma.order.create({
      data: {
        userId: currentUser.id,
        ...delivery,
        amount: amount,
        currency: "vnd",
        paymentMethod: "VNPAY",
        status: "pending",
        deliveryStatus: "pending",
        products: items,
        paymentIntentId: orderId, // use paymentIntentId to store vnp_TxnRef
      },
  });

  const ipAddr = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip") || "127.0.0.1";

  let vnp_Params: Record<string, string | number> = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = 'en';
  vnp_Params['vnp_CurrCode'] = 'VND';
  vnp_Params['vnp_TxnRef'] = orderId;
  vnp_Params['vnp_OrderInfo'] = 'SGTech order ' + orderId;
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = amount * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = ipAddr;
  vnp_Params['vnp_CreateDate'] = createDateStr;
  vnp_Params['vnp_BankCode'] = body.bankCode || 'NCB';

  function sortObject(obj: Record<string, string | number>) {
    const sorted: Record<string, string> = {};
    const str: string[] = [];
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
  const signData = qs.stringify(vnp_Params, { encode: false });

  // Bước 3: Tạo mã băm (hash)
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
  
  vnp_Params['vnp_SecureHash'] = signed;
  vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

  return NextResponse.json({ url: vnpUrl });
}
