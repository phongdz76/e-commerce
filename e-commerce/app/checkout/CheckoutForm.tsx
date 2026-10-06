"use client";

import { formatPrice } from "@/utils/formatPrice";
import { useCart } from "../hooks/useCart";
import {
  useElements,
  useStripe,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import Heading from "../components/Headinng";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Button from "../components/Button";
import { safeUser } from "@/types";
import axios from "axios";
import { API_PATHS } from "../../utils/apiPaths";
import { PROVINCES_API } from "../../utils/externalApiPaths";

const PHONE_REGEX = /^\+?[0-9]{9,15}$/;
type LocationLevel = "province" | "district" | "ward";
type DeliveryField = LocationLevel | "fullName" | "houseNumber" | "phoneNumber";
interface LocationOption { code: number; name: string }

function LocationStatus({ level, loading, error, onRetry }: { level: LocationLevel; loading?: boolean; error?: string; onRetry: () => void }) {
  return <div id={`${level}-status`}>
    {loading && <p role="status" className="text-sm text-slate-500">Loading locations...</p>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-600">
      <p>{error}</p><button type="button" onClick={onRetry} className="min-h-11 font-medium text-teal-700 underline">Try again</button>
    </div>}
  </div>;
}

interface CheckoutFormProps {
  clientSecret: string;
  handleSetPaymentSuccess: (value: boolean, orderId?: string) => void;
  currentUser: safeUser | null;
}

export default function CheckoutForm({
  clientSecret,
  handleSetPaymentSuccess,
  currentUser,
}: CheckoutFormProps) {
  const { cartTotalQtyAmount, handleClearCart, handleSetPaymentIntent, cartProducts } =
    useCart().context;
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setLoading] = useState<boolean>(false);
  const submitting = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("COD");
  const [fullName, setFullName] = useState(currentUser?.name || "");
  const hasSavedAddress = Boolean(currentUser?.address?.trim());
  const hasSavedPhone = Boolean(currentUser?.phoneNumber?.trim());
  const hasSavedDeliveryInfo = hasSavedAddress && hasSavedPhone;

  const [isEditingDeliveryInfo, setIsEditingDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);
  const [shouldSaveDeliveryInfo, setShouldSaveDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);

  const [houseNumber, setHouseNumber] = useState("");
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [province, setProvince] = useState<LocationOption | null>(null);
  const [district, setDistrict] = useState<LocationOption | null>(null);
  const [ward, setWard] = useState<LocationOption | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DeliveryField, string>>>({});
  const [locationErrors, setLocationErrors] = useState<Partial<Record<LocationLevel, string>>>({});
  const [locationLoading, setLocationLoading] = useState<Partial<Record<LocationLevel, boolean>>>({ province: true });
  const locationRequests = useRef({ province: 0, district: 0, ward: 0 });

  const [phoneNumber, setPhoneNumber] = useState(
    currentUser?.phoneNumber || "",
  );
  const formattedPrice = formatPrice(cartTotalQtyAmount);

  const loadLocations = useCallback(async (level: LocationLevel, url: string) => {
    const request = ++locationRequests.current[level];
    setLocationLoading((previous) => ({ ...previous, [level]: true }));
    setLocationErrors((previous) => ({ ...previous, [level]: undefined }));
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Address lookup failed");
      const data = await response.json();
      const options = level === "province" ? data : level === "district" ? data.districts : data.wards;
      if (!Array.isArray(options)) throw new Error("Invalid address response");
      if (request !== locationRequests.current[level]) return;
      if (level === "province") setProvinces(options);
      else if (level === "district") setDistricts(options);
      else setWards(options);
    } catch {
      if (request === locationRequests.current[level]) setLocationErrors((previous) => ({ ...previous, [level]: "We couldn't load these locations. Please try again." }));
    } finally {
      if (request === locationRequests.current[level]) setLocationLoading((previous) => ({ ...previous, [level]: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requests = locationRequests.current;
    void Promise.resolve().then(() => { if (active) return loadLocations("province", PROVINCES_API.GET_ALL); });
    return () => { active = false; requests.province++; requests.district++; requests.ward++; };
  }, [loadLocations]);

  const clearFieldError = (field: DeliveryField) => setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  const renderFieldError = (field: DeliveryField) => fieldErrors[field] && <p id={`${field}-error`} role="alert" className="text-sm text-rose-600">{fieldErrors[field]}</p>;

  const handleProvinceChange = (code: string) => {
    const p = provinces.find((x) => String(x.code) === code);
    setProvince(p ?? null);
    clearFieldError("province");
    locationRequests.current.district++;
    locationRequests.current.ward++;
    setLocationErrors((previous) => ({ ...previous, district: undefined, ward: undefined }));
    setLocationLoading((previous) => ({ ...previous, district: false, ward: false }));
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
    if (ward) parts.push(ward.name);
    if (district) parts.push(district.name);
    if (province) parts.push(province.name);
    return parts.filter(Boolean).join(", ");
  };

  useEffect(() => {
    if (!stripe) {
      return;
    }
    if (!clientSecret) {
      return;
    }
    handleSetPaymentSuccess(false);
  }, [stripe, clientSecret, handleSetPaymentSuccess]);

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
    if (submitting.current) return;

    if (paymentMethod === "STRIPE" && (!stripe || !elements)) {
      toast.error("Card payment is still loading. Please try again in a moment.");
      return;
    }

    const normalizedPhone = phoneNumber.replace(/\s+/g, "");
    const finalAddress = isEditingDeliveryInfo
      ? getFinalAddress()
      : currentUser?.address || "";
    const finalPhone = isEditingDeliveryInfo
      ? normalizedPhone
      : (currentUser?.phoneNumber || normalizedPhone).replace(/\s+/g, "");

    const errors: Partial<Record<DeliveryField, string>> = {};
    if (!fullName.trim()) errors.fullName = "Please enter the recipient's full name.";
    if (isEditingDeliveryInfo) {
      if (!province) errors.province = "Please select a province or city.";
      if (!district) errors.district = "Please select a district.";
      if (!ward) errors.ward = "Please select a ward.";
      if (!houseNumber.trim()) errors.houseNumber = "Please enter your house number and street.";
    }
    if (!finalAddress.trim()) errors.houseNumber = "Please enter a delivery address.";
    if (!PHONE_REGEX.test(finalPhone)) errors.phoneNumber = "Enter a valid phone number with 9–15 digits.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }

    setLoading(true);
    submitting.current = true;

    if (paymentMethod === "STRIPE") {
      if (!stripe || !elements) return;
      stripe
        .confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${window.location.origin}/checkout?stripe=return`,
            shipping: { name: fullName.trim(), phone: finalPhone, address: { line1: finalAddress, country: "VN" } },
          },
        })
        .then(async (result) => {
          if (result.error) {
            toast.error(result.error.message || "Payment failed. Please try again.");
          } else if (result.paymentIntent?.status === "succeeded") {
            let orderId: string | undefined;
            try {
              const response = await axios.post(API_PATHS.PAYMENT.SYNC_STRIPE_ORDER, { payment_intent_id: result.paymentIntent.id });
              orderId = response.data.order?.id;
              toast.success("Payment successful!");
            } catch {
              toast("Payment received. Check Your Orders for the latest status.");
            }
            handleSetPaymentSuccess(true, orderId);
            handleClearCart();
            handleSetPaymentIntent(null);

            if (currentUser && shouldSaveDeliveryInfo) {
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
        }).catch(() => {
          toast.error("Unable to complete card payment. Please try again.");
          setLoading(false);
          submitting.current = false;
        });
    } else if (paymentMethod === "VNPAY") {
      try {
        const response = await axios.post("/api/vnpay/create-payment-url", {
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
        });

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch (error) {}
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
        toast.error("Error connecting to VNPay");
        setLoading(false);
        submitting.current = false;
      }
    } else if (paymentMethod === "MOMO") {
      try {
        const response = await axios.post("/api/momo/create-payment-url", {
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
        });

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch (error) {}
        }

        if (response.data.url) {
          window.location.href = response.data.url;
        } else {
          toast.error("Failed to create MoMo payment URL");
          setLoading(false);
          submitting.current = false;
        }
      } catch (error) {
        console.log(error);
        toast.error("Error connecting to MoMo");
        setLoading(false);
        submitting.current = false;
      }
    } else if (paymentMethod === "COD") {
      try {
        const response = await axios.post("/api/order/create-cod", {
          items: cartProducts,
          amount: cartTotalQtyAmount,
          address: finalAddress,
          phone: finalPhone,
        });

        if (currentUser && shouldSaveDeliveryInfo) {
          try {
            await axios.patch(API_PATHS.AUTH.PROFILE, {
              address: finalAddress,
              phoneNumber: finalPhone,
            });
          } catch (error) {}
        }

        toast.success("Order placed successfully!");
        handleSetPaymentSuccess(true, response.data.order?.id);
        handleClearCart();
        handleSetPaymentIntent(null);
        setLoading(false);
        submitting.current = false;
      } catch (error) {
        console.log(error);
        toast.error("Failed to place order");
        setLoading(false);
        submitting.current = false;
      }
    }
  };
  return (
    <form onSubmit={handleSubmit} id="payment-form" noValidate>
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
      <h2 className="text-lg font-semibold mt-4 mb-4">Delivery Information</h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            id="fullName"
            autoComplete="name"
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby="fullName-error"
            onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
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
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mt-2">
              <label htmlFor="province" className="text-sm font-medium text-slate-700">
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
              <LocationStatus level="province" loading={locationLoading.province} error={locationErrors.province} onRetry={() => { void loadLocations("province", PROVINCES_API.GET_ALL); }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="district" className="text-sm font-medium text-slate-700">
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
                <LocationStatus level="district" loading={locationLoading.district} error={locationErrors.district} onRetry={() => { if (province) void loadLocations("district", PROVINCES_API.GET_PROVINCE(province.code)); }} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="ward" className="text-sm font-medium text-slate-700">
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
                <LocationStatus level="ward" loading={locationLoading.ward} error={locationErrors.ward} onRetry={() => { if (district) void loadLocations("ward", PROVINCES_API.GET_DISTRICT(district.code)); }} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="houseNumber" className="text-sm font-medium text-slate-700">
                House Number, Street Name
              </label>
              <input
                type="text"
                value={houseNumber}
                id="houseNumber"
                autoComplete="address-line1"
                aria-invalid={Boolean(fieldErrors.houseNumber)}
                aria-describedby="houseNumber-error"
                onChange={(e) => { setHouseNumber(e.target.value); clearFieldError("houseNumber"); }}
                placeholder="e.g., 387/57 1st Street..."
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
              />
              {renderFieldError("houseNumber")}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phoneNumber" className="text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                id="phoneNumber"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phoneNumber)}
                aria-describedby="phoneNumber-error"
                onChange={(e) => { setPhoneNumber(e.target.value); clearFieldError("phoneNumber"); }}
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
      <h2 className="text-lg font-semibold mt-6 mb-4">Payment Information</h2>

      <div className="flex flex-col gap-3 mb-6">
         <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="COD"
            checked={paymentMethod === "COD"}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Cash on Delivery (COD)</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="VNPAY"
            checked={paymentMethod === "VNPAY"}
            onChange={(e) => setPaymentMethod(e.target.value)}
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
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Pay with MoMo</span>
        </label>

       

        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-slate-50">
          <input
            type="radio"
            name="paymentMethod"
            value="STRIPE"
            checked={paymentMethod === "STRIPE"}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-slate-700">Credit or debit card (Stripe)</span>
        </label>
      </div>

      {paymentMethod === "STRIPE" && (
        <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      )}

      <div className="py-4 text-center text-slate-700 text-xl font-bold">
        Total: {formattedPrice}
      </div>
      <Button
        type="submit"
        label={isLoading ? "Processing..." : paymentMethod === "COD" ? "Place Order" : "Pay Now"}
        disabled={isLoading || (paymentMethod === "STRIPE" && (!stripe || !elements))}
        onClick={() => {}}
      />
    </form>
  );
}
