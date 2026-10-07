"use client";

import Avatar from "@/app/components/Avatar";
import { Rating } from "@mui/material";
import moment from "moment";
import type { CatalogProduct } from "@/utils/productFilters";
import ReviewForm from "./ReviewForm";

interface ListRatingProps {
  product: CatalogProduct;
}

export default function ListRating({ product }: ListRatingProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Customer reviews</h2>
      <ReviewForm key={product.id} />
      <div className="text-base mt-4">
        {product.reviews && product.reviews.length > 0 ? (
          product.reviews.map((review) => (
            <div key={review.id} className="max-w-[500px]">
              <div className="flex gap-2 items-center">
                <Avatar src={review?.user.image} />
                <div className="font-semibold">{review?.user.name}</div>
                <div className="text-sm text-slate-500">
                  {moment(review?.createdDate).fromNow()}
                </div>
              </div>

              <div className="mt-2">
                <Rating value={review.rating} readOnly></Rating>
              </div>

              <div className="ml-2">{review?.comment}</div>

              <hr className="mt-4 mb-4" />
            </div>
          ))
        ) : (
          <p className="text-slate-500">No reviews yet for this product.</p>
        )}
      </div>
    </div>
  );
}
