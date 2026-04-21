"use client";

import { formatPrice } from "@/utils/formatPrice";
import { useCart } from "../hooks/useCart";
import {
  useElements,
  useStripe,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Heading from "../components/Headinng";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Button from "../components/Button";
import { safeUser } from "@/types";
import axios from "axios";

const PHONE_REGEX = /^\+?[0-9]{9,15}$/;

interface CheckoutFormProps {
  clientSecret: string;
  handleSetPaymentSuccess: (value: boolean) => void;
  currentUser: safeUser | null;
}

export default function CheckoutForm({
  clientSecret,
  handleSetPaymentSuccess,
  currentUser,
}: CheckoutFormProps) {
  const { cartTotalQtyAmount, handleClearCart, handleSetPaymentIntent } =
    useCart().context;
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [fullName, setFullName] = useState(currentUser?.name || "");
  const hasSavedAddress = Boolean(currentUser?.address?.trim());
  const hasSavedPhone = Boolean(currentUser?.phoneNumber?.trim());
  const hasSavedDeliveryInfo = hasSavedAddress && hasSavedPhone;

  const [isEditingDeliveryInfo, setIsEditingDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);
  const [shouldSaveDeliveryInfo, setShouldSaveDeliveryInfo] =
    useState(!hasSavedDeliveryInfo);

  const [houseNumber, setHouseNumber] = useState("");
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [province, setProvince] = useState<any>(null);
  const [district, setDistrict] = useState<any>(null);
  const [ward, setWard] = useState<any>(null);

  const [phoneNumber, setPhoneNumber] = useState(
    currentUser?.phoneNumber || "",
  );
  const formattedPrice = formatPrice(cartTotalQtyAmount);

  useEffect(() => {
    fetch("https://provinces.open-api.vn/api/p/")
      .then((res) => res.json())
      .then((data) => setProvinces(data))
      .catch((err) => console.log(err));
  }, []);

  const handleProvinceChange = (code: string) => {
    const p = provinces.find((x) => x.code == code);
    setProvince(p);
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    if (p) {
      fetch(`https://provinces.open-api.vn/api/p/${p.code}?depth=2`)
        .then((res) => res.json())
        .then((data) => setDistricts(data.districts))
        .catch((err) => console.log(err));
    }
  };

  const handleDistrictChange = (code: string) => {
    const d = districts.find((x) => x.code == code);
    setDistrict(d);
    setWard(null);
    setWards([]);
    if (d) {
      fetch(`https://provinces.open-api.vn/api/d/${d.code}?depth=2`)
        .then((res) => res.json())
        .then((data) => setWards(data.wards))
        .catch((err) => console.log(err));
    }
  };

  const handleWardChange = (code: string) => {
    const w = wards.find((x) => x.code == code);
    setWard(w);
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

    if (!stripe || !elements) {
      return;
    }

    const normalizedPhone = phoneNumber.replace(/\s+/g, "");
    const finalAddress = isEditingDeliveryInfo
      ? getFinalAddress()
      : currentUser?.address || "";
    const finalPhone = isEditingDeliveryInfo
      ? normalizedPhone
      : (currentUser?.phoneNumber || normalizedPhone).replace(/\s+/g, "");

    if (!finalAddress) {
      toast.error("Address is required");
      return;
    }

    if (!PHONE_REGEX.test(finalPhone)) {
      toast.error("Invalid phone number format");
      return;
    }

    setLoading(true);

    stripe
      .confirmPayment({
        elements,
        redirect: "if_required",
      })
      .then(async (result) => {
        if (!result.error) {
          toast.success("Payment successful!");
          handleSetPaymentSuccess(true);
          handleClearCart();
          handleSetPaymentIntent(null);

          if (currentUser && shouldSaveDeliveryInfo) {
            try {
              await axios.patch("/api/profile", {
                address: finalAddress,
                phoneNumber: finalPhone,
              });
            } catch (error) {
              console.log("Failed to sync profile address", error);
            }
          }
        }
        setLoading(false);
      });
  };
  return (
    <form onSubmit={handleSubmit} id="payment-form">
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
          <label className="text-sm font-medium text-slate-700">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., John Doe"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
          />
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
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-sm font-medium text-slate-700">
                Province / City
              </label>
              <select
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">
                  District
                </label>
                <select
                  required
                  disabled={!province}
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
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Ward
                </label>
                <select
                  required
                  disabled={!district}
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
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                House Number, Street Name
              </label>
              <input
                type="text"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="e.g., 387/57 1st Street..."
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+84901234567"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
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
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      <div className="py-4 text-center text-slate-700 text-xl font-bold">
        Total: {formattedPrice}
      </div>
      <Button
        label={isLoading ? "Processing..." : "Pay Now"}
        disabled={isLoading || !stripe || !elements}
        onClick={() => {}}
      />
    </form>
  );
}
