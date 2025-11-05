"use client";

import Avatar from "@/app/components/Avatar";
import Heading from "@/app/components/Headinng";
import { Rating } from "@mui/material";
import moment from "moment";

interface ListRatingProps {
  product: any;
}

export default function ListRating({ product }: ListRatingProps) {
  return (
    <div>
      <Heading title="Product View"></Heading>
      <div className="text-sm mt-4">
        {product.reviews && product.reviews.length > 0 ? (
          product.reviews.map((review: any) => (
            <div key={review.id} className="max-w-[500px]">
              <div className="flex gap-2 items-center">
                <Avatar src={review?.user.image} />
                <div className="font-semibold">{review?.user.name}</div>
                <div className="font-light">
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
          <div>No reviews yet.</div>
        )}
      </div>
    </div>
  );
}
