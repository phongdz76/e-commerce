"use client";

import { formatPrice } from "@/utils/formatPrice";
import { useCart } from "../hooks/useCart";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { StripePaymentContext } from "./StripePaymentElement";
import toast from "react-hot-toast";
import Heading from "../components/Headinng";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Button from "../components/Button";
import { safeUser } from "@/types";
import axios from "axios";
import { API_PATHS } from "../../utils/apiPaths";
import { PROVINCES_API } from "../../utils/externalApiPaths";
import type { CheckoutDelivery, CheckoutQuote, CheckoutPreparation } from "@/types/checkout";

const PHONE_REGEX = /^\+?[0-9]{9,15}$/;
type LocationLevel = "province" | "district" | "ward";
type DeliveryField = LocationLevel | "fullName" | "houseNumber" | "phoneNumber" | "deliveryCity";
interface LocationOption {
  code: number;
  name: string;
}

function LocationStatus({
  level,
  loading,
  error,
  onRetry,
}: {
  level: LocationLevel;
  loading?: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <div id={`${level}-status`}>
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading locations...
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-rose-600"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 font-medium text-teal-700 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

interface CheckoutFormProps {
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  stripeContext: StripePaymentContext;
  cardPayment: ReactNode;
  handleSetPaymentSuccess: (
    value: boolean,
    orderId?: string,
    receipt?: CheckoutReceipt,
  ) => void;
  currentUser: safeUser | null;
  stripeOrderId?: string | null;
  availablePaymentMethods?: Record<string, boolean>;
  onQuoteChange?: (value: CheckoutPreparation | null) => void;
}

export interface CheckoutReceipt {
  amount: number;
  paymentMethod: string;
}

export default function CheckoutForm({
  paymentMethod,
  onPaymentMethodChange,
  stripeContext,
  cardPayment,
  handleSetPaymentSuccess,
  currentUser,
  stripeOrderId,
  availablePaymentMethods,
  onQuoteChange,
}: CheckoutFormProps) {
  const {
    cartTotalQtyAmount,
    handleClearCart,
    handleSetPaymentIntent,
    cartProducts,
  } = useCart().context;
  const { stripe, elements } = stripeContext;
  const [isLoading, setLoading] = useState<boolean>(false);
  const submitting = useRef(false);
  const [fullName, setFullName] = useState(currentUser?.name || "");
  const hasSavedAddress = Boolean(currentUser?.address?.trim());
  const hasSavedPhone = Boolean(currentUser?.phoneNumber?.trim());
  const hasSavedDeliveryInfo = hasSavedAddress && hasSavedPhone;

  const [isEditingDeliveryInfo, setIsEditingDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);
  const [shouldSaveDeliveryInfo, setShouldSaveDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);

  const [houseNumber, setHouseNumber] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [province, setProvince] = useState<LocationOption | null>(null);
  const [district, setDistrict] = useState<LocationOption | null>(null);
  const [ward, setWard] = useState<LocationOption | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<DeliveryField, string>>
  >({});
  const [locationErrors, setLocationErrors] = useState<
    Partial<Record<LocationLevel, string>>
  >({});
  const [locationLoading, setLocationLoading] = useState<
    Partial<Record<LocationLevel, boolean>>
  >({ province: true });
  const locationRequests = useRef({ province: 0, district: 0, ward: 0 });

  const [phoneNumber, setPhoneNumber] = useState(
    currentUser?.phoneNumber || "",
  );
  const [zaloPayOrderId, setZaloPayOrderId] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const checkoutRequest = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const selectedSavedProvince = provinces.find(option => String(option.code) === deliveryCity);
  const deliveryInput: CheckoutDelivery = {
    fullName: fullName.trim(),
    phone: (isEditingDeliveryInfo ? phoneNumber : currentUser?.phoneNumber || phoneNumber).replace(/\s+/g, ""),
    address: isEditingDeliveryInfo ? [houseNumber, ward?.name, district?.name, province?.name].filter(Boolean).join(", ").trim() : currentUser?.address?.trim() || "",
    city: (isEditingDeliveryInfo ? province?.name : selectedSavedProvince?.name) || "",
    provinceCode: String((isEditingDeliveryInfo ? province?.code : selectedSavedProvince?.code) || ""),
    ...(isEditingDeliveryInfo && district ? { districtCode: String(district.code) } : {}),
    ...(isEditingDeliveryInfo && ward ? { wardCode: String(ward.code) } : {}),
  };
  const quoteFingerprint = JSON.stringify([cartProducts, deliveryInput]);
  const [quoteRecord, setQuoteRecord] = useState<{ fingerprint: string; quote: CheckoutQuote } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const quoteRequest = useRef(0);
  const quote = quoteRecord?.fingerprint === quoteFingerprint ? quoteRecord.quote : null;
  const cardDeliveryLocked = paymentMethod === "STRIPE" && Boolean(quote);
  const formattedPrice = formatPrice(quote?.totals.grandTotal ?? cartTotalQtyAmount);
  useEffect(() => { quoteRequest.current++; }, [quoteFingerprint]);
  useEffect(() => {
    onQuoteChange?.(quote ? { quote, delivery: JSON.parse(quoteFingerprint)[1] } : null);
  }, [quote, quoteFingerprint, onQuoteChange]);

  async function getDeliveryQuote() {
    if (quoting || cardDeliveryLocked) return;
    if (!deliveryInput.fullName || !PHONE_REGEX.test(deliveryInput.phone) || !deliveryInput.address || !deliveryInput.provinceCode ||
        (isEditingDeliveryInfo && (!district || !ward || !houseNumber.trim()))) {
      setQuoteError("Complete the recipient, phone and delivery address, including the province or city, before requesting a quote."); return;
    }
    const request = ++quoteRequest.current;
    setQuoting(true); setQuoteError("");
    try {
      const response = await axios.post<CheckoutQuote>(API_PATHS.ORDER.CHECKOUT_QUOTE, { items: cartProducts, ...deliveryInput });
      if (request === quoteRequest.current) setQuoteRecord({ fingerprint: quoteFingerprint, quote: response.data });
    } catch (failure) {
      const message = axios.isAxiosError(failure) ? failure.response?.data?.error : null;
      if (request === quoteRequest.current) { setQuoteRecord(null); setQuoteError(typeof message === "string" ? message : "Unable to get delivery pricing. Your cart and address have been kept."); }
    } finally { setQuoting(false); }
  }

  useEffect(() => {
    if (paymentMethod !== "MOMO") return;
    const resumeCheckout = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      submitting.current = false;
      setLoading(false);
    };
    window.addEventListener("pageshow", resumeCheckout);
    return () => window.removeEventListener("pageshow", resumeCheckout);
  }, [paymentMethod]);

  const getCheckoutRequestId = () => {
    const fingerprint = JSON.stringify([
      currentUser?.id,
      cartProducts?.map((item) => [
        item.id,
        item.variantId,
        item.price,
        item.selectedImg.color,
        item.quantity,
      ]),
    ]);
    if (checkoutRequest.current?.fingerprint === fingerprint) {
      return checkoutRequest.current.id;
    }
    try {
      const saved = JSON.parse(
        localStorage.getItem("orderCheckoutRequest") || "null",
      );
      if (saved?.fingerprint === fingerprint && typeof saved.id === "string") {
        checkoutRequest.current = saved;
        return saved.id;
      }
    } catch {
      // The in-memory request ID also protects retries when storage is unavailable.
    }
    const request = { fingerprint, id: crypto.randomUUID() };
    checkoutRequest.current = request;
    try {
      localStorage.setItem("orderCheckoutRequest", JSON.stringify(request));
    } catch {
      // Continue using the request ID retained in this form.
    }
    return request.id;
  };

  const loadLocations = useCallback(
    async (level: LocationLevel, url: string) => {
      const request = ++locationRequests.current[level];
      setLocationLoading((previous) => ({ ...previous, [level]: true }));
      setLocationErrors((previous) => ({ ...previous, [level]: undefined }));
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Address lookup failed");
        }
        const data = await response.json();
        const options =
          level === "province"
            ? data
            : level === "district"
              ? data.districts
              : data.wards;
        if (!Array.isArray(options)) {
          throw new Error("Invalid address response");
        }
        if (request !== locationRequests.current[level]) {
          return;
        }
        if (level === "province") {
          setProvinces(options);
        } else if (level === "district") {
          setDistricts(options);
        } else {
          setWards(options);
        }
      } catch {
        if (request === locationRequests.current[level]) {
          setLocationErrors((previous) => ({
            ...previous,
            [level]: "We couldn't load these locations. Please try again.",
          }));
        }
      } finally {
        if (request === locationRequests.current[level]) {
          setLocationLoading((previous) => ({ ...previous, [level]: false }));
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const requests = locationRequests.current;
    void Promise.resolve().then(() => {
      if (active) {
        return loadLocations("province", PROVINCES_API.GET_ALL);
      }
    });
    return () => {
      active = false;
      requests.province++;
      requests.district++;
      requests.ward++;
    };
  }, [loadLocations]);

  const clearFieldError = (field: DeliveryField) =>
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  const renderFieldError = (field: DeliveryField) =>
    fieldErrors[field] && (
      <p id={`${field}-error`} role="alert" className="text-sm text-rose-600">
        {fieldErrors[field]}
      </p>
    );

  const handleProvinceChange = (code: string) => {
    const p = provinces.find((x) => String(x.code) === code);
    setProvince(p ?? null);
    clearFieldError("province");
    locationRequests.current.district++;
    locationRequests.current.ward++;
    setLocationErrors((previous) => ({
      ...previous,
      district: undefined,
      ward: undefined,
    }));
    setLocationLoading((previous) => ({
      ...previous,
      district: false,
      ward: false,
    }));
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    if (p) {
      void loadLocations("district", PROVINCES_API.GET_PROVINCE(p.code));
    }
  };

  const handleDistrictChange = (code: string) => {
    const d = districts.find((x) => String(x.code) === code);
    setDistrict(d ?? null);
    clearFieldError("district");
    locationRequests.current.ward++;
    setLocationErrors((previous) => ({ ...previous, ward: undefined }));
    setLocationLoading((previous) => ({ ...previous, ward: false }));
    setWard(null);
    setWards([]);
    if (d) {
      void loadLocations("ward", PROVINCES_API.GET_DISTRICT(d.code));
    }
  };

  const handleWardChange = (code: string) => {
    const w = wards.find((x) => String(x.code) === code);
    setWard(w ?? null);
    clearFieldError("ward");
  };

  const getFinalAddress = () => {
    const parts = [houseNumber];
    if (ward) {
      parts.push(ward.name);
    }
    if (district) {
      parts.push(district.name);
    }
    if (province) {
      parts.push(province.name);
    }
    return parts.filter(Boolean).join(", ");
  };

  const handleStartEditingDeliveryInfo = () => {
    setIsEditingDeliveryInfo(true);
    setShouldSaveDeliveryInfo(false);
  };

  const handleCancelEditingDeliveryInfo = () => {
    setFieldErrors({});
    locationRequests.current.district++;
    locationRequests.current.ward++;
    setIsEditingDeliveryInfo(false);
    setShouldSaveDeliveryInfo(false);
    setHouseNumber("");
    setProvince(null);
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    setPhoneNumber(currentUser?.phoneNumber || "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) {
      return;
    }
    if (!quote) { toast.error("Get a delivery quote and review the total before ordering."); return; }
    if (availablePaymentMethods?.[paymentMethod] === false) {
      toast.error(
        "This payment method is currently unavailable. Please choose another method.",
      );
      return;
    }

    if (paymentMethod === "STRIPE" && (!stripe || !elements)) {
      toast.error(
        "Card payment is still loading. Please try again in a moment.",
      );
      return;
    }

    const normalizedPhone = phoneNumber.replace(/\s+/g, "");
    const finalAddress = isEditingDeliveryInfo
      ? getFinalAddress()
      : currentUser?.address || "";
    const finalCity = deliveryInput.city;
    const finalPhone = isEditingDeliveryInfo
      ? normalizedPhone
      : (currentUser?.phoneNumber || normalizedPhone).replace(/\s+/g, "");

    const errors: Partial<Record<DeliveryField, string>> = {};
    if (!isEditingDeliveryInfo && (!finalCity || finalCity.length > 100)) {
      errors.deliveryCity = "Enter the province or city for this delivery address (up to 100 characters).";
    }
    if (!fullName.trim()) {
      errors.fullName = "Please enter the recipient's full name.";
    } else if (fullName.trim().length > 100) {
      errors.fullName =
        "Use no more than 100 characters for the recipient's name.";
    }
    if (isEditingDeliveryInfo) {
      if (!province) {
        errors.province = "Please select a province or city.";
      }
      if (!district) {
        errors.district = "Please select a district.";
      }
      if (!ward) {
        errors.ward = "Please select a ward.";
      }
      if (!houseNumber.trim()) {
        errors.houseNumber = "Please enter your house number and street.";
      }
    }
    if (!finalAddress.trim()) {
      errors.houseNumber = "Please enter a delivery address.";
    } else if (finalAddress.trim().length > 500) {
      errors.houseNumber =
        "Use no more than 500 characters for the delivery address.";
    }
    if (!PHONE_REGEX.test(finalPhone)) {
      errors.phoneNumber = "Enter a valid phone number with 9–15 digits.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }

    setLoading(true);
    submitting.current = true;

    if (paymentMethod === "STRIPE") {
      if (!stripe || !elements) {
        return;
      }
      stripe
        .confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${window.location.origin}/checkout?stripe=return`,
            shipping: {
              name: fullName.trim(),
              phone: finalPhone,
              address: { line1: finalAddress, city: finalCity, country: "VN" },
            },
          },
        })
        .then(async (result) => {
          if (result.error) {
            toast.error(
              result.error.message || "Payment failed. Please try again.",
            );
          } else if (
            result.paymentIntent &&
            ["succeeded", "processing", "requires_capture"].includes(
              result.paymentIntent.status,
            )
          ) {
            let isConfirmed = false;
            try {
              const response = await axios.post(
                API_PATHS.PAYMENT.SYNC_STRIPE_ORDER,
                { payment_intent_id: result.paymentIntent.id },
              );
              if (response.data.order?.status === "complete") {
                isConfirmed = true;
                toast.success("Payment successful!");
                handleSetPaymentSuccess(true, response.data.order.id, {
                  amount: response.data.order.amount,
                  paymentMethod: "STRIPE",
                });
                handleClearCart();
                handleSetPaymentIntent(null);
              } else {
                setPendingOrderId(
                  response.data.order?.id || stripeOrderId || null,
                );
                toast("Payment is processing. Check Your Orders for updates.");
              }
            } catch {
              setPendingOrderId(stripeOrderId || null);
              toast("Check Your Orders for the latest payment status.");
            }

            if (isConfirmed && currentUser && shouldSaveDeliveryInfo) {
              try {
                await axios.patch(API_PATHS.AUTH.PROFILE, {
                  address: finalAddress,
                  phoneNumber: finalPhone,
                });
              } catch (error) {
                console.log("Failed to sync profile address", error);
              }
            }
          }
          setLoading(false);
          submitting.current = false;
        })
        .catch(() => {
          toast.error("Unable to complete card payment. Please try again.");
          setLoading(false);
          submitting.current = false;
        });
    } else if (paymentMethod === "VNPAY") {
      try {
        const response = await axios.post(API_PATHS.PAYMENT.VNPAY_CREATE_URL, {
          checkout_request_id: getCheckoutRequestId(),
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
          fullName: fullName.trim(),
          city: finalCity,
          provinceCode: deliveryInput.provinceCode,
          districtCode: deliveryInput.districtCode,
          wardCode: deliveryInput.wardCode,
          quoteToken: quote.token,
        });

        if (response.data.alreadyPaid) {
          handleSetPaymentSuccess(true, response.data.orderId, {
            amount: response.data.amount,
            paymentMethod: "VNPAY",
          });
          handleClearCart();
          setLoading(false);
          submitting.current = false;
          return;
        }

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch {
            /* The order can proceed if saving the profile fails. */
          }
        }

        if (response.data.url) {
          window.location.href = response.data.url;
        } else {
          toast.error("Failed to create VNPay URL");
          setLoading(false);
          submitting.current = false;
        }
      } catch (error) {
        console.log(error);
        if (axios.isAxiosError(error) && error.response?.data?.orderId) {
          setPendingOrderId(error.response.data.orderId);
        }
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error
          : undefined;
        toast.error(
          typeof message === "string" ? message : "Error connecting to VNPay",
        );
        setLoading(false);
        submitting.current = false;
      }
    } else if (paymentMethod === "MOMO") {
      let redirecting = false;
      try {
        const response = await axios.post(API_PATHS.PAYMENT.MOMO_CREATE_URL, {
          checkout_request_id: getCheckoutRequestId(),
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
          fullName: fullName.trim(),
          city: finalCity,
          provinceCode: deliveryInput.provinceCode,
          districtCode: deliveryInput.districtCode,
          wardCode: deliveryInput.wardCode,
          quoteToken: quote.token,
        });

        if (response.data.alreadyPaid) {
          handleSetPaymentSuccess(true, response.data.orderId, {
            amount: response.data.amount,
            paymentMethod: "MOMO",
          });
          handleClearCart();
          return;
        }

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch {
            /* The order can proceed if saving the profile fails. */
          }
        }

        if (response.data.url && response.data.orderId) {
          window.location.assign(response.data.url);
          redirecting = true;
        } else {
          toast.error("Failed to create MoMo payment URL");
        }
      } catch (error) {
        console.log(error);
        if (axios.isAxiosError(error) && error.response?.data?.orderId) {
          setPendingOrderId(error.response.data.orderId);
        }
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error
          : undefined;
        toast.error(
          typeof message === "string" ? message : "Error connecting to MoMo",
        );
      } finally {
        if (!redirecting) {
          setLoading(false);
          submitting.current = false;
        }
      }
    } else if (paymentMethod === "ZALOPAY") {
      const payload = {
        items: cartProducts,
        address: finalAddress,
        phone: finalPhone,
        fullName: fullName.trim(),
        city: finalCity,
        provinceCode: deliveryInput.provinceCode,
        districtCode: deliveryInput.districtCode,
        wardCode: deliveryInput.wardCode,
      };
      const fingerprint = JSON.stringify(payload);
      let requestId = crypto.randomUUID();
      try {
        const saved = JSON.parse(
          localStorage.getItem("zaloPayCheckout") || "null",
        );
        if (
          saved?.fingerprint === fingerprint &&
          typeof saved.requestId === "string"
        ) {
          requestId = saved.requestId;
        }
        localStorage.setItem(
          "zaloPayCheckout",
          JSON.stringify({ fingerprint, requestId }),
        );
      } catch {
        /* Payment still works if browser storage is unavailable. */
      }
      try {
        const response = await axios.post(
          API_PATHS.PAYMENT.ZALOPAY_CREATE_URL,
          { ...payload, checkout_request_id: requestId, quoteToken: quote.token },
        );
        setZaloPayOrderId(response.data.orderId);
        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch {
            /* Saving the profile must not prevent paying for an existing order. */
          }
        }
        if (response.data.alreadyPaid) {
          handleSetPaymentSuccess(true, response.data.orderId, {
            amount: response.data.amount,
            paymentMethod: "ZALOPAY",
          });
          handleClearCart();
        } else if (response.data.url) {
          window.location.assign(response.data.url);
        } else {
          toast.error(
            "Unable to open ZaloPay payment. Check your order status.",
          );
        }
      } catch (error) {
        const data = axios.isAxiosError(error)
          ? error.response?.data
          : undefined;
        if (data?.orderId) {
          setZaloPayOrderId(data.orderId);
        }
        if (data?.code === "ZALOPAY_CREATE_FAILED") {
          try {
            localStorage.removeItem("zaloPayCheckout");
          } catch {
            /* Storage is optional. */
          }
        }
        toast.error(
          typeof data?.error === "string"
            ? data.error
            : "Unable to connect to ZaloPay. Please try again.",
        );
      } finally {
        setLoading(false);
        submitting.current = false;
      }
    } else if (paymentMethod === "COD") {
      try {
        const response = await axios.post(API_PATHS.ORDER.CREATE_COD, {
          checkout_request_id: getCheckoutRequestId(),
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
          fullName: fullName.trim(),
          city: finalCity,
          provinceCode: deliveryInput.provinceCode,
          districtCode: deliveryInput.districtCode,
          wardCode: deliveryInput.wardCode,
          quoteToken: quote.token,
        });

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch {
            /* The order can proceed if saving the profile fails. */
          }
        }

        toast.success("Order placed successfully!");
        handleSetPaymentSuccess(true, response.data.order?.id, {
          amount: response.data.order?.amount ?? cartTotalQtyAmount,
          paymentMethod: "COD",
        });
        handleClearCart();
        handleSetPaymentIntent(null);
        setLoading(false);
        submitting.current = false;
      } catch (error) {
        console.log(error);
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error
          : undefined;
        toast.error(
          typeof message === "string" ? message : "Failed to place order",
        );
        setLoading(false);
        submitting.current = false;
      }
    }
  };
  return (
    <form onSubmit={handleSubmit} id="payment-form" noValidate>
      {pendingOrderId && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          This order needs payment confirmation.{" "}
          <Link
            href={`/orders/${pendingOrderId}`}
            className="font-medium underline"
          >
            View order status
          </Link>
        </p>
      )}
      <Link
        href="/cart"
        className="text-slate-500 flex items-center gap-1 mt-2 mb-4"
      >
        <MdArrowBack size={20} />
        <span>Back to Cart</span>
      </Link>
      <div className="mb-6">
        <Heading title="Enter your details to complete checkout" />
      </div>
      <fieldset disabled={isLoading || cardDeliveryLocked} className="min-w-0">
      <h2 className="text-lg font-semibold mt-4 mb-4">Delivery Information</h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="fullName"
            className="text-sm font-medium text-slate-700"
          >
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            id="fullName"
            autoComplete="name"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby="fullName-error"
            onChange={(e) => {
              setFullName(e.target.value);
              clearFieldError("fullName");
            }}
            placeholder="e.g., John Doe"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
          />
          {renderFieldError("fullName")}
        </div>

        {hasSavedDeliveryInfo && !isEditingDeliveryInfo ? (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  Saved Delivery Information
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Address:</span>{" "}
                  {currentUser?.address}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Phone:</span>{" "}
                  {currentUser?.phoneNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartEditingDeliveryInfo}
                className="text-sm text-blue-600 font-medium hover:underline bg-white px-3 py-1 rounded border border-blue-200"
              >
                Change
              </button>
            </div>
            {renderFieldError("phoneNumber")}
            {renderFieldError("houseNumber")}
            <label htmlFor="deliveryCity" className="mt-4 block space-y-2 text-sm font-medium">
              <span>Province / City for this delivery</span>
              <select id="deliveryCity" value={deliveryCity} disabled={locationLoading.province} onChange={(event) => { setDeliveryCity(event.target.value); clearFieldError("deliveryCity"); }} required autoComplete="address-level1" aria-invalid={Boolean(fieldErrors.deliveryCity)} aria-describedby="deliveryCity-error" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"><option value="">Select Province / City</option>{provinces.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select>
            </label>
            {renderFieldError("deliveryCity")}
            <LocationStatus level="province" loading={locationLoading.province} error={locationErrors.province} onRetry={() => { void loadLocations("province", PROVINCES_API.GET_ALL); }} />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mt-2">
              <label
                htmlFor="province"
                className="text-sm font-medium text-slate-700"
              >
                Province / City
              </label>
              <select
                id="province"
                disabled={locationLoading.province}
                aria-invalid={Boolean(fieldErrors.province)}
                aria-describedby="province-error province-status"
                required
                value={province?.code || ""}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
              >
                <option value="" disabled>
                  Select Province / City
                </option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
              {renderFieldError("province")}
              <LocationStatus
                level="province"
                loading={locationLoading.province}
                error={locationErrors.province}
                onRetry={() => {
                  void loadLocations("province", PROVINCES_API.GET_ALL);
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="district"
                  className="text-sm font-medium text-slate-700"
                >
                  District
                </label>
                <select
                  required
                  id="district"
                  aria-invalid={Boolean(fieldErrors.district)}
                  aria-describedby="district-error district-status"
                  disabled={!province || locationLoading.district}
                  value={district?.code || ""}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="" disabled>
                    Select District
                  </option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {renderFieldError("district")}
                <LocationStatus
                  level="district"
                  loading={locationLoading.district}
                  error={locationErrors.district}
                  onRetry={() => {
                    if (province) {
                      void loadLocations(
                        "district",
                        PROVINCES_API.GET_PROVINCE(province.code),
                      );
                    }
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="ward"
                  className="text-sm font-medium text-slate-700"
                >
                  Ward
                </label>
                <select
                  required
                  id="ward"
                  aria-invalid={Boolean(fieldErrors.ward)}
                  aria-describedby="ward-error ward-status"
                  disabled={!district || locationLoading.ward}
                  value={ward?.code || ""}
                  onChange={(e) => handleWardChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="" disabled>
                    Select Ward
                  </option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {renderFieldError("ward")}
                <LocationStatus
                  level="ward"
                  loading={locationLoading.ward}
                  error={locationErrors.ward}
                  onRetry={() => {
                    if (district) {
                      void loadLocations(
                        "ward",
                        PROVINCES_API.GET_DISTRICT(district.code),
                      );
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="houseNumber"
                className="text-sm font-medium text-slate-700"
              >
                House Number, Street Name
              </label>
              <input
                type="text"
                value={houseNumber}
                id="houseNumber"
                autoComplete="address-line1"
                aria-invalid={Boolean(fieldErrors.houseNumber)}
                aria-describedby="houseNumber-error"
                onChange={(e) => {
                  setHouseNumber(e.target.value);
                  clearFieldError("houseNumber");
                }}
                placeholder="e.g., 387/57 1st Street..."
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
              />
              {renderFieldError("houseNumber")}
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="phoneNumber"
                className="text-sm font-medium text-slate-700"
              >
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                id="phoneNumber"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phoneNumber)}
                aria-describedby="phoneNumber-error"
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  clearFieldError("phoneNumber");
                }}
                placeholder="+84901234567"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
              {renderFieldError("phoneNumber")}
            </div>

            <div className="mt-1 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <input
                id="save-delivery-info"
                type="checkbox"
                checked={shouldSaveDeliveryInfo}
                onChange={(e) => setShouldSaveDeliveryInfo(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
              />
              <label
                htmlFor="save-delivery-info"
                className="text-sm text-slate-700"
              >
                Save this delivery information to my profile for future
                purchases
              </label>
            </div>

            {hasSavedDeliveryInfo && (
              <button
                type="button"
                onClick={handleCancelEditingDeliveryInfo}
                className="text-sm text-slate-500 font-medium hover:underline text-left mt-1 w-max"
              >
                Cancel and use saved delivery information
              </button>
            )}
          </>
        )}
      </div>
      </fieldset>
      {cardDeliveryLocked && <p className="mt-3 text-sm text-slate-500">Delivery is locked while card payment is prepared. Select another payment method to safely cancel the card preparation before editing delivery.</p>}
      {!cardDeliveryLocked && <button type="button" disabled={quoting || isLoading} onClick={() => void getDeliveryQuote()} className="mt-5 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60">{quoting ? "Calculating delivery..." : quote ? "Refresh delivery quote" : "Get delivery quote"}</button>}
      {quoteError && <p role="alert" className="mt-3 text-sm text-rose-600">{quoteError}</p>}
      <h2 className="text-lg font-semibold mt-6 mb-4">Payment Information</h2>

      <div className="flex flex-col gap-3 mb-6">
        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="COD"
            checked={paymentMethod === "COD"}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            disabled={isLoading}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">
            Cash on Delivery (COD)
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="VNPAY"
            checked={paymentMethod === "VNPAY"}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            disabled={isLoading || availablePaymentMethods?.VNPAY === false}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Pay with VNPay</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="MOMO"
            checked={paymentMethod === "MOMO"}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            disabled={isLoading || availablePaymentMethods?.MOMO === false}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Pay with MoMo</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="ZALOPAY"
            checked={paymentMethod === "ZALOPAY"}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            disabled={isLoading || availablePaymentMethods?.ZALOPAY === false}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Pay with ZaloPay</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="STRIPE"
            checked={paymentMethod === "STRIPE"}
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            disabled={isLoading || availablePaymentMethods?.STRIPE === false}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">
            Credit or debit card (Stripe)
          </span>
        </label>
      </div>

      {paymentMethod === "STRIPE" && cardPayment}
      {paymentMethod === "ZALOPAY" && (
        <p className="mb-3 text-sm text-slate-500">
          You will continue to the ZaloPay payment page.
        </p>
      )}
      {zaloPayOrderId && (
        <Link
          href={`/orders/${zaloPayOrderId}`}
          className="mb-3 inline-flex min-h-11 items-center text-base text-teal-700 hover:underline"
        >
          View your ZaloPay order status
        </Link>
      )}

      <div aria-label="Order totals" className="py-4 text-center text-slate-700 text-xl font-bold">
        <p className="mb-2 text-sm font-normal">Delivery fee: {quote ? formatPrice(quote.totals.shippingFee) : "Calculated after checking your delivery address"}</p>
        <p>Total: {formattedPrice}</p>
        {!quote && <p className="mt-2 text-xs font-normal text-slate-500">Items total shown. Delivery will be included after you get a quote.</p>}
        {quote && <p className="mt-2 text-xs font-normal text-slate-500">{quote.totals.shippingPolicyLabel}. Quote valid until {new Date(quote.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })} (Vietnam time). Stock is reserved when you place the order.</p>}
      </div>
      {paymentMethod === "VNPAY" || paymentMethod === "MOMO" ? (
        <p className="mb-3 text-center text-sm text-slate-500">
          You will continue to {paymentMethod === "VNPAY" ? "VNPay" : "MoMo"} to
          complete payment.
        </p>
      ) : null}
      <Button
        type="submit"
        label={
          isLoading
            ? "Processing..."
            : paymentMethod === "COD"
              ? "Place Order"
              : paymentMethod === "VNPAY"
                ? "Continue with VNPay"
                : paymentMethod === "MOMO"
                  ? "Continue with MoMo"
                  : paymentMethod === "ZALOPAY"
                    ? "Continue with ZaloPay"
                    : "Pay Now"
        }
        disabled={
          isLoading || quoting || !quote || (paymentMethod === "STRIPE" && (!stripe || !elements))
        }
        onClick={() => {}}
      />
    </form>
  );
}
