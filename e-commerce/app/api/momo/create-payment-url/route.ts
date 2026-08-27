import crypto from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { items, amount, address, phone } = body;

  const partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO";
  const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
  const secretKey =
    process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
  const apiEndpoint =
    process.env.MOMO_API_ENDPOINT ||
    "https://test-payment.momo.vn/v2/gateway/api/create";
  const redirectUrl =
    process.env.MOMO_REDIRECT_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/momo/momo-return`;
  const ipnUrl =
    process.env.MOMO_IPN_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/momo/momo-ipn`;

  const orderId = partnerCode + new Date().getTime();
  const requestId = orderId;
  const orderInfo = "Thanh toan don hang SGTech #" + orderId;
  // const requestType = "captureWallet";
  const requestType = "payWithATM";
  const extraData = "";
  const lang = "vi";
  const autoCapture = true;

  // Tạo pending order trong DB
  await prisma.order.create({
    data: {
      userId: currentUser.id,
      amount: amount,
      currency: "vnd",
      paymentMethod: "MOMO",
      status: "pending",
      deliveryStatus: "pending",
      products: items,
      paymentIntentId: orderId,
      address: address
        ? {
            city: "",
            country: "VN",
            line1: address,
            postal_code: "",
            state: "",
          }
        : undefined,
    },
  });

  // Tạo signature theo spec MoMo:
  // accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl
  // &orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode
  // &redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&");

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  // Gọi MoMo API
  const requestBody = {
    partnerCode,
    partnerName: "SGTech E-Commerce",
    storeId: "SGTechStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture,
    extraData,
    signature,
  };

  try {
    const momoResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000), // MoMo yêu cầu timeout tối thiểu 30s
    });

    const momoData = await momoResponse.json();

    if (momoData.resultCode === 0 && momoData.payUrl) {
      return NextResponse.json({ url: momoData.payUrl });
    } else {
      console.log("MoMo API Error:", momoData);
      return NextResponse.json(
        {
          error: momoData.message || "Failed to create MoMo payment",
          resultCode: momoData.resultCode,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.log("MoMo API Connection Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to MoMo" },
      { status: 500 },
    );
  }
}
